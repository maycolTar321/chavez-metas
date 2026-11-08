import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, ne, desc, asc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  monthlyGoals,
  monthlyGoalHistory,
  branches,
  salesRecords,
  users,
  systemSettings,
  type DailyGoalDistributionMethod,
  type HolidayTreatment,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveAuthorizedBranchId,
  canUserManageGoals,
} from "@/lib/permissions";
import { monthlyGoalSchema } from "@/lib/validations";
import { getBoliviaNow, getDaysInMonth } from "@/lib/utils";
import { recordAuditLog } from "@/lib/audit";
import { computeDailyGoalIntelligence } from "@/lib/daily-goal-engine";

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
    const db = getDb();

    const settingsRows = await db.select().from(systemSettings).limit(1);
    const sysConfig = settingsRows[0];
    const defaultMethod: DailyGoalDistributionMethod =
      sysConfig?.defaultDistributionMethod || "UNIFORME";
    const defaultOperatingDays: number[] =
      sysConfig?.defaultOperatingDays || [0, 1, 2, 3, 4, 5, 6];
    const holidayTreatment: HolidayTreatment =
      sysConfig?.holidayTreatment || "NORMAL";
    const globalHolidays: string[] = sysConfig?.holidaysList || [];

    const branchList = await db
      .select()
      .from(branches)
      .where(effectiveBranchId ? eq(branches.id, effectiveBranchId) : undefined)
      .orderBy(asc(branches.code));

    const goals = await db
      .select({
        id: monthlyGoals.id,
        branchId: monthlyGoals.branchId,
        month: monthlyGoals.month,
        year: monthlyGoals.year,
        goalAmount: monthlyGoals.goalAmount,
        distributionMethod: monthlyGoals.distributionMethod,
        operatingDaysMask: monthlyGoals.operatingDaysMask,
        customDailyTargets: monthlyGoals.customDailyTargets,
        holidays: monthlyGoals.holidays,
        observations: monthlyGoals.observations,
        createdAt: monthlyGoals.createdAt,
        updatedAt: monthlyGoals.updatedAt,
        responsibleName: users.fullName,
      })
      .from(monthlyGoals)
      .leftJoin(users, eq(monthlyGoals.createdById, users.id))
      .where(
        and(
          eq(monthlyGoals.month, month),
          eq(monthlyGoals.year, year),
          effectiveBranchId
            ? eq(monthlyGoals.branchId, effectiveBranchId)
            : undefined
        )
      );

    const daysInMonth = getDaysInMonth(year, month);
    const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;

    const sales = await db
      .select({
        branchId: salesRecords.branchId,
        operationalDate: salesRecords.operationalDate,
        amount: salesRecords.amount,
      })
      .from(salesRecords)
      .where(
        and(
          gte(salesRecords.operationalDate, startOfMonth),
          lte(salesRecords.operationalDate, endOfMonth),
          ne(salesRecords.status, "ANULADO"),
          effectiveBranchId
            ? eq(salesRecords.branchId, effectiveBranchId)
            : undefined
        )
      );

    const salesByBranch = new Map<number, number>();
    const salesByBranchAndDate = new Map<number, Map<string, number>>();

    for (const s of sales) {
      const val = parseFloat(String(s.amount || 0));
      const opDate = String(s.operationalDate);
      salesByBranch.set(s.branchId, (salesByBranch.get(s.branchId) || 0) + val);

      if (!salesByBranchAndDate.has(s.branchId)) {
        salesByBranchAndDate.set(s.branchId, new Map<string, number>());
      }
      const bDateMap = salesByBranchAndDate.get(s.branchId)!;
      bDateMap.set(opDate, (bDateMap.get(opDate) || 0) + val);
    }

    const goalByBranch = new Map(goals.map((g) => [g.branchId, g]));

    const rows = branchList.map((b) => {
      const g = goalByBranch.get(b.id);
      const goalAmount = g ? parseFloat(String(g.goalAmount)) : 0;
      const salesAmount = Number((salesByBranch.get(b.id) || 0).toFixed(2));
      const compliance =
        goalAmount > 0
          ? Number(((salesAmount / goalAmount) * 100).toFixed(2))
          : 0;
      const pending =
        goalAmount > salesAmount
          ? Number((goalAmount - salesAmount).toFixed(2))
          : 0;
      const surplus =
        salesAmount > goalAmount && goalAmount > 0
          ? Number((salesAmount - goalAmount).toFixed(2))
          : 0;

      let status = "SIN_META";
      if (goalAmount > 0) {
        if (salesAmount >= goalAmount) status = "CUMPLIDA";
        else if (compliance >= 75) status = "EN_CAMINO";
        else status = "PENDIENTE";
      }

      const bDateMap =
        salesByBranchAndDate.get(b.id) || new Map<string, number>();

      const dailyIntel = computeDailyGoalIntelligence({
        year,
        month,
        monthlyGoalAmount: goalAmount,
        distributionMethod: g?.distributionMethod || defaultMethod,
        operatingDaysMask:
          g?.operatingDaysMask || b.operatingDaysOfWeek || defaultOperatingDays,
        customDailyTargets: g?.customDailyTargets || {},
        holidays:
          g?.holidays && g.holidays.length > 0 ? g.holidays : globalHolidays,
        holidayTreatment,
        salesByDate: bDateMap,
        currentOperationalDate: boliviaNow.dateStr,
        msgTemplateCaseA: sysConfig?.motivationalMsgCaseA,
        msgTemplateCaseB: sysConfig?.motivationalMsgCaseB,
        msgTemplateCaseC: sysConfig?.motivationalMsgCaseC,
      });

      return {
        goalId: g?.id || null,
        branchId: b.id,
        branchCode: b.code,
        branchName: b.name,
        isActiveBranch: b.isActive,
        month,
        year,
        goalAmount,
        distributionMethod: g?.distributionMethod || defaultMethod,
        operatingDaysMask:
          g?.operatingDaysMask || b.operatingDaysOfWeek || defaultOperatingDays,
        customDailyTargets: g?.customDailyTargets || {},
        holidays: g?.holidays || [],
        salesAmount,
        compliancePercent: compliance,
        pendingAmount: pending,
        surplusAmount: surplus,
        status,
        responsibleName: g?.responsibleName || "No asignada",
        observations: g?.observations || "",
        updatedAt: g?.updatedAt || null,
        dailyIntelligence: dailyIntel,
      };
    });

    const history = await db
      .select({
        id: monthlyGoalHistory.id,
        goalId: monthlyGoalHistory.goalId,
        branchName: branches.name,
        branchCode: branches.code,
        month: monthlyGoalHistory.month,
        year: monthlyGoalHistory.year,
        previousAmount: monthlyGoalHistory.previousAmount,
        newAmount: monthlyGoalHistory.newAmount,
        changedByName: users.fullName,
        reason: monthlyGoalHistory.reason,
        createdAt: monthlyGoalHistory.createdAt,
      })
      .from(monthlyGoalHistory)
      .innerJoin(branches, eq(monthlyGoalHistory.branchId, branches.id))
      .innerJoin(users, eq(monthlyGoalHistory.changedById, users.id))
      .where(
        effectiveBranchId
          ? eq(monthlyGoalHistory.branchId, effectiveBranchId)
          : undefined
      )
      .orderBy(desc(monthlyGoalHistory.createdAt))
      .limit(25);

    return NextResponse.json({
      period: { month, year },
      rows,
      history,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al consultar metas mensuales",
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

    const body = await req.json();
    const parsed = monthlyGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const {
      branchId,
      month,
      year,
      goalAmount,
      distributionMethod,
      operatingDaysMask,
      customDailyTargets,
      holidays,
      observations,
      reason,
    } = parsed.data;

    if (!canUserManageGoals(user, branchId)) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: No tienes permisos para establecer o modificar metas mensuales.",
        },
        { status: 403 }
      );
    }

    const db = getDb();
    const formattedGoal = goalAmount.toFixed(2);

    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(monthlyGoals)
        .where(
          and(
            eq(monthlyGoals.branchId, branchId),
            eq(monthlyGoals.month, month),
            eq(monthlyGoals.year, year)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const current = existing[0];
        const [updated] = await tx
          .update(monthlyGoals)
          .set({
            goalAmount: formattedGoal,
            distributionMethod:
              distributionMethod || current.distributionMethod,
            operatingDaysMask: operatingDaysMask || current.operatingDaysMask,
            customDailyTargets:
              customDailyTargets || current.customDailyTargets,
            holidays: holidays || current.holidays,
            updatedById: user.id,
            observations: observations ?? current.observations,
            updatedAt: new Date(),
          })
          .where(eq(monthlyGoals.id, current.id))
          .returning();

        await tx.insert(monthlyGoalHistory).values({
          goalId: current.id,
          branchId,
          month,
          year,
          previousAmount: current.goalAmount,
          newAmount: formattedGoal,
          changedById: user.id,
          reason:
            reason ||
            observations ||
            `Actualización de meta mensual (${distributionMethod})`,
        });

        return { action: "MODIFICAR_META", record: updated, previous: current };
      } else {
        const [created] = await tx
          .insert(monthlyGoals)
          .values({
            branchId,
            month,
            year,
            goalAmount: formattedGoal,
            distributionMethod: distributionMethod || "UNIFORME",
            operatingDaysMask: operatingDaysMask || [0, 1, 2, 3, 4, 5, 6],
            customDailyTargets: customDailyTargets || {},
            holidays: holidays || [],
            createdById: user.id,
            updatedById: user.id,
            isActive: true,
            observations: observations || null,
          })
          .returning();

        await tx.insert(monthlyGoalHistory).values({
          goalId: created.id,
          branchId,
          month,
          year,
          previousAmount: null,
          newAmount: formattedGoal,
          changedById: user.id,
          reason:
            reason ||
            observations ||
            `Asignación inicial de meta mensual (${distributionMethod})`,
        });

        return { action: "CREAR_META", record: created, previous: null };
      }
    });

    await recordAuditLog({
      userId: user.id,
      branchId,
      module: "METAS_MENSUALES",
      action: result.action,
      entityId: result.record.id,
      description: `Meta mensual (${month}/${year}) establecida en Bs ${formattedGoal} [Método: ${result.record.distributionMethod}] para sucursal #${branchId}`,
      previousData: result.previous,
      newData: result.record,
    });

    return NextResponse.json({ ok: true, goal: result.record });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al guardar la meta mensual",
      },
      { status: 500 }
    );
  }
}
