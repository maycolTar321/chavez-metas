import { formatBOB, getDaysInMonth } from "./utils";
import type {
  DailyGoalDistributionMethod,
  HolidayTreatment,
} from "@/db/schema";

export interface DailyGoalConfigInput {
  year: number;
  month: number;
  monthlyGoalAmount: number;
  distributionMethod: DailyGoalDistributionMethod;
  operatingDaysMask: number[]; // 0 (Dom) a 6 (Sáb)
  customDailyTargets?: Record<string, number>;
  holidays?: string[]; // ["YYYY-MM-DD"]
  holidayTreatment?: HolidayTreatment;
  salesByDate: Map<string, number>; // "YYYY-MM-DD" -> monto vendido
  currentOperationalDate: string; // "YYYY-MM-DD" (considerando hora de cierre operativo 24h)
  msgTemplateCaseA?: string;
  msgTemplateCaseB?: string;
  msgTemplateCaseC?: string;
}

export interface DailyIntelligenceResult {
  monthlyGoalAmount: number;
  distributionMethod: DailyGoalDistributionMethod;
  totalOperatingDaysInMonth: number;
  elapsedOperatingDays: number;
  remainingOperatingDays: number;

  // Hoy
  todayDate: string;
  todayBaseTarget: number; // Meta diaria estimada de referencia (ej. Bs 1.666,67)
  todaySales: number; // Venta acumulada del día
  todayDifference: number; // todaySales - todayBaseTarget (positivo = excedente hoy, negativo = faltante hoy)
  todayPending: number; // Cuánto falta hoy para llegar a todayBaseTarget
  todaySurplus: number; // Cuánto superó hoy respecto a todayBaseTarget
  todayCompliancePercent: number;

  // Saldo Acumulado (entre lo que se debía vender hasta hoy y lo que realmente se vendió)
  expectedCumulativeUntilToday: number;
  actualCumulativeUntilToday: number;
  totalAccumulatedMonthSales: number;
  cumulativeBalance: number; // Positivo = Saldo a favor acumulado; Negativo = Saldo pendiente acumulado
  hasPositiveCumulativeBalance: boolean;

  // Ajuste automático de los próximos días
  pendingMonthlyAmount: number; // Meta mensual - Ventas acumuladas del mes
  monthlySurplusAmount: number;
  isMonthlyGoalFulfilled: boolean;
  adjustedNextDaysTarget: number; // Nueva meta diaria necesaria para los días restantes
  adjustmentExplanation: string;

  // Motivación y Estado Visual
  visualStatus: "VERDE" | "NARANJA" | "AZUL";
  caseType: "CASO_A" | "CASO_B" | "CASO_C" | "META_MENSUAL_CUMPLIDA";
  primaryMotivationalMessage: string;
  cumulativeBalanceMessage: string;
  closingDaySummaryText: string;

  // Desglose día por día del mes
  dailySchedule: Array<{
    date: string;
    dayNumber: number;
    dayOfWeek: number;
    isOperatingDay: boolean;
    isHoliday: boolean;
    baseTarget: number;
    actualSales: number;
    dailyDiff: number;
    runningExpected: number;
    runningActual: number;
    runningBalance: number;
  }>;
}

const DEFAULT_MSG_A =
  "¡Vamos, todavía podemos mejorar! Hoy nos faltaron {diferencia} para alcanzar nuestra meta diaria. Mañana tenemos una nueva oportunidad. ¡Esfuérzate, tú puedes!";
const DEFAULT_MSG_B =
  "¡Excelente trabajo! Alcanzamos nuestra meta diaria. Cada esfuerzo cuenta y estamos avanzando hacia nuestro objetivo mensual. ¡Sigamos así!";
const DEFAULT_MSG_C =
  "¡BARBARO! ¡Hoy superamos nuestra meta diaria! Tenemos {excedente} de saldo a favor. Ese excedente nos ayuda a cubrir los próximos días. ¡Sigue así!";

export function computeDailyGoalIntelligence(
  input: DailyGoalConfigInput
): DailyIntelligenceResult {
  const {
    year,
    month,
    monthlyGoalAmount,
    distributionMethod,
    operatingDaysMask,
    customDailyTargets = {},
    holidays = [],
    holidayTreatment = "NORMAL",
    salesByDate,
    currentOperationalDate,
    msgTemplateCaseA = DEFAULT_MSG_A,
    msgTemplateCaseB = DEFAULT_MSG_B,
    msgTemplateCaseC = DEFAULT_MSG_C,
  } = input;

  const daysInMonth = getDaysInMonth(year, month);
  const mask =
    Array.isArray(operatingDaysMask) && operatingDaysMask.length > 0
      ? operatingDaysMask
      : [0, 1, 2, 3, 4, 5, 6];
  const holidaySet = new Set(holidays || []);

  // 1. Determinar el peso operativo de cada día del mes
  const dayWeights: Array<{
    date: string;
    dayNumber: number;
    dayOfWeek: number;
    weight: number;
    isOperatingDay: boolean;
    isHoliday: boolean;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    const dayOfWeek = dateObj.getUTCDay();
    const isHoliday = holidaySet.has(dateStr);

    let weight = 1;
    if (distributionMethod === "DIAS_OPERATIVOS") {
      weight = mask.includes(dayOfWeek) ? 1 : 0;
    }

    if (isHoliday && weight > 0) {
      if (holidayTreatment === "EXCLUIR") {
        weight = 0;
      } else if (holidayTreatment === "META_REDUCIDA_50") {
        weight = 0.5;
      }
    }

    dayWeights.push({
      date: dateStr,
      dayNumber: d,
      dayOfWeek,
      weight,
      isOperatingDay: weight > 0,
      isHoliday,
    });
  }

  const totalWeight = dayWeights.reduce((acc, item) => acc + item.weight, 0);
  const safeTotalWeight = totalWeight > 0 ? totalWeight : daysInMonth;

  // 2. Asignar meta diaria base (sin alterar la meta mensual original)
  let runningExpected = 0;
  let runningActual = 0;
  let totalAccumulatedMonthSales = 0;

  const dailySchedule: DailyIntelligenceResult["dailySchedule"] = [];

  for (const item of dayWeights) {
    let baseTarget = 0;
    if (
      distributionMethod === "PERSONALIZADO" &&
      customDailyTargets &&
      typeof customDailyTargets[item.date] === "number"
    ) {
      baseTarget = Number(customDailyTargets[item.date].toFixed(2));
    } else if (
      distributionMethod === "PERSONALIZADO" &&
      customDailyTargets &&
      typeof customDailyTargets[String(item.dayNumber)] === "number"
    ) {
      baseTarget = Number(
        customDailyTargets[String(item.dayNumber)].toFixed(2)
      );
    } else {
      const weightToUse =
        totalWeight > 0 ? item.weight : 1;
      baseTarget =
        monthlyGoalAmount > 0
          ? Number(((monthlyGoalAmount * weightToUse) / safeTotalWeight).toFixed(2))
          : 0;
    }

    const actualSales = Number((salesByDate.get(item.date) || 0).toFixed(2));
    totalAccumulatedMonthSales = Number(
      (totalAccumulatedMonthSales + actualSales).toFixed(2)
    );

    const dailyDiff = Number((actualSales - baseTarget).toFixed(2));
    runningExpected = Number((runningExpected + baseTarget).toFixed(2));
    runningActual = Number((runningActual + actualSales).toFixed(2));
    const runningBalance = Number((runningActual - runningExpected).toFixed(2));

    dailySchedule.push({
      date: item.date,
      dayNumber: item.dayNumber,
      dayOfWeek: item.dayOfWeek,
      isOperatingDay: item.isOperatingDay,
      isHoliday: item.isHoliday,
      baseTarget,
      actualSales,
      dailyDiff,
      runningExpected,
      runningActual,
      runningBalance,
    });
  }

  // Determinar qué día del calendario estamos evaluando
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  let activeDate = currentOperationalDate;
  if (!currentOperationalDate.startsWith(monthPrefix)) {
    // Si se consulta un mes pasado, tomamos el último día del mes; si es futuro, el día 1
    const [cy, cm] = currentOperationalDate.split("-").map(Number);
    if (year < cy || (year === cy && month < cm)) {
      activeDate = `${monthPrefix}-${String(daysInMonth).padStart(2, "0")}`;
    } else {
      activeDate = `${monthPrefix}-01`;
    }
  }

  const todayEntry =
    dailySchedule.find((d) => d.date === activeDate) ||
    dailySchedule[dailySchedule.length - 1];

  const todayBaseTarget = todayEntry ? todayEntry.baseTarget : 0;
  const todaySales = todayEntry ? todayEntry.actualSales : 0;
  const todayDifference = Number((todaySales - todayBaseTarget).toFixed(2));
  const todayPending =
    todayBaseTarget > todaySales
      ? Number((todayBaseTarget - todaySales).toFixed(2))
      : 0;
  const todaySurplus =
    todaySales > todayBaseTarget
      ? Number((todaySales - todayBaseTarget).toFixed(2))
      : 0;
  const todayCompliancePercent =
    todayBaseTarget > 0
      ? Number(((todaySales / todayBaseTarget) * 100).toFixed(2))
      : todaySales > 0
      ? 100
      : 0;

  const expectedCumulativeUntilToday = todayEntry
    ? todayEntry.runningExpected
    : 0;
  const actualCumulativeUntilToday = todayEntry ? todayEntry.runningActual : 0;
  const cumulativeBalance = Number(
    (actualCumulativeUntilToday - expectedCumulativeUntilToday).toFixed(2)
  );
  const hasPositiveCumulativeBalance = cumulativeBalance >= 0;

  const totalOperatingDaysInMonth = dayWeights.filter(
    (d) => d.isOperatingDay
  ).length;
  const elapsedOperatingDays = dayWeights.filter(
    (d) => d.date <= activeDate && d.isOperatingDay
  ).length;
  const remainingOperatingDays = dayWeights.filter(
    (d) => d.date > activeDate && d.isOperatingDay
  ).length;

  // 3. Ajuste automático de los próximos días
  const isMonthlyGoalFulfilled =
    monthlyGoalAmount > 0 && totalAccumulatedMonthSales >= monthlyGoalAmount;
  const pendingMonthlyAmount =
    monthlyGoalAmount > totalAccumulatedMonthSales
      ? Number((monthlyGoalAmount - totalAccumulatedMonthSales).toFixed(2))
      : 0;
  const monthlySurplusAmount =
    totalAccumulatedMonthSales > monthlyGoalAmount && monthlyGoalAmount > 0
      ? Number((totalAccumulatedMonthSales - monthlyGoalAmount).toFixed(2))
      : 0;

  let adjustedNextDaysTarget = 0;
  let adjustmentExplanation = "";

  if (monthlyGoalAmount <= 0) {
    adjustedNextDaysTarget = 0;
    adjustmentExplanation =
      "Aún no se ha asignado una meta mensual para este periodo.";
  } else if (isMonthlyGoalFulfilled) {
    adjustedNextDaysTarget = 0;
    adjustmentExplanation = `¡Objetivo mensual cumplido! La sucursal ya alcanzó los ${formatBOB(
      monthlyGoalAmount
    )} y cuenta con un excedente global de ${formatBOB(
      monthlySurplusAmount
    )}. Todas las ventas adicionales incrementan el excedente del mes.`;
  } else if (remainingOperatingDays > 0) {
    adjustedNextDaysTarget = Number(
      (pendingMonthlyAmount / remainingOperatingDays).toFixed(2)
    );
    if (cumulativeBalance > 0.009) {
      adjustmentExplanation = `Gracias al saldo acumulado a favor de ${formatBOB(
        cumulativeBalance
      )}, la meta diaria requerida para los ${remainingOperatingDays} días restantes disminuye de ${formatBOB(
        todayBaseTarget
      )} a ${formatBOB(adjustedNextDaysTarget)} por día.`;
    } else if (cumulativeBalance < -0.009) {
      adjustmentExplanation = `Para recuperar el saldo acumulado pendiente de ${formatBOB(
        Math.abs(cumulativeBalance)
      )} en los ${remainingOperatingDays} días restantes, la nueva meta diaria ajustada es de ${formatBOB(
        adjustedNextDaysTarget
      )} (${formatBOB(pendingMonthlyAmount)} pendientes / ${remainingOperatingDays} días).`;
    } else {
      adjustmentExplanation = `La sucursal marcha exactamente al ritmo esperado. La meta para los próximos ${remainingOperatingDays} días se mantiene en ${formatBOB(
        adjustedNextDaysTarget
      )} por día.`;
    }
  } else {
    adjustedNextDaysTarget = pendingMonthlyAmount;
    adjustmentExplanation = `Último día operativo del mes. Faltan ${formatBOB(
      pendingMonthlyAmount
    )} para cerrar la meta mensual.`;
  }

  // 4. Mensajes motivadores automáticos (Caso A, Caso B, Caso C)
  let caseType: DailyIntelligenceResult["caseType"] = "CASO_A";
  let primaryMotivationalMessage = "";
  let visualStatus: DailyIntelligenceResult["visualStatus"] = "AZUL";

  if (isMonthlyGoalFulfilled) {
    caseType = "META_MENSUAL_CUMPLIDA";
    visualStatus = "VERDE";
    primaryMotivationalMessage = `¡EXTRAORDINARIO EQUIPO! Ya cumplimos nuestra meta mensual de ${formatBOB(
      monthlyGoalAmount
    )} y llevamos ${formatBOB(
      monthlySurplusAmount
    )} de excedente. ¡Cada venta adicional sigue sumando a un mes histórico!`;
  } else if (Math.abs(todaySales - todayBaseTarget) < 0.01 && todayBaseTarget > 0) {
    // CASO B: SE ALCANZÓ EXACTAMENTE LA META
    caseType = "CASO_B";
    visualStatus = "VERDE";
    primaryMotivationalMessage = msgTemplateCaseB
      .replace("{meta_diaria}", formatBOB(todayBaseTarget))
      .replace("{venta_dia}", formatBOB(todaySales));
  } else if (todaySales > todayBaseTarget && todayBaseTarget > 0) {
    // CASO C: SE SUPERÓ LA META DIARIA
    caseType = "CASO_C";
    visualStatus = "VERDE";
    primaryMotivationalMessage = msgTemplateCaseC
      .replace("{excedente}", formatBOB(todaySurplus))
      .replace("{meta_diaria}", formatBOB(todayBaseTarget))
      .replace("{venta_dia}", formatBOB(todaySales));
  } else {
    // CASO A: NO SE ALCANZÓ LA META DIARIA
    caseType = "CASO_A";
    visualStatus = hasPositiveCumulativeBalance ? "AZUL" : "NARANJA";
    primaryMotivationalMessage = msgTemplateCaseA
      .replace("{diferencia}", formatBOB(todayPending))
      .replace("{meta_diaria}", formatBOB(todayBaseTarget))
      .replace("{venta_dia}", formatBOB(todaySales));
  }

  // 5. Mensaje de Saldo Acumulado a Favor o Pendiente
  let cumulativeBalanceMessage = "";
  if (cumulativeBalance > 0.009) {
    if (todaySales < todayBaseTarget) {
      cumulativeBalanceMessage = `¡Muy bien! A pesar de que hoy aún no alcanzamos la meta diaria, todavía tenemos ${formatBOB(
        cumulativeBalance
      )} de saldo positivo acumulado. ¡Sigamos trabajando!`;
    } else {
      cumulativeBalanceMessage = `¡Excelente ritmo! Acumulamos un saldo positivo a favor de ${formatBOB(
        cumulativeBalance
      )} en lo que va del mes, lo que respalda nuestros próximos días.`;
    }
  } else if (cumulativeBalance < -0.009) {
    cumulativeBalanceMessage = `¡Vamos, podemos recuperarnos! Tenemos ${formatBOB(
      Math.abs(cumulativeBalance)
    )} pendientes para mantenernos al ritmo de nuestra meta mensual. Mañana tenemos una nueva oportunidad.`;
  } else {
    cumulativeBalanceMessage =
      "¡Vamos al día! Nuestro saldo acumulado está exactamente equilibrado con la meta esperada del mes.";
  }

  // 6. Resumen al Cierre del Día Operativo
  let closingDaySummaryText = "";
  if (todaySales >= todayBaseTarget && todayBaseTarget > 0) {
    closingDaySummaryText = `RESUMEN DEL DÍA (${activeDate})\n\n¡Hoy vendimos ${formatBOB(
      todaySales
    )}!\nNuestra meta era ${formatBOB(
      todayBaseTarget
    )}.\n${
      todaySurplus > 0
        ? `¡Superamos el objetivo por ${formatBOB(
            todaySurplus
          )}!\nEse monto se convierte en saldo a favor para los siguientes días.`
        : "¡Alcanzamos exactamente nuestro objetivo diario!"
    }\nCumplimiento del día: ${todayCompliancePercent.toFixed(
      1
    )}%. Meta necesaria para mañana: ${formatBOB(
      adjustedNextDaysTarget
    )}.\n¡Excelente trabajo! Mañana vamos por más.`;
  } else {
    closingDaySummaryText = `RESUMEN DEL DÍA (${activeDate})\n\nHoy registramos ventas por ${formatBOB(
      todaySales
    )} frente a nuestra meta diaria de ${formatBOB(
      todayBaseTarget
    )} (${todayCompliancePercent.toFixed(
      1
    )}% de avance).\nNos faltaron ${formatBOB(
      todayPending
    )} para completar el objetivo de hoy.\n${
      cumulativeBalance >= 0
        ? `Mantenemos un saldo acumulado a favor de ${formatBOB(
            cumulativeBalance
          )}.`
        : `Nuestro saldo acumulado por recuperar es de ${formatBOB(
            Math.abs(cumulativeBalance)
          )}.`
    }\nMeta necesaria para mañana: ${formatBOB(
      adjustedNextDaysTarget
    )}.\n¡Mañana tenemos una nueva oportunidad para superarnos!`;
  }

  return {
    monthlyGoalAmount,
    distributionMethod,
    totalOperatingDaysInMonth,
    elapsedOperatingDays,
    remainingOperatingDays,
    todayDate: activeDate,
    todayBaseTarget,
    todaySales,
    todayDifference,
    todayPending,
    todaySurplus,
    todayCompliancePercent,
    expectedCumulativeUntilToday,
    actualCumulativeUntilToday,
    totalAccumulatedMonthSales,
    cumulativeBalance,
    hasPositiveCumulativeBalance,
    pendingMonthlyAmount,
    monthlySurplusAmount,
    isMonthlyGoalFulfilled,
    adjustedNextDaysTarget,
    adjustmentExplanation,
    visualStatus,
    caseType,
    primaryMotivationalMessage,
    cumulativeBalanceMessage,
    closingDaySummaryText,
    dailySchedule,
  };
}
