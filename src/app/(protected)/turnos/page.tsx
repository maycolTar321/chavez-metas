"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Moon,
  Sun,
  Sunset,
  Plus,
  Edit3,
  Power,
  X,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import { doesShiftCrossMidnight } from "@/lib/utils";
import { hasGlobalBranchAccess } from "@/lib/permissions";

interface ShiftItem {
  id: number;
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;
  name: string;
  type: "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO";
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  isActive: boolean;
  observations: string | null;
}

export default function TurnosPage() {
  const { user, branches, selectedBranchId } = useAppContext();
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);
  const [formData, setFormData] = useState({
    branchId: "" as string | number,
    name: "",
    type: "MANANA" as "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO",
    startTime: "06:00",
    endTime: "14:00",
    isActive: true,
    observations: "",
  });
  const [saving, setSaving] = useState(false);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const q = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const res = await fetch(`/api/shifts${q}`);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  function openCreateModal() {
    setEditingShift(null);
    setFormData({
      branchId: hasGlobalBranchAccess(user.role)
        ? selectedBranchId || ""
        : user.branchId || "",
      name: "Turno Nocturno Especial (22:00 - 06:00)",
      type: "NOCHE",
      startTime: "22:00",
      endTime: "06:00",
      isActive: true,
      observations: "",
    });
    setModalOpen(true);
  }

  function openEditModal(s: ShiftItem) {
    setEditingShift(s);
    setFormData({
      branchId: s.branchId || "",
      name: s.name,
      type: s.type,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
      observations: s.observations || "",
    });
    setModalOpen(true);
  }

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editingShift ? "PATCH" : "POST";
      const payload = {
        id: editingShift?.id,
        branchId: formData.branchId ? Number(formData.branchId) : null,
        name: formData.name,
        type: formData.type,
        startTime: formData.startTime,
        endTime: formData.endTime,
        isActive: formData.isActive,
        observations: formData.observations,
      };

      const res = await fetch("/api/shifts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al guardar el turno");
        setSaving(false);
        return;
      }
      setModalOpen(false);
      await loadShifts();
    } finally {
      setSaving(false);
    }
  }

  async function toggleShiftActive(s: ShiftItem) {
    const res = await fetch("/api/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, isActive: !s.isActive }),
    });
    if (res.ok) {
      await loadShifts();
    }
  }

  const canConfigure =
    user.role === "SUPERADMIN" || user.role === "ADMIN_SUCURSAL";
  const previewCrosses = doesShiftCrossMidnight(
    formData.startTime,
    formData.endTime
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
            Operación Farmacéutica Continua 24/7
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Configuración de Turnos de 24 Horas
          </h1>
          <p className="text-xs text-slate-500">
            Mañana, Tarde, Noche (cruza la medianoche ej. 22:00 a 06:00) y Personalizados por sucursal.
          </p>
        </div>

        {canConfigure && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Horario de Turno</span>
          </button>
        )}
      </div>

      {/* Explicación de Regla Operativa de Turnos Nocturnos */}
      <div className="bg-gradient-to-r from-[#0B192C] to-[#0F2547] text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center shrink-0">
            <Moon className="w-5 h-5 text-indigo-200" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white">
              Regla de Integridad para Turnos Nocturnos que Cruzan la Medianoche (22:00 a 06:00)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cuando un turno inicia a las <strong>22:00</strong> y finaliza a las <strong>06:00 del día siguiente</strong>, el sistema detecta automáticamente el cruce de medianoche y sugiere la <strong>fecha operativa de inicio del turno</strong>, evitando asignar la venta a un día o mes incorrecto.
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Turnos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500">
            Cargando turnos...
          </div>
        ) : (
          shifts.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        s.type === "NOCHE" || s.crossesMidnight
                          ? "bg-indigo-50 text-indigo-700"
                          : s.type === "MANANA"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {s.type === "NOCHE" || s.crossesMidnight ? (
                        <Moon className="w-5 h-5" />
                      ) : s.type === "MANANA" ? (
                        <Sun className="w-5 h-5" />
                      ) : (
                        <Sunset className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-500">
                        {s.branchName
                          ? `${s.branchCode} — ${s.branchName}`
                          : "🌐 Estándar Global (Todas las Sucursales)"}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        {s.name}
                      </h3>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.isActive ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>
                      {s.startTime} hrs → {s.endTime} hrs
                    </span>
                  </div>
                  {s.crossesMidnight && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-extrabold">
                      Cruza Medianoche (24h)
                    </span>
                  )}
                </div>

                {s.observations && (
                  <p className="text-xs text-slate-500">{s.observations}</p>
                )}
              </div>

              {canConfigure &&
                (user.role === "SUPERADMIN" ||
                  s.branchId === user.branchId) && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(s)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleShiftActive(s)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{s.isActive ? "Desactivar" : "Activar"}</span>
                    </button>
                  </div>
                )}
            </div>
          ))
        )}
      </div>

      {/* Modal Crear / Editar Turno */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingShift ? "Editar Turno" : "Configurar Nuevo Turno"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-3.5 text-xs">
              {user.role === "SUPERADMIN" && (
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Alcance de Sucursal
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) =>
                      setFormData({ ...formData, branchId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="">
                      🌐 Global (Disponible para todas las sucursales)
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">
                  Nombre del Turno *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">
                  Tipo de Turno *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as
                        | "MANANA"
                        | "TARDE"
                        | "NOCHE"
                        | "PERSONALIZADO",
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="MANANA">Mañana</option>
                  <option value="TARDE">Tarde</option>
                  <option value="NOCHE">Noche (24h)</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Hora de Inicio *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1">
                    Hora de Fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              {previewCrosses && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-medium">
                  🌙 Este horario cruza la medianoche (termina al día siguiente). Se activará la protección automática de fecha operativa.
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  value={formData.observations}
                  onChange={(e) =>
                    setFormData({ ...formData, observations: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {saving ? "Guardando..." : "Guardar Turno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
