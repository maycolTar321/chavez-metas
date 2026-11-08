import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BUSINESS_TIMEZONE = "America/La_Paz";

/**
 * Formatea un monto numérico o string en Bolivianos (Bs) con separación de miles y 2 decimales exactos.
 */
export function formatBOB(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
  if (isNaN(num)) return "Bs 0,00";
  return (
    "Bs " +
    new Intl.NumberFormat("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  );
}

/**
 * Formatea un porcentaje con 1 o 2 decimales.
 */
export function formatPercent(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
  if (isNaN(num)) return "0.0%";
  return `${num.toFixed(1)}%`;
}

/**
 * Obtiene la fecha y hora actual en la zona horaria America/La_Paz
 */
export function getBoliviaNow(): {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour === "24" ? "00" : map.hour, 10);
  const minute = parseInt(map.minute, 10);

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${map.minute}`;

  return { dateStr, timeStr, year, month, day, hour, minute };
}

/**
 * Calcula si un rango de horas cruza la medianoche (ej: 22:00 a 06:00).
 */
export function doesShiftCrossMidnight(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  if (isNaN(startH) || isNaN(endH)) return false;

  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  return endMinutes <= startMinutes;
}

/**
 * Determina la fecha operativa sugerida para un turno que cruza la medianoche.
 * Si un trabajador registra su venta a las 05:30 AM de un turno que inició a las 22:00 de ayer,
 * la fecha operativa corresponde al día en que inició el turno (ayer), evitando asignar la venta a un día incorrecto.
 */
export function suggestOperationalDateForShift(
  currentDateStr: string,
  currentHour: number,
  startTime: string,
  endTime: string
): { suggestedDate: string; crossesMidnight: boolean; explanation: string | null } {
  const crosses = doesShiftCrossMidnight(startTime, endTime);
  if (!crosses) {
    return {
      suggestedDate: currentDateStr,
      crossesMidnight: false,
      explanation: null,
    };
  }

  const [endH] = endTime.split(":").map(Number);
  // Si estamos en la madrugada (antes o hasta de la hora de fin del turno nocturno + 2 horas de margen de cierre)
  if (currentHour <= (endH + 2)) {
    const [y, m, d] = currentDateStr.split("-").map(Number);
    const prevDate = new Date(Date.UTC(y, m - 1, d));
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];

    return {
      suggestedDate: prevDateStr,
      crossesMidnight: true,
      explanation: `Turno nocturno (${startTime} - ${endTime}) que cruza la medianoche: se sugiere fecha operativa de inicio de turno (${prevDateStr}).`,
    };
  }

  return {
    suggestedDate: currentDateStr,
    crossesMidnight: true,
    explanation: `Turno nocturno (${startTime} - ${endTime}) que cruza la medianoche hacia el día siguiente.`,
  };
}

export const MONTHS_ES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export function getMonthName(month: number): string {
  return MONTHS_ES.find((m) => m.value === month)?.label || `Mes ${month}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
