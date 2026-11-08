"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";

const WEEKDAYS = [
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
  { day: 0, label: "Domingo" },
];

export default function ConfiguracionPage() {
  const [formData, setFormData] = useState({
    companyName: "CHÁVEZ METAS — Cadena de Farmacias",
    currencyCode: "BOB",
    currencySymbol: "Bs",
    timezone: "America/La_Paz",
    nightShiftOperationalRule: "START_DATE" as "START_DATE" | "END_DATE",
    operationalClosingTime: "06:00",
    defaultDistributionMethod: "UNIFORME" as
      | "UNIFORME"
      | "DIAS_OPERATIVOS"
      | "PERSONALIZADO",
    defaultOperatingDays: [0, 1, 2, 3, 4, 5, 6] as number[],
    holidayTreatment: "NORMAL" as "NORMAL" | "EXCLUIR" | "META_REDUCIDA_50",
    holidaysList: [] as string[],
    dailyGoalDisplayMode: "AMBAS" as "INDIVIDUAL" | "CONSOLIDADA" | "AMBAS",
    motivationalMsgCaseA:
      "¡Vamos, todavía podemos mejorar! Hoy nos faltaron {diferencia} para alcanzar nuestra meta diaria. Mañana tenemos una nueva oportunidad. ¡Esfuérzate, tú puedes!",
    motivationalMsgCaseB:
      "¡Excelente trabajo! Alcanzamos nuestra meta diaria. Cada esfuerzo cuenta y estamos avanzando hacia nuestro objetivo mensual. ¡Sigamos así!",
    motivationalMsgCaseC:
      "¡BARBARO! ¡Hoy superamos nuestra meta diaria! Tenemos {excedente} de saldo a favor. Ese excedente nos ayuda a cubrir los próximos días. ¡Sigue así!",
    alertThresholdWarning: 75,
    alertThresholdSuccess: 100,
    allowFutureDates: false,
    maxDaysBackdateRegistration: 3,
  });

  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setFormData((prev) => ({
            ...prev,
            ...data.settings,
            defaultOperatingDays: data.settings.defaultOperatingDays || [
              0, 1, 2, 3, 4, 5, 6,
            ],
            holidaysList: data.settings.holidaysList || [],
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleWeekday(day: number) {
    setFormData((prev) => ({
      ...prev,
      defaultOperatingDays: prev.defaultOperatingDays.includes(day)
        ? prev.defaultOperatingDays.filter((d) => d !== day)
        : [...prev.defaultOperatingDays, day],
    }));
  }

  function addHoliday() {
    if (!newHolidayDate) return;
    if (!formData.holidaysList.includes(newHolidayDate)) {
      setFormData((prev) => ({
        ...prev,
        holidaysList: [...prev.holidaysList, newHolidayDate].sort(),
      }));
    }
    setNewHolidayDate("");
  }

  function removeHoliday(dateStr: string) {
    setFormData((prev) => ({
      ...prev,
      holidaysList: prev.holidaysList.filter((d) => d !== dateStr),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedOk(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 4000);
      } else {
        const err = await res.json();
        alert(err.error || "Error al guardar la configuración");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Cargando configuración del sistema...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Parámetros de Negocio y Motivación Inteligente
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Configuración General de CHÁVEZ METAS
          </h1>
          <p className="text-xs text-slate-500">
            Define métodos de distribución de meta diaria, días operativos, cierre de turnos 24h, feriados y mensajes motivadores.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Guardando..." : "Guardar Configuración"}</span>
        </button>
      </div>

      {savedOk && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            Configuración guardada y registrada en la bitácora de auditoría exitosamente.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloque 1: Parámetros Corporativos y Turnos 24h */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              1. Identidad, Moneda, Zona Horaria y Cierre Operativo 24h
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Razón Social / Nombre de Plataforma
              </label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Moneda Oficial (Código / Símbolo)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.currencyCode}
                  onChange={(e) =>
                    setFormData({ ...formData, currencyCode: e.target.value })
                  }
                  className="w-1/2 px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) =>
                    setFormData({ ...formData, currencySymbol: e.target.value })
                  }
                  className="w-1/2 px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Zona Horaria del Negocio
              </label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) =>
                  setFormData({ ...formData, timezone: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Regla de Fecha Operativa en Turnos Nocturnos
              </label>
              <select
                value={formData.nightShiftOperationalRule}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nightShiftOperationalRule: e.target.value as
                      | "START_DATE"
                      | "END_DATE",
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                <option value="START_DATE">
                  Asignar al día en que inicia el turno (Recomendado 22:00-06:00)
                </option>
                <option value="END_DATE">
                  Asignar al día en que finaliza el turno
                </option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Horario de Cierre Operativo Diario
              </label>
              <input
                type="time"
                value={formData.operationalClosingTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    operationalClosingTime: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Bloque 2: Distribución de Meta Diaria y Calendario Feriados */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              2. Método de Distribución de Meta Diaria y Días Operativos
            </h2>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Método de Distribución por Defecto
              </label>
              <select
                value={formData.defaultDistributionMethod}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultDistributionMethod: e.target.value as
                      | "UNIFORME"
                      | "DIAS_OPERATIVOS"
                      | "PERSONALIZADO",
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                <option value="UNIFORME">
                  1. Distribución Uniforme (Todos los días del mes)
                </option>
                <option value="DIAS_OPERATIVOS">
                  2. Distribución por Días Operativos Configurados
                </option>
                <option value="PERSONALIZADO">
                  3. Distribución Personalizada por Día
                </option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1.5">
                Días Operativos Estándar de la Cadena
              </label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const active = formData.defaultOperatingDays.includes(w.day);
                  return (
                    <button
                      type="button"
                      key={w.day}
                      onClick={() => toggleWeekday(w.day)}
                      className={`px-3 py-1.5 rounded-lg font-bold border transition ${
                        active
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-slate-50 border-slate-300 text-slate-600"
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">
                  Tratamiento de Días Feriados
                </label>
                <select
                  value={formData.holidayTreatment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      holidayTreatment: e.target.value as
                        | "NORMAL"
                        | "EXCLUIR"
                        | "META_REDUCIDA_50",
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="NORMAL">
                    Normal (Farmacia 24h atiende igual)
                  </option>
                  <option value="META_REDUCIDA_50">
                    Meta Reducida al 50% en feriados
                  </option>
                  <option value="EXCLUIR">
                    Excluir feriados del cálculo diario
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1">
                  Visualización de Metas Diarias
                </label>
                <select
                  value={formData.dailyGoalDisplayMode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailyGoalDisplayMode: e.target.value as
                        | "INDIVIDUAL"
                        | "CONSOLIDADA"
                        | "AMBAS",
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="AMBAS">
                    Mostrar Individual por Sucursal y Consolidada Global
                  </option>
                  <option value="INDIVIDUAL">
                    Mostrar solo Individual por Sucursal
                  </option>
                  <option value="CONSOLIDADA">
                    Mostrar solo Consolidada Global
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-slate-700 mb-1">
                Calendario de Días Feriados
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300"
                />
                <button
                  type="button"
                  onClick={addHoliday}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Feriado</span>
                </button>
              </div>
              {formData.holidaysList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.holidaysList.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold"
                    >
                      <span>{h}</span>
                      <button
                        type="button"
                        onClick={() => removeHoliday(h)}
                        className="text-amber-700 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bloque 3: Mensajes Motivadores Automáticos */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                3. Plantillas de Mensajes Motivadores Automáticos ("¡Cada Día Cuenta!")
              </h2>
              <p className="text-xs text-slate-500">
                Variables dinámicas disponibles:{" "}
                <code className="bg-slate-100 px-1 rounded">
                  {"{diferencia}"}
                </code>
                ,{" "}
                <code className="bg-slate-100 px-1 rounded">
                  {"{excedente}"}
                </code>
                ,{" "}
                <code className="bg-slate-100 px-1 rounded">
                  {"{meta_diaria}"}
                </code>
                ,{" "}
                <code className="bg-slate-100 px-1 rounded">
                  {"{venta_dia}"}
                </code>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
              <label className="block font-extrabold text-amber-900 uppercase">
                CASO A: No se alcanzó la meta diaria
              </label>
              <textarea
                rows={4}
                required
                value={formData.motivationalMsgCaseA}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    motivationalMsgCaseA: e.target.value,
                  })
                }
                className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
              <label className="block font-extrabold text-blue-900 uppercase">
                CASO B: Se alcanzó exactamente la meta diaria
              </label>
              <textarea
                rows={4}
                required
                value={formData.motivationalMsgCaseB}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    motivationalMsgCaseB: e.target.value,
                  })
                }
                className="w-full p-2.5 rounded-xl border border-blue-300 bg-white text-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <label className="block font-extrabold text-emerald-900 uppercase">
                CASO C: Se superó la meta diaria (Excedente)
              </label>
              <textarea
                rows={4}
                required
                value={formData.motivationalMsgCaseC}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    motivationalMsgCaseC: e.target.value,
                  })
                }
                className="w-full p-2.5 rounded-xl border border-emerald-300 bg-white text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
