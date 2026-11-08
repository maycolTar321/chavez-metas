import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { salesRecords, salesRecordHistory, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { canUserEditSale, canUserVoidSale } from "@/lib/permissions";
import { saleUpdateSchema } from "@/lib/validations";
import { doesShiftCrossMidnight } from "@/lib/utils";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const db = getDb();
    const history = await db
      .select({
        id: salesRecordHistory.id,
        previousAmount: salesRecordHistory.previousAmount,
        newAmount: salesRecordHistory.newAmount,
        previousStatus: salesRecordHistory.previousStatus,
        newStatus: salesRecordHistory.newStatus,
        changedByName: users.fullName,
        reason: salesRecordHistory.reason,
        createdAt: salesRecordHistory.createdAt,
      })
      .from(salesRecordHistory)
      .innerJoin(users, eq(salesRecordHistory.changedById, users.id))
      .where(eq(salesRecordHistory.saleId, saleId))
      .orderBy(desc(salesRecordHistory.createdAt));

    return NextResponse.json({ history });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al obtener historial del registro",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const saleId = parseInt(id, 10);
    if (isNaN(saleId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = saleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existingList = await db
      .select()
      .from(salesRecords)
      .where(eq(salesRecords.id, saleId))
      .limit(1);

    const existing = existingList[0];
    if (!existing) {
      return NextResponse.json(
        { error: "Registro de venta no encontrado" },
        { status: 404 }
      );
    }

    const { action, reason, amount, operationalDate, shiftName, shiftType, startTime, endTime, observations } =
      parsed.data;

    if (action === "VOID") {
      if (!canUserVoidSale(user, existing.branchId)) {
        return NextResponse.json(
          {
            error:
              "Acceso denegado: No tienes permisos para anular registros de venta en esta sucursal.",
          },
          { status: 403 }
        );
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(salesRecords)
          .set({
            status: "ANULADO",
            voidReason: reason,
            updatedById: user.id,
            updatedAt: new Date(),
          })
          .where(eq(salesRecords.id, saleId))
          .returning();

        await tx.insert(salesRecordHistory).values({
          saleId,
          previousAmount: existing.amount,
          newAmount: existing.amount,
          previousStatus: existing.status,
          newStatus: "ANULADO",
          changedById: user.id,
          reason,
          snapshot: row,
        });

        return row;
      });

      await recordAuditLog({
        userId: user.id,
        branchId: existing.branchId,
        module: "VENTAS",
        action: "ANULAR_VENTA",
        entityId: saleId,
        description: `Se anuló el registro de venta #${saleId} (Bs ${existing.amount}). Motivo: ${reason}`,
        previousData: existing,
        newData: updated,
      });

      return NextResponse.json({ ok: true, sale: updated });
    }

    // Acción EDIT
    if (!canUserEditSale(user, existing.branchId)) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: No tienes permisos para editar registros de venta en esta sucursal.",
        },
        { status: 403 }
      );
    }

    const newAmountStr =
      typeof amount === "number" ? amount.toFixed(2) : existing.amount;
    const newStartTime = startTime || existing.startTime;
    const newEndTime = endTime || existing.endTime;
    const crossesMidnight = doesShiftCrossMidnight(newStartTime, newEndTime);

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(salesRecords)
        .set({
          amount: newAmountStr,
          operationalDate: operationalDate || existing.operationalDate,
          shiftName: shiftName || existing.shiftName,
          shiftType: shiftType || existing.shiftType,
          startTime: newStartTime,
          endTime: newEndTime,
          crossesMidnight,
          observations:
            observations !== undefined ? observations : existing.observations,
          status: "EDITADO",
          updatedById: user.id,
          updatedAt: new Date(),
        })
        .where(eq(salesRecords.id, saleId))
        .returning();

      await tx.insert(salesRecordHistory).values({
        saleId,
        previousAmount: existing.amount,
        newAmount: newAmountStr,
        previousStatus: existing.status,
        newStatus: "EDITADO",
        changedById: user.id,
        reason,
        snapshot: row,
      });

      return row;
    });

    await recordAuditLog({
      userId: user.id,
      branchId: existing.branchId,
      module: "VENTAS",
      action: "EDITAR_VENTA",
      entityId: saleId,
      description: `Se editó el registro de venta #${saleId}: de Bs ${existing.amount} a Bs ${newAmountStr}. Motivo: ${reason}`,
      previousData: existing,
      newData: updated,
    });

    return NextResponse.json({ ok: true, sale: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al modificar el registro de venta",
      },
      { status: 500 }
    );
  }
}
