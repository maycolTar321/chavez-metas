import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  salesRecords,
  salesRecordHistory,
  branches,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveAuthorizedBranchId,
  canUserRegisterSales,
} from "@/lib/permissions";
import { saleRegistrationSchema } from "@/lib/validations";
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const statusFilter = searchParams.get("status");
    const shiftTypeFilter = searchParams.get("shiftType");
    const limitParam = Math.min(
      500,
      parseInt(searchParams.get("limit") || "150", 10)
    );

    const effectiveBranchId = resolveAuthorizedBranchId(user, reqBranchId);
    const db = getDb();

    const conditions = [];
    if (effectiveBranchId) {
      conditions.push(eq(salesRecords.branchId, effectiveBranchId));
    }
    if (startDate) {
      conditions.push(gte(salesRecords.operationalDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(salesRecords.operationalDate, endDate));
    }
    if (statusFilter && statusFilter !== "TODOS") {
      conditions.push(
        eq(
          salesRecords.status,
          statusFilter as "ACTIVO" | "EDITADO" | "ANULADO"
        )
      );
    }
    if (shiftTypeFilter && shiftTypeFilter !== "TODOS") {
      conditions.push(
        eq(
          salesRecords.shiftType,
          shiftTypeFilter as "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO"
        )
      );
    }

    const rows = await db
      .select({
        id: salesRecords.id,
        branchId: salesRecords.branchId,
        branchCode: branches.code,
        branchName: branches.name,
        shiftId: salesRecords.shiftId,
        shiftName: salesRecords.shiftName,
        shiftType: salesRecords.shiftType,
        operationalDate: salesRecords.operationalDate,
        startTime: salesRecords.startTime,
        endTime: salesRecords.endTime,
        crossesMidnight: salesRecords.crossesMidnight,
        amount: salesRecords.amount,
        registeredById: salesRecords.registeredById,
        registeredByName: users.fullName,
        registeredByUsername: users.username,
        status: salesRecords.status,
        voidReason: salesRecords.voidReason,
        observations: salesRecords.observations,
        idempotencyKey: salesRecords.idempotencyKey,
        createdAt: salesRecords.createdAt,
        updatedAt: salesRecords.updatedAt,
      })
      .from(salesRecords)
      .innerJoin(branches, eq(salesRecords.branchId, branches.id))
      .innerJoin(users, eq(salesRecords.registeredById, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(salesRecords.operationalDate), desc(salesRecords.createdAt))
      .limit(limitParam);

    return NextResponse.json({
      sales: rows.map((r) => ({
        ...r,
        operationalDate: String(r.operationalDate),
        amount: parseFloat(String(r.amount)),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al consultar los registros de ventas",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!canUserRegisterSales(user)) {
      return NextResponse.json(
        {
          error:
            "Tu usuario no cuenta con autorización activa para registrar ventas.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = saleRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 1. Verificar aislamiento por sucursal en servidor
    const authorizedBranchId = resolveAuthorizedBranchId(user, data.branchId);
    if (!authorizedBranchId) {
      return NextResponse.json(
        { error: "Selecciona una sucursal válida para registrar la venta." },
        { status: 400 }
      );
    }

    const db = getDb();

    // 2. Comprobar que la sucursal existe y está activa
    const branchRow = await db
      .select()
      .from(branches)
      .where(eq(branches.id, authorizedBranchId))
      .limit(1);

    if (branchRow.length === 0) {
      return NextResponse.json(
        { error: "La sucursal seleccionada no existe." },
        { status: 404 }
      );
    }
    if (!branchRow[0].isActive) {
      return NextResponse.json(
        {
          error:
            "La sucursal seleccionada se encuentra inactiva. No se pueden registrar nuevas ventas.",
        },
        { status: 400 }
      );
    }

    // 3. Verificar clave de idempotencia (evitar registros duplicados por doble clic o reintentos)
    const existingByKey = await db
      .select()
      .from(salesRecords)
      .where(eq(salesRecords.idempotencyKey, data.idempotencyKey))
      .limit(1);

    if (existingByKey.length > 0) {
      return NextResponse.json({
        ok: true,
        duplicatePrevented: true,
        sale: existingByKey[0],
        message:
          "El registro ya fue procesado (protección de idempotencia activa).",
      });
    }

    const crossesMidnight = doesShiftCrossMidnight(
      data.startTime,
      data.endTime
    );
    const formattedAmount = data.amount.toFixed(2);

    const createdSale = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(salesRecords)
        .values({
          branchId: authorizedBranchId,
          shiftId: data.shiftId || null,
          shiftName: data.shiftName,
          shiftType: data.shiftType,
          operationalDate: data.operationalDate,
          startTime: data.startTime,
          endTime: data.endTime,
          crossesMidnight,
          amount: formattedAmount,
          registeredById: user.id,
          updatedById: user.id,
          status: "ACTIVO",
          observations: data.observations || null,
          idempotencyKey: data.idempotencyKey,
        })
        .returning();

      await tx.insert(salesRecordHistory).values({
        saleId: inserted.id,
        previousAmount: null,
        newAmount: formattedAmount,
        previousStatus: null,
        newStatus: "ACTIVO",
        changedById: user.id,
        reason: "Registro inicial de venta en turno",
        snapshot: inserted,
      });

      return inserted;
    });

    await recordAuditLog({
      userId: user.id,
      branchId: authorizedBranchId,
      module: "VENTAS",
      action: "REGISTRAR_VENTA",
      entityId: createdSale.id,
      description: `Venta registrada por Bs ${formattedAmount} en ${branchRow[0].name} | Fecha operativa: ${data.operationalDate} | Turno: ${data.shiftName} (${data.startTime}-${data.endTime})`,
      newData: createdSale,
    });

    return NextResponse.json(
      {
        ok: true,
        duplicatePrevented: false,
        sale: {
          ...createdSale,
          amount: parseFloat(String(createdSale.amount)),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error en POST /api/sales:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al guardar el registro de venta",
      },
      { status: 500 }
    );
  }
}
