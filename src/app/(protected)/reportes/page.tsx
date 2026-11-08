"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileBarChart2,
  Download,
  Printer,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import { formatBOB, formatPercent, MONTHS_ES, getMonthName } from "@/lib/utils";
import type { DashboardPayload } from "@/lib/analytics";

export default function ReportesPage() {
  const { selectedBranchId } = useAppContext();
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (selectedBranchId) {
        params.set("branchId", String(selectedBranchId));
      }
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedBranchId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function exportCSV() {
    if (!data) return;
    const headers = [
      "Codigo",
      "Sucursal",
      "Responsable",
      "Meta Mensual (Bs)",
      "Meta Diaria Hoy (Bs)",
      "Venta Hoy (Bs)",
      "Ventas Acumuladas Mes (Bs)",
      "Saldo Acumulado a Favor o Pendiente (Bs)",
      "Meta Ajustada Proximos Dias (Bs)",
      "Porcentaje Cumplimiento (%)",
      "Saldo Pendiente Mes (Bs)",
      "Excedente Mes (Bs)",
      "Estado",
    ];
    const rows = data.branchSummaries.map((b) => [
      b.branchCode,
      `"${b.branchName.replace(/"/g, '""')}"`,
      `"${b.managerName.replace(/"/g, '""')}"`,
      b.goalAmount.toFixed(2),
      b.dailyIntelligence.todayBaseTarget.toFixed(2),
      b.todaySales.toFixed(2),
      b.accumulatedSales.toFixed(2),
      b.dailyIntelligence.cumulativeBalance.toFixed(2),
      b.dailyIntelligence.adjustedNextDaysTarget.toFixed(2),
      b.compliancePercent.toFixed(2),
      b.pendingAmount.toFixed(2),
      b.surplusAmount.toFixed(2),
      b.status,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Reporte_Chavez_Metas_${getMonthName(month)}_${year}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Reportes Ejecutivos y Exportación Oficial
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Reporte Consolidado de Metas, Saldo Acumulado y Ventas — {getMonthName(month)} {year}
          </h1>
          <p className="text-xs text-slate-500">
            Exporta a Excel (CSV) o imprime el estado oficial de cumplimiento mensual y diario por sucursal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
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

          <button
            type="button"
            onClick={exportCSV}
            disabled={!data}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-xs text-slate-500">
          Generando reporte ejecutivo...
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          {/* Membrete Oficial para Impresión y Vista Ejecutiva */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-4 gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                CHÁVEZ METAS — CADENA DE FARMACIAS
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Reporte Oficial de Control de Metas Mensuales, Meta Diaria y Saldo Acumulado
              </p>
            </div>
            <div className="text-xs text-slate-600 sm:text-right">
              <p>
                <strong>Periodo:</strong> {getMonthName(month)} {year}
              </p>
              <p>
                <strong>Fecha Operativa Corte:</strong> {data.period.todayDate}
              </p>
              <p>
                <strong>Moneda:</strong> Bolivianos (BOB — Bs)
              </p>
            </div>
          </div>

          {/* Resumen Ejecutivo Global */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Meta Mensual Total:</span>
              <strong className="text-base font-extrabold text-slate-900">
                {formatBOB(data.globalKpis.totalMonthlyGoal)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Ventas Acumuladas:</span>
              <strong className="text-base font-extrabold text-blue-700">
                {formatBOB(data.globalKpis.totalAccumulatedSales)} (
                {formatPercent(data.globalKpis.globalCompliancePercent)})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">
                Saldo Acumulado Global:
              </span>
              <strong
                className={`text-base font-extrabold ${
                  data.globalDailyIntelligence.cumulativeBalance >= 0
                    ? "text-emerald-600"
                    : "text-amber-700"
                }`}
              >
                {data.globalDailyIntelligence.cumulativeBalance >= 0
                  ? `+${formatBOB(
                      data.globalDailyIntelligence.cumulativeBalance
                    )} (A favor)`
                  : `-${formatBOB(
                      Math.abs(data.globalDailyIntelligence.cumulativeBalance)
                    )} (Pend.)`}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">
                Meta Diaria Ajustada Próximos Días:
              </span>
              <strong className="text-base font-extrabold text-slate-900">
                {formatBOB(
                  data.globalDailyIntelligence.adjustedNextDaysTarget
                )}{" "}
                / día
              </strong>
            </div>
          </div>

          {/* Tabla Detallada de Sucursales */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileBarChart2 className="w-4 h-4 text-blue-600" />
              <span>
                1. Detalle de Metas Mensuales, Meta Diaria, Saldo a Favor/Pendiente y Proyección por Sucursal
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Sucursal</th>
                    <th className="py-2.5 px-3 text-right">Meta Mensual</th>
                    <th className="py-2.5 px-3 text-right">Meta Diaria Hoy</th>
                    <th className="py-2.5 px-3 text-right">Venta Hoy</th>
                    <th className="py-2.5 px-3 text-right">Ventas Mes</th>
                    <th className="py-2.5 px-3 text-right">
                      Saldo Acum. (Favor/Pend.)
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      Nueva Meta Próx. Días
                    </th>
                    <th className="py-2.5 px-3 text-center">% Cumpl.</th>
                    <th className="py-2.5 px-3 text-right">Pendiente Mes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.branchSummaries.map((b) => (
                    <tr key={b.branchId}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {b.branchCode} — {b.branchName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {formatBOB(b.goalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {formatBOB(b.dailyIntelligence.todayBaseTarget)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {formatBOB(b.todaySales)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-blue-700">
                        {formatBOB(b.accumulatedSales)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          b.dailyIntelligence.cumulativeBalance >= 0
                            ? "text-emerald-600"
                            : "text-amber-700"
                        }`}
                      >
                        {b.dailyIntelligence.cumulativeBalance >= 0 ? "+" : "-"}
                        {formatBOB(
                          Math.abs(b.dailyIntelligence.cumulativeBalance)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {b.dailyIntelligence.isMonthlyGoalFulfilled
                          ? "Meta Cumplida"
                          : formatBOB(
                              b.dailyIntelligence.adjustedNextDaysTarget
                            )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold">
                        {formatPercent(b.compliancePercent)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {b.pendingAmount > 0
                          ? formatBOB(b.pendingAmount)
                          : `+${formatBOB(b.surplusAmount)} (Exc.)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabla Diaria Acumulada del Periodo */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>
                2. Evolución Diaria de Ventas y Saldo Acumulado del Mes
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold uppercase text-slate-600">
                    <th className="py-2 px-3">Fecha Operativa</th>
                    <th className="py-2 px-3 text-right">Meta del Día</th>
                    <th className="py-2 px-3 text-right">Venta del Día</th>
                    <th className="py-2 px-3 text-right">Diferencia Día</th>
                    <th className="py-2 px-3 text-right">Meta Acumulada</th>
                    <th className="py-2 px-3 text-right">Venta Acumulada</th>
                    <th className="py-2 px-3 text-right">
                      Saldo Acumulado (Favor / Pend.)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.globalDailyIntelligence.dailySchedule
                    .filter((d) => d.date <= data.period.todayDate || d.actualSales > 0)
                    .map((d) => (
                      <tr key={d.date}>
                        <td className="py-2 px-3 font-semibold">
                          Día {d.dayNumber} ({d.date})
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatBOB(d.baseTarget)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {formatBOB(d.actualSales)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-bold ${
                            d.dailyDiff >= 0
                              ? "text-emerald-600"
                              : "text-amber-700"
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
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
