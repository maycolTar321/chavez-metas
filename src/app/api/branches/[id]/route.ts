import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { branches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { branchSchema } from "@/lib/validations";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: Solo el SUPERADMIN puede modificar o cambiar el estado de sucursales.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const db = getDb();
    const existingList = await db
      .select()
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    const existing = existingList[0];
    if (!existing) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Si es solo activación/desactivación rápida
    if (typeof body.isActive === "boolean" && Object.keys(body).length === 1) {
      const [updated] = await db
        .update(branches)
        .set({ isActive: body.isActive, updatedAt: new Date() })
        .where(eq(branches.id, branchId))
        .returning();

      await recordAuditLog({
        userId: user.id,
        branchId: updated.id,
        module: "SUCURSALES",
        action: body.isActive ? "ACTIVAR_SUCURSAL" : "DESACTIVAR_SUCURSAL",
        entityId: updated.id,
        description: `Se ${
          body.isActive ? "activó" : "desactivó"
        } la sucursal ${updated.code} - ${updated.name} (conservando historial intacto)`,
        previousData: existing,
        newData: updated,
      });

      return NextResponse.json({ ok: true, branch: updated });
    }

    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(branches)
      .set({
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        address: parsed.data.address,
        managerName: parsed.data.managerName,
        phone: parsed.data.phone || null,
        openingDate: parsed.data.openingDate,
        isActive: parsed.data.isActive,
        observations: parsed.data.observations || null,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId))
      .returning();

    await recordAuditLog({
      userId: user.id,
      branchId: updated.id,
      module: "SUCURSALES",
      action: "EDITAR_SUCURSAL",
      entityId: updated.id,
      description: `Se actualizó la sucursal ${updated.code} - ${updated.name}`,
      previousData: existing,
      newData: updated,
    });

    return NextResponse.json({ ok: true, branch: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar sucursal",
      },
      { status: 500 }
    );
  }
}
