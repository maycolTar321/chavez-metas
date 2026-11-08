"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Award,
  Users,
  Clock,
  Calendar,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import { formatBOB, formatPercent, MONTHS_ES, getMonthName } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/db/schema";

interface WorkerPerf {
  userId: number;
  fullName: string;
  username: string;
  role: UserRole;
  branchName: string;
  branchCode: string;
  totalSales: number;
  recordsCount: number;
  averageTicket: number;
}

interface ShiftPerf {
  shiftType: string;
  totalSales: number;
  recordsCount: number;
  averageSale: number;
}

interface BranchPerf {
  branchId: number;
  branchCode: string;
  branchName: string;
  managerName: string;
  isActive: boolean;
  goalAmount: number;
  salesAmount: number;
  recordsCount: number;
  compliancePercent: number;
  pendingAmount: number;
  surplusAmount: number;
}

export default function RendimientoPage() {
  const { selectedBranchId } = useAppContext();
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [workers, setWorkers] = useState<WorkerPerf[]>([]);
  const [shifts, setShifts] = useState<ShiftPerf[]>([]);
  const [branchesPerf, setBranchesPerf] = useState<BranchPerf[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPerformance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (selectedBranchId) {
        params.set("branchId", String(selectedBranchId));
      }
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWorkers(data.workerPerformance || []);
        setShifts(data.shiftPerformance || []);
        setBranchesPerf(data.branchPerformance || []);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedBranchId]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Evaluación Comercial y Productividad
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Rendimiento de Sucursales, Turnos y Personal — {getMonthName(month)} {year}
          </h1>
          <p className="text-xs text-slate-500">
            Ranking comparativo de cumplimiento por sucursal, productividad por turno 24h y desempeño del personal.
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

      {/* Rendimiento por Tipo de Turno (Mañana, Tarde, Noche 24h) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {shifts.length === 0 && !loading ? (
          <div className="col-span-full bg-white rounded-2xl p-6 border border-slate-200 text-center text-xs text-slate-500">
            Sin ventas registradas por turno en este periodo.
          </div>
        ) : (
          shifts.map((s) => (
            <div
              key={s.shiftType}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
                  Turno {s.shiftType}
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {formatBOB(s.totalSales)}
              </p>
              <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>{s.recordsCount} cierres reg.</span>
                <span>Prom: {formatBOB(s.averageSale)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ranking de Cumplimiento por Sucursal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Ranking de Rendimiento por Sucursal
            </h2>
            <p className="text-xs text-slate-500">
              Ordenado por porcentaje de cumplimiento de meta mensual
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Posición</th>
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4 text-right">Meta Mensual</th>
                <th className="py-3.5 px-4 text-right">Ventas Acumuladas</th>
                <th className="py-3.5 px-4 text-center">% Cumplimiento</th>
                <th className="py-3.5 px-4 text-right">Turnos Reg.</th>
                <th className="py-3.5 px-4 text-right">Pendiente / Excedente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {branchesPerf.map((b, idx) => (
                <tr key={b.branchId} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-extrabold text-slate-800">
                    #{idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">
                      {b.branchCode} — {b.branchName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Resp: {b.managerName}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                    {formatBOB(b.goalAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                    {formatBOB(b.salesAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        b.compliancePercent >= 100
                          ? "bg-emerald-100 text-emerald-800"
                          : b.compliancePercent >= 75
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {formatPercent(b.compliancePercent)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                    {b.recordsCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold">
                    {b.surplusAmount > 0 ? (
                      <span className="text-emerald-600 font-bold">
                        +{formatBOB(b.surplusAmount)} (Excedente)
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        {formatBOB(b.pendingAmount)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Productividad por Trabajador / Usuario */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rendimiento por Personal Registrador en Turno
            </h2>
            <p className="text-xs text-slate-500">
              Total vendido en Bolivianos (Bs), cantidad de turnos registrados y promedio por turno
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Nombre del Personal</th>
                <th className="py-3.5 px-4">Rol</th>
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4 text-right">Turnos Reg.</th>
                <th className="py-3.5 px-4 text-right">Promedio por Turno</th>
                <th className="py-3.5 px-4 text-right">Total Vendido (Bs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    Sin registros de ventas en el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                workers.map((w, idx) => (
                  <tr key={`${w.userId}-${w.branchCode}`} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-600">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{w.fullName}</p>
                      <p className="text-xs text-slate-500">@{w.username}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-blue-700">
                      {ROLE_LABELS[w.role] || w.role}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {w.branchCode} — {w.branchName}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">
                      {w.recordsCount}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatBOB(w.averageTicket)}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatBOB(w.totalSales)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
