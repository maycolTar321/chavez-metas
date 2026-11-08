"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Filter,
  Download,
  FileSearch,
  X,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import { formatBOB } from "@/lib/utils";

interface SaleRecord {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  shiftName: string;
  shiftType: string;
  operationalDate: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  amount: number;
  registeredByName: string;
  registeredByUsername: string;
  status: string;
  voidReason: string | null;
  observations: string | null;
  createdAt: string;
}

interface TraceItem {
  id: number;
  previousAmount: string | null;
  newAmount: string | null;
  previousStatus: string | null;
  newStatus: string;
  changedByName: string;
  reason: string;
  createdAt: string;
}

export default function HistorialPage() {
  const { selectedBranchId } = useAppContext();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [shiftTypeFilter, setShiftTypeFilter] = useState("TODOS");

  const [traceSale, setTraceSale] = useState<SaleRecord | null>(null);
  const [traceHistory, setTraceHistory] = useState<TraceItem[]>([]);
  const [loadingTrace, setLoadingTrace] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (selectedBranchId) params.set("branchId", String(selectedBranchId));
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (statusFilter !== "TODOS") params.set("status", statusFilter);
      if (shiftTypeFilter !== "TODOS") params.set("shiftType", shiftTypeFilter);

      const res = await fetch(`/api/sales?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, startDate, endDate, statusFilter, shiftTypeFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function openTraceModal(sale: SaleRecord) {
    setTraceSale(sale);
    setLoadingTrace(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`);
      if (res.ok) {
        const data = await res.json();
        setTraceHistory(data.history || []);
      }
    } finally {
      setLoadingTrace(false);
    }
  }

  function exportHistoryCSV() {
    const headers = [
      "ID",
      "Fecha Operativa",
      "Codigo Sucursal",
      "Sucursal",
      "Turno",
      "Tipo Turno",
      "Horario",
      "Cruza Medianoche",
      "Importe (Bs)",
      "Registrado Por",
      "Estado",
      "Observaciones / Motivo",
    ];
    const rows = sales.map((s) => [
      s.id,
      s.operationalDate,
      s.branchCode,
      `"${s.branchName}"`,
      `"${s.shiftName}"`,
      s.shiftType,
      `${s.startTime}-${s.endTime}`,
      s.crossesMidnight ? "SI" : "NO",
      s.amount.toFixed(2),
      `"${s.registeredByName}"`,
      s.status,
      `"${(s.voidReason || s.observations || "").replace(/"/g, '""')}"`,
    ]);
    const csv =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Historial_Ventas_Chavez_Metas.csv`;
    a.click();
  }

  const validSum = sales
    .filter((s) => s.status !== "ANULADO")
    .reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Consulta Histórica y Trazabilidad
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Historial General de Operaciones y Ventas
          </h1>
          <p className="text-xs text-slate-500">
            Filtra por rango de fecha operativa, turno o estado y consulta el historial de cambios de cada registro.
          </p>
        </div>

        <button
          type="button"
          onClick={exportHistoryCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Historial CSV</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block font-bold text-slate-600 mb-1">
            Desde Fecha Operativa
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-600 mb-1">
            Hasta Fecha Operativa
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-600 mb-1">
            Tipo de Turno
          </label>
          <select
            value={shiftTypeFilter}
            onChange={(e) => setShiftTypeFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
          >
            <option value="TODOS">Todos los turnos</option>
            <option value="MANANA">Mañana</option>
            <option value="TARDE">Tarde</option>
            <option value="NOCHE">Noche (24h)</option>
            <option value="PERSONALIZADO">Personalizado</option>
          </select>
        </div>
        <div>
          <label className="block font-bold text-slate-600 mb-1">
            Estado del Registro
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="EDITADO">EDITADO</option>
            <option value="ANULADO">ANULADO</option>
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
            <span className="font-bold text-blue-900">Suma Válida:</span>
            <strong className="text-sm font-extrabold text-blue-700">
              {formatBOB(validSum)}
            </strong>
          </div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">ID / Fecha Op.</th>
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4">Turno y Horario</th>
                <th className="py-3.5 px-4">Registrado Por</th>
                <th className="py-3.5 px-4 text-right">Importe (Bs)</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Trazabilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-xs text-slate-500"
                  >
                    Consultando historial en PostgreSQL...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-xs text-slate-500"
                  >
                    No existen registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-xs text-slate-400 font-mono mr-1.5">
                        #{s.id}
                      </span>
                      <strong className="text-slate-900">
                        {s.operationalDate}
                      </strong>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-bold text-slate-900">
                        {s.branchCode}
                      </span>{" "}
                      — {s.branchName}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-bold text-slate-800">
                        {s.shiftName}
                      </span>{" "}
                      <span className="text-slate-500">
                        ({s.startTime} - {s.endTime})
                      </span>
                      {s.crossesMidnight && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          Cruza 00:00
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {s.registeredByName}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatBOB(s.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === "ACTIVO"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.status === "EDITADO"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800 line-through"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openTraceModal(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                      >
                        <FileSearch className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ver Historial</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Trazabilidad del Registro */}
      {traceSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Trazabilidad del Registro #{traceSale.id}
                </h3>
              </div>
              <button
                onClick={() => setTraceSale(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingTrace ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Cargando movimientos...
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {traceHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>Estado: {item.newStatus}</span>
                      <span className="text-slate-500 font-normal">
                        {new Date(item.createdAt).toLocaleString("es-BO")}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      Importe:{" "}
                      {item.previousAmount
                        ? `${formatBOB(item.previousAmount)} → `
                        : ""}
                      <strong>{formatBOB(item.newAmount)}</strong>
                    </p>
                    <p className="text-slate-600">
                      Usuario: <strong>{item.changedByName}</strong>
                    </p>
                    <p className="text-slate-600 italic">
                      Motivo: “{item.reason}”
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
