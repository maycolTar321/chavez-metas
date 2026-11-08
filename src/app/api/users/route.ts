import { NextRequest, NextResponse } from "next/server";
import { eq, or, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { users, branches } from "@/db/schema";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { resolveAuthorizedBranchId } from "@/lib/permissions";
import { userCreateSchema } from "@/lib/validations";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "SUPERADMIN" &&
        user.role !== "ADMIN_SUCURSAL" &&
        user.role !== "GERENCIA")
    ) {
      return NextResponse.json(
        { error: "Acceso denegado al módulo de personal" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const reqBranchId = searchParams.get("branchId")
      ? parseInt(searchParams.get("branchId")!, 10)
      : null;

    const effectiveBranchId = resolveAuthorizedBranchId(user, reqBranchId);
    const db = getDb();

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        branchId: users.branchId,
        branchName: branches.name,
        branchCode: branches.code,
        canRegisterSales: users.canRegisterSales,
        canEditSales: users.canEditSales,
        canVoidSales: users.canVoidSales,
        canManageGoals: users.canManageGoals,
        isActive: users.isActive,
        phone: users.phone,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(branches, eq(users.branchId, branches.id))
      .where(effectiveBranchId ? eq(users.branchId, effectiveBranchId) : undefined)
      .orderBy(asc(users.fullName));

    return NextResponse.json({ users: rows });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al obtener usuarios",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "SUPERADMIN" && user.role !== "ADMIN_SUCURSAL")
    ) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: Solo SUPERADMIN o Administrador de Sucursal pueden crear personal.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (!data.password || data.password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña es obligatoria (mínimo 6 caracteres)." },
        { status: 400 }
      );
    }

    // Restricciones para ADMIN_SUCURSAL
    let assignedBranchId = data.branchId || null;
    let assignedRole = data.role;

    if (user.role === "ADMIN_SUCURSAL") {
      if (!user.branchId) {
        return NextResponse.json(
          { error: "No tienes una sucursal asignada" },
          { status: 400 }
        );
      }
      assignedBranchId = user.branchId;
      if (
        assignedRole === "SUPERADMIN" ||
        assignedRole === "GERENCIA" ||
        assignedRole === "ADMIN_SUCURSAL"
      ) {
        assignedRole = "TRABAJADOR";
      }
    }

    if (
      assignedRole !== "SUPERADMIN" &&
      assignedRole !== "GERENCIA" &&
      !assignedBranchId
    ) {
      return NextResponse.json(
        {
          error:
            "Los roles de Sucursal (Administrador, Encargado, Trabajador) requieren una sucursal asignada.",
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, data.username.trim()),
          eq(users.email, data.email.trim().toLowerCase())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "El nombre de usuario o correo electrónico ya está en uso." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);

    const [created] = await db
      .insert(users)
      .values({
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        fullName: data.fullName.trim(),
        passwordHash,
        role: assignedRole,
        branchId: assignedBranchId,
        canRegisterSales: data.canRegisterSales,
        canEditSales:
          user.role === "SUPERADMIN" ? data.canEditSales : false,
        canVoidSales:
          user.role === "SUPERADMIN" ? data.canVoidSales : false,
        canManageGoals:
          user.role === "SUPERADMIN" ? data.canManageGoals : false,
        isActive: data.isActive,
        phone: data.phone || null,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        branchId: users.branchId,
        isActive: users.isActive,
      });

    await recordAuditLog({
      userId: user.id,
      branchId: assignedBranchId,
      module: "PERSONAL",
      action: "CREAR_USUARIO",
      entityId: created.id,
      description: `Se creó el usuario ${created.fullName} (@${created.username}) con rol ${created.role}`,
      newData: created,
    });

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al crear el usuario",
      },
      { status: 500 }
    );
  }
}
