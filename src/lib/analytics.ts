import { eq, and, gte, lte, desc, sql, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  branches,
  monthlyGoals,
  salesRecords,
  users,
  systemSettings,
  type DailyGoalDistributionMethod,
  type HolidayTreatment,
} from "@/db/schema";
import { getBoliviaNow, getDaysInMonth } from "./utils";
import type { SessionUser } from "./permissions";
import { hasGlobalBranchAccess, resolveAuthorizedBranchId } from "./permissions";
import {
  computeDailyGoalIntelligence,
  type DailyIntelligenceResult,
} from "./daily-goal-engine";

export interface BranchSummaryMetrics {
  branchId: number;
  branchCode: string;
  branchName: string;
  managerName: string;
  isActive: boolean;
  goalAmount: number;
  accumulatedSales: number;
  todaySales: number;
  yesterdaySales: number;
  compliancePercent: number;
  pendingAmount: number;
  surplusAmount: number;
  dailyAverage: number;
  projectedClosing: number;
  requiredDailyRate: number;
  status: "CUMPLIDA" | "EN_CAMINO" | "EN_RIESGO" | "SIN_META";
  salesCount: number;
  dailyIntelligence: DailyIntelligenceResult;
}

export interface DashboardPayload {
  period: {
    month: number;
    year: number;
    todayDate: string;
    yesterdayDate: string;
    daysInMonth: number;
    elapsedDays: number;
    remainingDays: number;
    operationalClosingTime: string;
  };
  isGlobalView: boolean;
  selectedBranchId: number | null;
  globalKpis: {
    activeBranchesCount: number;
    totalMonthlyGoal: number;
    totalAccumulatedSales: number;
    globalCompliancePercent: number;
    totalPendingBalance: number;
    totalSurplusBalance: number;
    todaySales: number;
    yesterdaySales: number;
    branchesFulfilledCount: number;
    branchesPendingCount: number;
    dailyAverageGlobal: number;
    projectedGlobalClosing: number;
  };
  globalDailyIntelligence: DailyIntelligenceResult;
  branchSummaries: BranchSummaryMetrics[];
  topBranches: BranchSummaryMetrics[];
  attentionBranches: BranchSummaryMetrics[];
  dailyEvolution: Array<{
    date: string;
    dayNumber: number;
    dailySales: number;
    cumulativeSales: number;
    idealCumulativeGoal: number;
  }>;
  monthlyEvolution: Array<{
    month: number;
    year: number;
    label: string;
    totalGoal: number;
    totalSales: number;
    compliancePercent: number;
  }>;
  recentSales: Array<{
    id: number;
    branchId: number;
    branchName: string;
    branchCode: string;
    operationalDate: string;
    shiftName: string;
    shiftType: string;
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
    amount: number;
    registeredByName: string;
    status: string;
    createdAt: string;
  }>;
}

export async function getDashboardAnalytics(
  user: SessionUser,
  requestedMonth?: number,
  requestedYear?: number,
  requestedBranchId?: number | null
): Promise<DashboardPayload> {
  const db = getDb();
  const boliviaNow = getBoliviaNow();

  // Obtener configuración global
  const settingsRows = await db.select().from(systemSettings).limit(1);
  const sysConfig = settingsRows[0];
  const operationalClosingTime = sysConfig?.operationalClosingTime || "06:00";
  const defaultMethod: DailyGoalDistributionMethod =
    sysConfig?.defaultDistributionMethod || "UNIFORME";
  const defaultOperatingDays: number[] =
    sysConfig?.defaultOperatingDays || [0, 1, 2, 3, 4, 5, 6];
  const holidayTreatment: HolidayTreatment =
    sysConfig?.holidayTreatment || "NORMAL";
  const globalHolidays: string[] = sysConfig?.holidaysList || [];

  const month = requestedMonth || boliviaNow.month;
  const year = requestedYear || boliviaNow.year;
  const effectiveBranchId = resolveAuthorizedBranchId(user, requestedBranchId) || 1;
  const isGlobalView = false;

  const daysInMonth = getDaysInMonth(year, month);
  const isCurrentMonth =
    year === boliviaNow.year && month === boliviaNow.month;
  const elapsedDays = isCurrentMonth
    ? Math.max(1, boliviaNow.day)
    : daysInMonth;
  const remainingDays = isCurrentMonth
    ? Math.max(0, daysInMonth - boliviaNow.day)
    : 0;

  const todayDate = boliviaNow.dateStr;
  const [ty, tm, td] = todayDate.split("-").map(Number);
  const yestObj = new Date(Date.UTC(ty, tm - 1, td));
  yestObj.setUTCDate(yestObj.getUTCDate() - 1);
  const yesterdayDate = yestObj.toISOString().split("T")[0];

  const startOfMonthDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonthDate = `${year}-${String(month).padStart(2, "0")}-${String(
    daysInMonth
  ).padStart(2, "0")}`;

  // 1. Obtener sucursales
  const allBranches = await db
    .select()
    .from(branches)
    .where(effectiveBranchId ? eq(branches.id, effectiveBranchId) : undefined)
    .orderBy(branches.code);

  // 2. Obtener metas del mes/año seleccionado
  const goalsForPeriod = await db
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

  const goalRecordByBranch = new Map(
    goalsForPeriod.map((g) => [g.branchId, g])
  );

  // 3. Obtener ventas activas/editadas del mes seleccionado
  const salesInMonth = await db
    .select({
      id: salesRecords.id,
      branchId: salesRecords.branchId,
      operationalDate: salesRecords.operationalDate,
      amount: salesRecords.amount,
      status: salesRecords.status,
    })
    .from(salesRecords)
    .where(
      and(
        gte(salesRecords.operationalDate, startOfMonthDate),
        lte(salesRecords.operationalDate, endOfMonthDate),
        ne(salesRecords.status, "ANULADO"),
        effectiveBranchId
          ? eq(salesRecords.branchId, effectiveBranchId)
          : undefined
      )
    );

  const salesTodayYesterday = await db
    .select({
      branchId: salesRecords.branchId,
      operationalDate: salesRecords.operationalDate,
      amount: salesRecords.amount,
    })
    .from(salesRecords)
    .where(
      and(
        gte(salesRecords.operationalDate, yesterdayDate),
        lte(salesRecords.operationalDate, todayDate),
        ne(salesRecords.status, "ANULADO"),
        effectiveBranchId
          ? eq(salesRecords.branchId, effectiveBranchId)
          : undefined
      )
    );

  const todayByBranch = new Map<number, number>();
  const yesterdayByBranch = new Map<number, number>();

  for (const s of salesTodayYesterday) {
    const val = parseFloat(String(s.amount || 0));
    const opDate = String(s.operationalDate);
    if (opDate === todayDate) {
      todayByBranch.set(s.branchId, (todayByBranch.get(s.branchId) || 0) + val);
    } else if (opDate === yesterdayDate) {
      yesterdayByBranch.set(
        s.branchId,
        (yesterdayByBranch.get(s.branchId) || 0) + val
      );
    }
  }

  const salesByBranch = new Map<number, { sum: number; count: number }>();
  const salesByBranchAndDate = new Map<number, Map<string, number>>();
  const salesByDayGlobal = new Map<string, number>();

  for (const s of salesInMonth) {
    const val = parseFloat(String(s.amount || 0));
    const current = salesByBranch.get(s.branchId) || { sum: 0, count: 0 };
    current.sum += val;
    current.count += 1;
    salesByBranch.set(s.branchId, current);

    const opDate = String(s.operationalDate);
    salesByDayGlobal.set(opDate, (salesByDayGlobal.get(opDate) || 0) + val);

    if (!salesByBranchAndDate.has(s.branchId)) {
      salesByBranchAndDate.set(s.branchId, new Map<string, number>());
    }
    const bDateMap = salesByBranchAndDate.get(s.branchId)!;
    bDateMap.set(opDate, (bDateMap.get(opDate) || 0) + val);
  }

  const branchSummaries: BranchSummaryMetrics[] = [];
  let totalMonthlyGoal = 0;
  let totalAccumulatedSales = 0;
  let totalPendingBalance = 0;
  let totalSurplusBalance = 0;
  let todaySalesGlobal = 0;
  let yesterdaySalesGlobal = 0;
  let branchesFulfilledCount = 0;
  let branchesPendingCount = 0;
  let activeBranchesCount = 0;

  const expectedProgressRatio = elapsedDays / daysInMonth;

  for (const b of allBranches) {
    if (b.isActive) activeBranchesCount++;
    const goalRecord = goalRecordByBranch.get(b.id);
    const goalAmount = goalRecord
      ? parseFloat(String(goalRecord.goalAmount || 0))
      : 0;
    const branchSaleData = salesByBranch.get(b.id) || { sum: 0, count: 0 };
    const accumulatedSales = Number(branchSaleData.sum.toFixed(2));
    const bToday = Number((todayByBranch.get(b.id) || 0).toFixed(2));
    const bYesterday = Number((yesterdayByBranch.get(b.id) || 0).toFixed(2));

    const branchDateMap =
      salesByBranchAndDate.get(b.id) || new Map<string, number>();

    const dailyIntel = computeDailyGoalIntelligence({
      year,
      month,
      monthlyGoalAmount: goalAmount,
      distributionMethod: goalRecord?.distributionMethod || defaultMethod,
      operatingDaysMask:
        goalRecord?.operatingDaysMask ||
        b.operatingDaysOfWeek ||
        defaultOperatingDays,
      customDailyTargets: goalRecord?.customDailyTargets || {},
      holidays:
        goalRecord?.holidays && goalRecord.holidays.length > 0
          ? goalRecord.holidays
          : globalHolidays,
      holidayTreatment,
      salesByDate: branchDateMap,
      currentOperationalDate: todayDate,
      msgTemplateCaseA: sysConfig?.motivationalMsgCaseA,
      msgTemplateCaseB: sysConfig?.motivationalMsgCaseB,
      msgTemplateCaseC: sysConfig?.motivationalMsgCaseC,
    });

    const compliancePercent =
      goalAmount > 0
        ? Number(((accumulatedSales / goalAmount) * 100).toFixed(2))
        : 0;

    const pendingAmount =
      goalAmount > accumulatedSales
        ? Number((goalAmount - accumulatedSales).toFixed(2))
        : 0;

    const surplusAmount =
      accumulatedSales > goalAmount && goalAmount > 0
        ? Number((accumulatedSales - goalAmount).toFixed(2))
        : 0;

    const dailyAverage =
      elapsedDays > 0
        ? Number((accumulatedSales / elapsedDays).toFixed(2))
        : 0;
    const projectedClosing = Number((dailyAverage * daysInMonth).toFixed(2));
    const requiredDailyRate = dailyIntel.adjustedNextDaysTarget;

    let status: BranchSummaryMetrics["status"] = "SIN_META";
    if (goalAmount > 0) {
      if (accumulatedSales >= goalAmount) {
        status = "CUMPLIDA";
        branchesFulfilledCount++;
      } else {
        branchesPendingCount++;
        const expectedAtToday = goalAmount * expectedProgressRatio * 0.8;
        status =
          accumulatedSales >= expectedAtToday ? "EN_CAMINO" : "EN_RIESGO";
      }
    } else if (b.isActive) {
      branchesPendingCount++;
    }

    totalMonthlyGoal += goalAmount;
    totalAccumulatedSales += accumulatedSales;
    totalPendingBalance += pendingAmount;
    totalSurplusBalance += surplusAmount;
    todaySalesGlobal += bToday;
    yesterdaySalesGlobal += bYesterday;

    branchSummaries.push({
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name,
      managerName: b.managerName,
      isActive: b.isActive,
      goalAmount,
      accumulatedSales,
      todaySales: bToday,
      yesterdaySales: bYesterday,
      compliancePercent,
      pendingAmount,
      surplusAmount,
      dailyAverage,
      projectedClosing,
      requiredDailyRate,
      status,
      salesCount: branchSaleData.count,
      dailyIntelligence: dailyIntel,
    });
  }

  // Inteligencia Diaria Global Consolidada (o de la única sucursal seleccionada)
  const globalDailyIntelligence =
    branchSummaries.length === 1
      ? branchSummaries[0].dailyIntelligence
      : computeDailyGoalIntelligence({
          year,
          month,
          monthlyGoalAmount: Number(totalMonthlyGoal.toFixed(2)),
          distributionMethod: defaultMethod,
          operatingDaysMask: defaultOperatingDays,
          customDailyTargets: {},
          holidays: globalHolidays,
          holidayTreatment,
          salesByDate: salesByDayGlobal,
          currentOperationalDate: todayDate,
          msgTemplateCaseA: sysConfig?.motivationalMsgCaseA,
          msgTemplateCaseB: sysConfig?.motivationalMsgCaseB,
          msgTemplateCaseC: sysConfig?.motivationalMsgCaseC,
        });

  const globalCompliancePercent =
    totalMonthlyGoal > 0
      ? Number(((totalAccumulatedSales / totalMonthlyGoal) * 100).toFixed(2))
      : 0;

  const dailyAverageGlobal =
    elapsedDays > 0
      ? Number((totalAccumulatedSales / elapsedDays).toFixed(2))
      : 0;
  const projectedGlobalClosing = Number(
    (dailyAverageGlobal * daysInMonth).toFixed(2)
  );

  // Evolución diaria del mes
  const dailyEvolution: DashboardPayload["dailyEvolution"] = [];
  let runningCumulative = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    const dayVal = Number((salesByDayGlobal.get(dateKey) || 0).toFixed(2));
    runningCumulative = Number((runningCumulative + dayVal).toFixed(2));
    const idealCumulativeGoal = Number(
      ((totalMonthlyGoal / daysInMonth) * d).toFixed(2)
    );
    dailyEvolution.push({
      date: dateKey,
      dayNumber: d,
      dailySales: dayVal,
      cumulativeSales: runningCumulative,
      idealCumulativeGoal,
    });
  }

  const sortedByCompliance = [...branchSummaries]
    .filter((b) => b.isActive)
    .sort(
      (a, b) =>
        b.compliancePercent - a.compliancePercent ||
        b.accumulatedSales - a.accumulatedSales
    );

  const topBranches = sortedByCompliance.slice(0, 5);
  const attentionBranches = [...branchSummaries]
    .filter((b) => b.isActive && b.status !== "CUMPLIDA")
    .sort((a, b) => a.compliancePercent - b.compliancePercent)
    .slice(0, 5);

  const monthlyEvolution: DashboardPayload["monthlyEvolution"] = [];
  const shortMonths = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const mDays = getDaysInMonth(y, m);
    const mStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const mEnd = `${y}-${String(m).padStart(2, "0")}-${String(mDays).padStart(
      2,
      "0"
    )}`;

    const [goalAgg] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${monthlyGoals.goalAmount}), 0)`,
      })
      .from(monthlyGoals)
      .where(
        and(
          eq(monthlyGoals.month, m),
          eq(monthlyGoals.year, y),
          effectiveBranchId
            ? eq(monthlyGoals.branchId, effectiveBranchId)
            : undefined
        )
      );

    const [salesAgg] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${salesRecords.amount}), 0)`,
      })
      .from(salesRecords)
      .where(
        and(
          gte(salesRecords.operationalDate, mStart),
          lte(salesRecords.operationalDate, mEnd),
          ne(salesRecords.status, "ANULADO"),
          effectiveBranchId
            ? eq(salesRecords.branchId, effectiveBranchId)
            : undefined
        )
      );

    const gVal = parseFloat(goalAgg?.total || "0");
    const sVal = parseFloat(salesAgg?.total || "0");
    const comp = gVal > 0 ? Number(((sVal / gVal) * 100).toFixed(1)) : 0;

    monthlyEvolution.push({
      month: m,
      year: y,
      label: `${shortMonths[m - 1]} ${y}`,
      totalGoal: Number(gVal.toFixed(2)),
      totalSales: Number(sVal.toFixed(2)),
      compliancePercent: comp,
    });
  }

  const recentRaw = await db
    .select({
      id: salesRecords.id,
      branchId: salesRecords.branchId,
      branchName: branches.name,
      branchCode: branches.code,
      operationalDate: salesRecords.operationalDate,
      shiftName: salesRecords.shiftName,
      shiftType: salesRecords.shiftType,
      startTime: salesRecords.startTime,
      endTime: salesRecords.endTime,
      crossesMidnight: salesRecords.crossesMidnight,
      amount: salesRecords.amount,
      registeredByName: users.fullName,
      status: salesRecords.status,
      createdAt: salesRecords.createdAt,
    })
    .from(salesRecords)
    .innerJoin(branches, eq(salesRecords.branchId, branches.id))
    .innerJoin(users, eq(salesRecords.registeredById, users.id))
    .where(
      effectiveBranchId ? eq(salesRecords.branchId, effectiveBranchId) : undefined
    )
    .orderBy(desc(salesRecords.createdAt))
    .limit(12);

  return {
    period: {
      month,
      year,
      todayDate,
      yesterdayDate,
      daysInMonth,
      elapsedDays,
      remainingDays,
      operationalClosingTime,
    },
    isGlobalView,
    selectedBranchId: effectiveBranchId,
    globalKpis: {
      activeBranchesCount,
      totalMonthlyGoal: Number(totalMonthlyGoal.toFixed(2)),
      totalAccumulatedSales: Number(totalAccumulatedSales.toFixed(2)),
      globalCompliancePercent,
      totalPendingBalance: Number(totalPendingBalance.toFixed(2)),
      totalSurplusBalance: Number(totalSurplusBalance.toFixed(2)),
      todaySales: Number(todaySalesGlobal.toFixed(2)),
      yesterdaySales: Number(yesterdaySalesGlobal.toFixed(2)),
      branchesFulfilledCount,
      branchesPendingCount,
      dailyAverageGlobal,
      projectedGlobalClosing,
    },
    globalDailyIntelligence,
    branchSummaries,
    topBranches,
    attentionBranches,
    dailyEvolution,
    monthlyEvolution,
    recentSales: recentRaw.map((r) => ({
      ...r,
      operationalDate: String(r.operationalDate),
      amount: parseFloat(String(r.amount)),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
