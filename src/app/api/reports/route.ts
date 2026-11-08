import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, ne, sql, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { salesRecords, users, branches, monthlyGoals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { resolveAuthorizedBranchId } from "@/lib/permissions";
import { getBoliviaNow, getDaysInMonth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const boliviaNow = getBoliviaNow();
    const month = parseInt(
      searchParams.get("month") || String(boliviaNow.month),
      10
    );
    const year = parseInt(
      searchParams.get("year") || String(boliviaNow.year),
      10
    );
    const reqBranchId = searchParams.get("branchId")
      ? parseInt(searchParams.get("branchId")!, 10)
      : null;

    const effectiveBranchId = resolveAuthorizedBranchId(user, reqBranchId);
    const daysInMonth = getDaysInMonth(year, month);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;

    const db = getDb();

    // 1. Rendimiento por trabajador (ventas registradas en el mes)
    const workerStats = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        username: users.username,
        role: users.role,
        branchName: branches.name,
        branchCode: branches.code,
        totalSales: sql<string>`COALESCE(SUM(${salesRecords.amount}), 0)`,
        recordsCount: sql<number>`COUNT(${salesRecords.id})`,
        averageTicket: sql<string>`COALESCE(AVG(${salesRecords.amount}), 0)`,
      })
      .from(salesRecords)
      .innerJoin(users, eq(salesRecords.registeredById, users.id))
      .innerJoin(branches, eq(salesRecords.branchId, branches.id))
      .where(
        and(
          gte(salesRecords.operationalDate, startDate),
          lte(salesRecords.operationalDate, endDate),
          ne(salesRecords.status, "ANULADO"),
          effectiveBranchId
            ? eq(salesRecords.branchId, effectiveBranchId)
            : undefined
        )
      )
      .groupBy(
        users.id,
        users.fullName,
        users.username,
        users.role,
        branches.name,
        branches.code
      )
      .orderBy(desc(sql`SUM(${salesRecords.amount})`));

    // 2. Rendimiento por tipo de turno (Mañana, Tarde, Noche 24h, Personalizado)
    const shiftStats = await db
      .select({
        shiftType: salesRecords.shiftType,
        totalSales: sql<string>`COALESCE(SUM(${salesRecords.amount}), 0)`,
        recordsCount: sql<number>`COUNT(${salesRecords.id})`,
        averageSale: sql<string>`COALESCE(AVG(${salesRecords.amount}), 0)`,
      })
      .from(salesRecords)
      .where(
        and(
          gte(salesRecords.operationalDate, startDate),
          lte(salesRecords.operationalDate, endDate),
          ne(salesRecords.status, "ANULADO"),
          effectiveBranchId
            ? eq(salesRecords.branchId, effectiveBranchId)
            : undefined
        )
      )
      .groupBy(salesRecords.shiftType);

    // 3. Resumen comparativo por sucursal
    const branchList = await db
      .select()
      .from(branches)
      .where(effectiveBranchId ? eq(branches.id, effectiveBranchId) : undefined);

    const goals = await db
      .select()
      .from(monthlyGoals)
      .where(
        and(
          eq(monthlyGoals.month, month),
          eq(monthlyGoals.year, year),
          effectiveBranchId
            ? eq(monthlyGoals.branchId, effectiveBranchId)
            : undefined
        )
      );

    const branchSalesAgg = await db
      .select({
        branchId: salesRecords.branchId,
        totalSales: sql<string>`COALESCE(SUM(${salesRecords.amount}), 0)`,
        recordsCount: sql<number>`COUNT(${salesRecords.id})`,
      })
      .from(salesRecords)
      .where(
        and(
          gte(salesRecords.operationalDate, startDate),
          lte(salesRecords.operationalDate, endDate),
          ne(salesRecords.status, "ANULADO"),
          effectiveBranchId
            ? eq(salesRecords.branchId, effectiveBranchId)
            : undefined
        )
      )
      .groupBy(salesRecords.branchId);

    const goalMap = new Map(
      goals.map((g) => [g.branchId, parseFloat(String(g.goalAmount))])
    );
    const salesMap = new Map(
      branchSalesAgg.map((s) => [
        s.branchId,
        {
          total: parseFloat(String(s.totalSales)),
          count: Number(s.recordsCount),
        },
      ])
    );

    const branchPerformance = branchList
      .map((b) => {
        const goal = goalMap.get(b.id) || 0;
        const saleObj = salesMap.get(b.id) || { total: 0, count: 0 };
        const compliance =
          goal > 0 ? Number(((saleObj.total / goal) * 100).toFixed(2)) : 0;
        return {
          branchId: b.id,
          branchCode: b.code,
          branchName: b.name,
          managerName: b.managerName,
          isActive: b.isActive,
          goalAmount: goal,
          salesAmount: Number(saleObj.total.toFixed(2)),
          recordsCount: saleObj.count,
          compliancePercent: compliance,
          pendingAmount:
            goal > saleObj.total
              ? Number((goal - saleObj.total).toFixed(2))
              : 0,
          surplusAmount:
            saleObj.total > goal && goal > 0
              ? Number((saleObj.total - goal).toFixed(2))
              : 0,
        };
      })
      .sort((a, b) => b.compliancePercent - a.compliancePercent);

    return NextResponse.json({
      period: { month, year, startDate, endDate },
      workerPerformance: workerStats.map((w) => ({
        ...w,
        totalSales: parseFloat(String(w.totalSales)),
        recordsCount: Number(w.recordsCount),
        averageTicket: parseFloat(String(w.averageTicket)),
      })),
      shiftPerformance: shiftStats.map((s) => ({
        shiftType: s.shiftType,
        totalSales: parseFloat(String(s.totalSales)),
        recordsCount: Number(s.recordsCount),
        averageSale: parseFloat(String(s.averageSale)),
      })),
      branchPerformance,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al generar reporte de rendimiento",
      },
      { status: 500 }
    );
  }
}
