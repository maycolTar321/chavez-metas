"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShieldAlert, RefreshCw, Eye, X } from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";

interface AuditEntry {
  id: number;
  userId: number | null;
  userFullName: string | null;
  username: string | null;
  userRole: string | null;
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;
  module: string;
  action: string;
  entityId: string | null;
  description: string;
  previousData: unknown;
  newData: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditoriaPage() {
  const { selectedBranchId } = useAppContext();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("TODOS");
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (moduleFilter !== "TODOS") params.set("module", moduleFilter);
      if (selectedBranchId) params.set("branchId", String(selectedBranchId));
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, selectedBranchId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
            Seguridad y Gobernanza (Solo SUPERADMIN)
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Bitácora Central de Auditoría
          </h1>
          <p className="text-xs text-slate-500">
            Registro inmutable de inicios de sesión, creación/edición de metas, ventas, sucursales, turnos y usuarios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
          >
            <option value="TODOS">Todos los Módulos</option>
            <option value="AUTENTICACION">AUTENTICACIÓN</option>
            <option value="VENTAS">VENTAS</option>
            <option value="METAS_MENSUALES">METAS MENSUALES</option>
            <option value="SUCURSALES">SUCURSALES</option>
            <option value="PERSONAL">PERSONAL</option>
            <option value="TURNOS">TURNOS</option>
            <option value="CONFIGURACION">CONFIGURACIÓN</option>
          </select>

          <button
            type="button"
            onClick={loadLogs}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500">
                <th className="py-3.5 px-4">Fecha / Hora</th>
                <th className="py-3.5 px-4">Usuario / Rol</th>
                <th className="py-3.5 px-4">Módulo / Acción</th>
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4">Descripción del Evento</th>
                <th className="py-3.5 px-4 text-right">JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Cargando bitácora de auditoría...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Sin registros de auditoría para este filtro.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {new Date(log.createdAt).toLocaleString("es-BO")}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">
                        {log.userFullName || "Sistema"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {log.username ? `@${log.username}` : ""} •{" "}
                        {log.userRole || ""}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {log.module}
                      </span>
                      <p className="font-bold text-blue-700 mt-0.5">
                        {log.action}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.branchCode
                        ? `${log.branchCode} — ${log.branchName}`
                        : "Global"}
                    </td>
                    <td className="py-3 px-4 text-slate-800 max-w-md">
                      {log.description}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {Boolean(log.previousData || log.newData) && (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Detalle</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Evidencia Técnica de Auditoría #{selectedLog.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-700 font-semibold">
              {selectedLog.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold text-slate-600 mb-1">
                  Estado Anterior (previousData):
                </p>
                <pre className="p-3 rounded-xl bg-slate-900 text-amber-300 overflow-x-auto text-[11px]">
                  {JSON.stringify(selectedLog.previousData, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-bold text-slate-600 mb-1">
                  Nuevo Estado (newData):
                </p>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 overflow-x-auto text-[11px]">
                  {JSON.stringify(selectedLog.newData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
