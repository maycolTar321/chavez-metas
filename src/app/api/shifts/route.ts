import { NextRequest, NextResponse } from "next/server";
import { eq, or, isNull, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { shifts, branches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveAuthorizedBranchId,
  hasGlobalBranchAccess,
} from "@/lib/permissions";
import { shiftSchema } from "@/lib/validations";
import { doesShiftCrossMidnight } from "@/lib/utils";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reqBranchId = searchParams.get("branchId")
      ? parseInt(searchParams.get("branchId")!, 10)
      : null;

    const effectiveBranchId = resolveAuthorizedBranchId(user, reqBranchId);
    const db = getDb();

    const rows = await db
      .select({
        id: shifts.id,
        branchId: shifts.branchId,
        branchName: branches.name,
        branchCode: branches.code,
        name: shifts.name,
        type: shifts.type,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        crossesMidnight: shifts.crossesMidnight,
        isActive: shifts.isActive,
        observations: shifts.observations,
        createdAt: shifts.createdAt,
      })
      .from(shifts)
      .leftJoin(branches, eq(shifts.branchId, branches.id))
      .where(
        effectiveBranchId
          ? or(isNull(shifts.branchId), eq(shifts.branchId, effectiveBranchId))
          : undefined
      )
      .orderBy(asc(shifts.startTime));

    return NextResponse.json({ shifts: rows });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al obtener turnos",
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
            "Acceso denegado: Solo SUPERADMIN o Administrador de Sucursal pueden configurar horarios de turnos.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = shiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const targetBranchId = hasGlobalBranchAccess(user.role)
      ? data.branchId || null
      : user.branchId;

    const crossesMidnight = doesShiftCrossMidnight(
      data.startTime,
      data.endTime
    );

    const db = getDb();
    const [created] = await db
      .insert(shifts)
      .values({
        branchId: targetBranchId,
        name: data.name,
        type: data.type,
        startTime: data.startTime,
        endTime: data.endTime,
        crossesMidnight,
        isActive: data.isActive,
        observations: data.observations || null,
      })
      .returning();

    await recordAuditLog({
      userId: user.id,
      branchId: targetBranchId,
      module: "TURNOS",
      action: "CREAR_TURNO",
      entityId: created.id,
      description: `Se creó el turno "${created.name}" (${created.startTime} - ${
        created.endTime
      })${crossesMidnight ? " [Cruza medianoche]" : ""}`,
      newData: created,
    });

    return NextResponse.json({ ok: true, shift: created }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al crear el turno",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "SUPERADMIN" && user.role !== "ADMIN_SUCURSAL")
    ) {
      return NextResponse.json(
        { error: "Acceso denegado" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const shiftId = Number(body.id);
    if (!shiftId) {
      return NextResponse.json({ error: "ID de turno requerido" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    if (
      user.role !== "SUPERADMIN" &&
      existing.branchId !== user.branchId
    ) {
      return NextResponse.json(
        {
          error:
            "Solo puedes modificar turnos pertenecientes a tu propia sucursal.",
        },
        { status: 403 }
      );
    }

    const newStart = body.startTime || existing.startTime;
    const newEnd = body.endTime || existing.endTime;
    const crossesMidnight = doesShiftCrossMidnight(newStart, newEnd);

    const [updated] = await db
      .update(shifts)
      .set({
        name: body.name ?? existing.name,
        type: body.type ?? existing.type,
        startTime: newStart,
        endTime: newEnd,
        crossesMidnight,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : existing.isActive,
        observations:
          body.observations !== undefined
            ? body.observations
            : existing.observations,
        updatedAt: new Date(),
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    await recordAuditLog({
      userId: user.id,
      branchId: updated.branchId,
      module: "TURNOS",
      action: "ACTUALIZAR_TURNO",
      entityId: updated.id,
      description: `Se actualizó el turno "${updated.name}" (${updated.startTime} - ${updated.endTime})`,
      previousData: existing,
      newData: updated,
    });

    return NextResponse.json({ ok: true, shift: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al actualizar turno",
      },
      { status: 500 }
    );
  }
}
