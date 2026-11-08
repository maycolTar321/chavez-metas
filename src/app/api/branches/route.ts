import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { branches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasGlobalBranchAccess } from "@/lib/permissions";
import { branchSchema } from "@/lib/validations";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "Base de datos no configurada" },
        { status: 503 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const db = getDb();
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get("active") === "true";

    // Aislamiento de datos por sucursal si no es SUPERADMIN ni GERENCIA
    if (!hasGlobalBranchAccess(user.role)) {
      if (!user.branchId) {
        return NextResponse.json({ branches: [] });
      }
      const userBranch = await db
        .select()
        .from(branches)
        .where(eq(branches.id, user.branchId));
      return NextResponse.json({ branches: userBranch });
    }

    const allBranches = await db
      .select()
      .from(branches)
      .where(onlyActive ? eq(branches.isActive, true) : undefined)
      .orderBy(asc(branches.code));

    return NextResponse.json({ branches: allBranches });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al obtener sucursales",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: Solo el SUPERADMIN puede crear nuevas sucursales.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const db = getDb();
    const codeUpper = parsed.data.code.toUpperCase();

    const existing = await db
      .select()
      .from(branches)
      .where(eq(branches.code, codeUpper))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Ya existe una sucursal con el código ${codeUpper}` },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(branches)
      .values({
        code: codeUpper,
        name: parsed.data.name,
        address: parsed.data.address,
        managerName: parsed.data.managerName,
        phone: parsed.data.phone || null,
        openingDate: parsed.data.openingDate,
        isActive: parsed.data.isActive,
        observations: parsed.data.observations || null,
      })
      .returning();

    await recordAuditLog({
      userId: user.id,
      branchId: created.id,
      module: "SUCURSALES",
      action: "CREAR_SUCURSAL",
      entityId: created.id,
      description: `Se creó la sucursal ${created.code} - ${created.name}`,
      newData: created,
    });

    return NextResponse.json({ ok: true, branch: created }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al crear la sucursal",
      },
      { status: 500 }
    );
  }
}
