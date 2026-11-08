import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, sessions } from "@/db/schema";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (
      !currentUser ||
      (currentUser.role !== "SUPERADMIN" &&
        currentUser.role !== "ADMIN_SUCURSAL")
    ) {
      return NextResponse.json(
        { error: "Acceso denegado" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const targetId = parseInt(id, 10);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (currentUser.role === "ADMIN_SUCURSAL") {
      if (existing.branchId !== currentUser.branchId) {
        return NextResponse.json(
          {
            error:
              "Acceso denegado: Solo puedes administrar trabajadores de tu propia sucursal.",
          },
          { status: 403 }
        );
      }
      if (
        existing.role === "SUPERADMIN" ||
        existing.role === "GERENCIA"
      ) {
        return NextResponse.json(
          { error: "No tienes permisos para modificar usuarios de nivel gerencial." },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.fullName === "string" && body.fullName.trim()) {
      updatePayload.fullName = body.fullName.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      updatePayload.email = body.email.trim().toLowerCase();
    }
    if (typeof body.phone !== "undefined") {
      updatePayload.phone = body.phone || null;
    }
    if (typeof body.canRegisterSales === "boolean") {
      updatePayload.canRegisterSales = body.canRegisterSales;
    }
    if (typeof body.isActive === "boolean") {
      if (targetId === currentUser.id && !body.isActive) {
        return NextResponse.json(
          { error: "No puedes desactivar tu propio usuario activo." },
          { status: 400 }
        );
      }
      updatePayload.isActive = body.isActive;
    }

    if (currentUser.role === "SUPERADMIN") {
      if (body.role) updatePayload.role = body.role;
      if (typeof body.branchId !== "undefined") {
        updatePayload.branchId = body.branchId ? Number(body.branchId) : null;
      }
      if (typeof body.canEditSales === "boolean") {
        updatePayload.canEditSales = body.canEditSales;
      }
      if (typeof body.canVoidSales === "boolean") {
        updatePayload.canVoidSales = body.canVoidSales;
      }
      if (typeof body.canManageGoals === "boolean") {
        updatePayload.canManageGoals = body.canManageGoals;
      }
    } else if (currentUser.role === "ADMIN_SUCURSAL") {
      if (body.role === "ENCARGADO" || body.role === "TRABAJADOR") {
        updatePayload.role = body.role;
      }
    }

    if (typeof body.password === "string" && body.password.trim().length >= 6) {
      updatePayload.passwordHash = await hashPassword(body.password.trim());
    }

    const [updated] = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, targetId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        branchId: users.branchId,
        canRegisterSales: users.canRegisterSales,
        canEditSales: users.canEditSales,
        canVoidSales: users.canVoidSales,
        canManageGoals: users.canManageGoals,
        isActive: users.isActive,
      });

    // Si se desactivó al usuario o cambió su contraseña, revocar sesiones activas
    if (body.isActive === false || body.password) {
      await db
        .update(sessions)
        .set({ isRevoked: true })
        .where(eq(sessions.userId, targetId));
    }

    await recordAuditLog({
      userId: currentUser.id,
      branchId: updated.branchId,
      module: "PERSONAL",
      action: "ACTUALIZAR_USUARIO",
      entityId: updated.id,
      description: `Se actualizaron permisos/datos del usuario ${updated.fullName} (@${updated.username})`,
      previousData: {
        role: existing.role,
        branchId: existing.branchId,
        isActive: existing.isActive,
        canRegisterSales: existing.canRegisterSales,
      },
      newData: updated,
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar usuario",
      },
      { status: 500 }
    );
  }
}
