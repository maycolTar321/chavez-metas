"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Target,
  Calendar,
  Edit3,
  History,
  CheckCircle2,
  X,
  PlusCircle,
  Sparkles,
  Eye,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import {
  formatBOB,
  formatPercent,
  MONTHS_ES,
  getMonthName,
  getDaysInMonth,
} from "@/lib/utils";
import { canUserManageGoals } from "@/lib/permissions";
import type { DailyIntelligenceResult } from "@/lib/daily-goal-engine";
import type { DailyGoalDistributionMethod } from "@/db/schema";
import DailyMotivationCard from "@/components/motivation/DailyMotivationCard";

interface GoalRow {
  goalId: number | null;
  branchId: number;
  branchCode: string;
  branchName: string;
  isActiveBranch: boolean;
  month: number;
  year: number;
  goalAmount: number;
  distributionMethod: DailyGoalDistributionMethod;
  operatingDaysMask: number[];
  customDailyTargets: Record<string, number>;
  holidays: string[];
  salesAmount: number;
  compliancePercent: number;
  pendingAmount: number;
  surplusAmount: number;
  status: string;
  responsibleName: string;
  observations: string;
  dailyIntelligence: DailyIntelligenceResult;
}

interface GoalHistoryItem {
  id: number;
  branchCode: string;
  branchName: string;
  month: number;
  year: number;
  previousAmount: string | null;
  newAmount: string;
  changedByName: string;
  reason: string | null;
  createdAt: string;
}

const WEEKDAYS = [
  { day: 1, label: "Lun" },
  { day: 2, label: "Mar" },
  { day: 3, label: "Mié" },
  { day: 4, label: "Jue" },
  { day: 5, label: "Vie" },
  { day: 6, label: "Sáb" },
  { day: 0, label: "Dom" },
];

export default function MetasMensualesPage() {
  const { user, selectedBranchId } = useAppContext();
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [rows, setRows] = useState<GoalRow[]>([]);
  const [history, setHistory] = useState<GoalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalRow, setModalRow] = useState<GoalRow | null>(null);
  const [formAmount, setFormAmount] = useState<string>("");
  const [formMethod, setFormMethod] =
    useState<DailyGoalDistributionMethod>("UNIFORME");
  const [formOperatingDays, setFormOperatingDays] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6,
  ]);
  const [formCustomDaily, setFormCustomDaily] = useState<
    Record<string, string>
  >({});
  const [formObs, setFormObs] = useState<string>("");
  const [formReason, setFormReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [inspectRow, setInspectRow] = useState<GoalRow | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (selectedBranchId) {
        params.set("branchId", String(selectedBranchId));
      }
      const res = await fetch(`/api/goals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setHistory(data.history || []);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedBranchId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  function openGoalModal(row: GoalRow) {
    setModalRow(row);
    setFormAmount(row.goalAmount > 0 ? String(row.goalAmount) : "");
    setFormMethod(row.distributionMethod || "UNIFORME");
    setFormOperatingDays(
      row.operatingDaysMask && row.operatingDaysMask.length > 0
        ? row.operatingDaysMask
        : [0, 1, 2, 3, 4, 5, 6]
    );
    const customMap: Record<string, string> = {};
    const daysCount = getDaysInMonth(year, month);
    const defaultPerDay =
      row.goalAmount > 0 ? (row.goalAmount / daysCount).toFixed(2) : "0";
    for (let d = 1; d <= daysCount; d++) {
      const existingVal =
        row.customDailyTargets?.[String(d)] ??
        row.customDailyTargets?.[
          `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(
            2,
            "0"
          )}`
        ];
      customMap[String(d)] =
        existingVal !== undefined ? String(existingVal) : defaultPerDay;
    }
    setFormCustomDaily(customMap);
    setFormObs(row.observations || "");
    setFormReason("");
  }

  function toggleWeekday(day: number) {
    setFormOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function distributeUniformlyIntoCustom() {
    const total = parseFloat(formAmount || "0");
    const daysCount = getDaysInMonth(year, month);
    if (total <= 0) return;
    const perDay = (total / daysCount).toFixed(2);
    const next: Record<string, string> = {};
    for (let d = 1; d <= daysCount; d++) {
      next[String(d)] = perDay;
    }
    setFormCustomDaily(next);
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!modalRow) return;
    setSaving(true);

    const parsedCustom: Record<string, number> = {};
    if (formMethod === "PERSONALIZADO") {
      for (const [k, v] of Object.entries(formCustomDaily)) {
        parsedCustom[k] = parseFloat(v || "0") || 0;
      }
    }

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: modalRow.branchId,
          month,
          year,
          goalAmount: parseFloat(formAmount),
          distributionMethod: formMethod,
          operatingDaysMask: formOperatingDays,
          customDailyTargets: parsedCustom,
          observations: formObs,
          reason: formReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al guardar la meta mensual");
        setSaving(false);
        return;
      }
      setModalRow(null);
      await fetchGoals();
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  const totalGoal = rows.reduce((acc, r) => acc + r.goalAmount, 0);
  const totalSales = rows.reduce((acc, r) => acc + r.salesAmount, 0);
  const totalPending = rows.reduce((acc, r) => acc + r.pendingAmount, 0);
  const globalCompliance =
    totalGoal > 0 ? Number(((totalSales / totalGoal) * 100).toFixed(2)) : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Planificación Mensual y Meta Diaria Inteligente (Bs)
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Metas Mensuales y Distribución Diaria — {getMonthName(month)} {year}
          </h1>
          <p className="text-xs text-slate-500">
            Configura la meta mensual y el método de cálculo diario (Uniforme, Días Operativos o Personalizado por Día).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500 ml-2" />
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-800 py-1 px-2 focus:outline-none"
          >
            {MONTHS_ES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-800 py-1 px-2 border-l border-slate-300 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Si hay una sola sucursal o se inspecciona una, mostrar su Tarjeta de Motivación Diaria */}
      {rows.length === 1 && (
        <DailyMotivationCard
          intelligence={rows[0].dailyIntelligence}
          titleSubtitle={`${rows[0].branchCode} — ${rows[0].branchName}`}
        />
      )}

      {/* Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <span className="text-xs font-bold uppercase text-slate-500">
            Meta Total del Periodo
          </span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {formatBOB(totalGoal)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <span className="text-xs font-bold uppercase text-slate-500">
            Ventas Acumuladas
          </span>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">
            {formatBOB(totalSales)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <span className="text-xs font-bold uppercase text-slate-500">
            Cumplimiento Consolidado
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            {formatPercent(globalCompliance)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <span className="text-xs font-bold uppercase text-slate-500">
            Saldo Pendiente Total
          </span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">
            {formatBOB(totalPending)}
          </p>
        </div>
      </div>

      {/* Tabla Oficial: Sucursal | Meta | Meta Diaria | Ventas | Saldo Acum. | Meta Próx. Días | Cumplimiento | Pendiente | Estado */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Matriz de Metas Mensuales, Meta Diaria, Saldo Acumulado y Ajuste de Próximos Días
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4 text-right">Meta Mensual</th>
                <th className="py-3.5 px-4 text-right">Meta Diaria Ref.</th>
                <th className="py-3.5 px-4 text-right">Ventas Mes</th>
                <th className="py-3.5 px-4 text-right">Saldo Acumulado</th>
                <th className="py-3.5 px-4 text-right">Meta Próximos Días</th>
                <th className="py-3.5 px-4 text-center">Cumplimiento</th>
                <th className="py-3.5 px-4 text-right">Pendiente Mes</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    Cargando metas mensuales y cálculos diarios...
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const canEdit = canUserManageGoals(user, r.branchId);
                  const di = r.dailyIntelligence;
                  return (
                    <tr key={r.branchId} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">
                          {r.branchCode} — {r.branchName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Método:{" "}
                          <strong>
                            {r.distributionMethod === "UNIFORME"
                              ? "Uniforme"
                              : r.distributionMethod === "DIAS_OPERATIVOS"
                              ? "Días Operativos"
                              : "Personalizado"}
                          </strong>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                        {formatBOB(r.goalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                        {formatBOB(di.todayBaseTarget)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-blue-700">
                        {formatBOB(r.salesAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-extrabold ${
                            di.cumulativeBalance >= 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {di.cumulativeBalance >= 0
                            ? `+${formatBOB(di.cumulativeBalance)}`
                            : `-${formatBOB(Math.abs(di.cumulativeBalance))}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-indigo-700">
                        {di.isMonthlyGoalFulfilled
                          ? "¡Cumplida!"
                          : `${formatBOB(di.adjustedNextDaysTarget)}/día`}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-extrabold text-slate-900">
                          {formatPercent(r.compliancePercent)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-amber-700">
                        {r.pendingAmount > 0 ? (
                          formatBOB(r.pendingAmount)
                        ) : r.surplusAmount > 0 ? (
                          <span className="text-emerald-600 font-bold">
                            +{formatBOB(r.surplusAmount)}
                          </span>
                        ) : (
                          "Bs 0,00"
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            r.status === "CUMPLIDA"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "EN_CAMINO"
                              ? "bg-blue-100 text-blue-800"
                              : r.status === "PENDIENTE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.status === "CUMPLIDA" && (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectRow(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                            title="Ver motivación y calendario diario de esta sucursal"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Meta Diaria</span>
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openGoalModal(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition"
                            >
                              {r.goalId ? (
                                <>
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Configurar</span>
                                </>
                              ) : (
                                <>
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>Asignar</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de Cambios de Metas Mensuales */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Historial de Asignación y Modificación de Metas
            </h2>
            <p className="text-xs text-slate-500">
              Registro inalterable de quién creó o modificó cada meta mensual
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Sucursal</th>
                <th className="py-3 px-4">Periodo</th>
                <th className="py-3 px-4 text-right">Meta Anterior</th>
                <th className="py-3 px-4 text-right">Nueva Meta</th>
                <th className="py-3 px-4">Modificado por</th>
                <th className="py-3 px-4">Motivo / Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Sin movimientos históricos registrados.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-600">
                      {new Date(h.createdAt).toLocaleString("es-BO")}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {h.branchCode} — {h.branchName}
                    </td>
                    <td className="py-2.5 px-4">
                      {getMonthName(h.month)} {h.year}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {h.previousAmount
                        ? formatBOB(h.previousAmount)
                        : "Inicial"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-blue-700">
                      {formatBOB(h.newAmount)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {h.changedByName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {h.reason || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Inspeccionar Tarjeta de Motivación y Desglose Día a Día de una Sucursal */}
      {inspectRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-extrabold text-slate-900">
                  Seguimiento de Meta Diaria y Saldo Acumulado —{" "}
                  {inspectRow.branchCode} {inspectRow.branchName}
                </h3>
              </div>
              <button
                onClick={() => setInspectRow(null)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DailyMotivationCard
              intelligence={inspectRow.dailyIntelligence}
              titleSubtitle={`${inspectRow.branchCode} — ${inspectRow.branchName}`}
            />

            {/* Tabla del Calendario Operativo Día por Día */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h4 className="text-sm font-bold text-slate-900">
                  Evolución Día por Día: Meta Diaria vs Venta Real vs Saldo Acumulado
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Fecha Operativa</th>
                      <th className="py-2.5 px-3 text-right">Meta del Día</th>
                      <th className="py-2.5 px-3 text-right">Venta del Día</th>
                      <th className="py-2.5 px-3 text-right">
                        Diferencia Día
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        Meta Acumulada
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        Venta Acumulada
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        Saldo Acumulado (Favor / Pend.)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inspectRow.dailyIntelligence.dailySchedule.map((d) => {
                      const isToday =
                        d.date === inspectRow.dailyIntelligence.todayDate;
                      return (
                        <tr
                          key={d.date}
                          className={
                            isToday ? "bg-blue-50/80 font-semibold" : ""
                          }
                        >
                          <td className="py-2 px-3">
                            Día {d.dayNumber} ({d.date})
                            {isToday && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">
                                HOY
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatBOB(d.baseTarget)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatBOB(d.actualSales)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              d.dailyDiff >= 0
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {d.dailyDiff >= 0 ? "+" : "-"}
                            {formatBOB(Math.abs(d.dailyDiff))}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {formatBOB(d.runningExpected)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-blue-700">
                            {formatBOB(d.runningActual)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-extrabold ${
                              d.runningBalance >= 0
                                ? "text-emerald-600"
                                : "text-amber-700"
                            }`}
                          >
                            {d.runningBalance >= 0 ? "+" : "-"}
                            {formatBOB(Math.abs(d.runningBalance))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear / Editar Meta Mensual y Método de Cálculo Diario */}
      {modalRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {modalRow.goalId
                    ? "Configurar Meta Mensual y Cálculo de Meta Diaria"
                    : "Establecer Meta Mensual y Cálculo de Meta Diaria"}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalRow.branchCode} — {modalRow.branchName} (
                  {getMonthName(month)} {year})
                </p>
              </div>
              <button
                onClick={() => setModalRow(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Meta Mensual en Bolivianos (Bs) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Ej. 50000.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-extrabold text-slate-900"
                />
                {parseFloat(formAmount) > 0 && (
                  <p className="text-xs text-blue-700 font-semibold mt-1">
                    Referencia uniforme ({getDaysInMonth(year, month)} días):{" "}
                    {formatBOB(
                      parseFloat(formAmount) / getDaysInMonth(year, month)
                    )}{" "}
                    por día.
                  </p>
                )}
              </div>

              {/* Selección del Método de Distribución de Meta Diaria */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Método de Cálculo de la Meta Diaria *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: "UNIFORME",
                      title: "1. Distribución Uniforme",
                      desc: "Divide la meta mensual entre todos los días del mes.",
                    },
                    {
                      id: "DIAS_OPERATIVOS",
                      title: "2. Por Días Operativos",
                      desc: "Divide entre los días de atención configurados.",
                    },
                    {
                      id: "PERSONALIZADO",
                      title: "3. Personalizada",
                      desc: "Permite establecer metas diferentes por día.",
                    },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() =>
                        setFormMethod(opt.id as DailyGoalDistributionMethod)
                      }
                      className={`p-3 rounded-xl border text-left transition ${
                        formMethod === opt.id
                          ? "bg-blue-50 border-blue-600 text-blue-950 ring-2 ring-blue-600/20"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Si elige DÍAS OPERATIVOS */}
              {formMethod === "DIAS_OPERATIVOS" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Selecciona los Días de Atención de la Sucursal:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((w) => {
                      const active = formOperatingDays.includes(w.day);
                      return (
                        <button
                          type="button"
                          key={w.day}
                          onClick={() => toggleWeekday(w.day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            active
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-slate-300 text-slate-600"
                          }`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Si elige PERSONALIZADO */}
              {formMethod === "PERSONALIZADO" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Metas Personalizadas por Día del Mes (Bs):
                    </label>
                    <button
                      type="button"
                      onClick={distributeUniformlyIntoCustom}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Prellenar con promedio uniforme
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                    {Array.from(
                      { length: getDaysInMonth(year, month) },
                      (_, idx) => idx + 1
                    ).map((d) => (
                      <div key={d} className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block">
                          Día {d}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formCustomDaily[String(d)] || ""}
                          onChange={(e) =>
                            setFormCustomDaily({
                              ...formCustomDaily,
                              [String(d)]: e.target.value,
                            })
                          }
                          className="w-full text-xs font-bold text-slate-900 border-b border-slate-300 focus:outline-none focus:border-blue-600 mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Observaciones Comerciales
                </label>
                <textarea
                  rows={2}
                  value={formObs}
                  onChange={(e) => setFormObs(e.target.value)}
                  placeholder="Ej. Meta ajustada por campaña estacional..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              {modalRow.goalId && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Motivo del Cambio (Trazabilidad) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="Indica por qué se modifica la meta..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRow(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  {saving ? "Guardando..." : "Guardar Meta y Distribución"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
