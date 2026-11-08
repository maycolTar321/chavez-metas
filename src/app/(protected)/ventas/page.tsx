"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Clock,
  Moon,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Ban,
  ShieldCheck,
  Calendar,
  Building2,
  X,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import {
  formatBOB,
  getBoliviaNow,
  suggestOperationalDateForShift,
} from "@/lib/utils";
import {
  hasGlobalBranchAccess,
  canUserRegisterSales,
  canUserEditSale,
  canUserVoidSale,
} from "@/lib/permissions";

interface ShiftOption {
  id: number;
  branchId: number | null;
  name: string;
  type: "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO";
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  isActive: boolean;
}

interface SaleRow {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  shiftName: string;
  shiftType: "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO";
  operationalDate: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  amount: number;
  registeredByName: string;
  status: "ACTIVO" | "EDITADO" | "ANULADO";
  voidReason: string | null;
  observations: string | null;
  createdAt: string;
}

export default function RegistroVentasPage() {
  const { user, branches, selectedBranchId } = useAppContext();
  const boliviaNow = getBoliviaNow();

  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const defaultBranchId = hasGlobalBranchAccess(user.role)
    ? selectedBranchId || branches.find((b) => b.isActive)?.id || 0
    : user.branchId || 0;

  const [formBranchId, setFormBranchId] = useState<number>(defaultBranchId);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [shiftName, setShiftName] = useState<string>("Turno Mañana");
  const [shiftType, setShiftType] = useState<
    "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO"
  >("MANANA");
  const [startTime, setStartTime] = useState<string>("06:00");
  const [endTime, setEndTime] = useState<string>("14:00");
  const [operationalDate, setOperationalDate] = useState<string>(
    boliviaNow.dateStr
  );
  const [amount, setAmount] = useState<string>("");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [qrAmount, setQrAmount] = useState<string>("");
  const [recAmount, setRecAmount] = useState<string>("");
  const [useBreakdown, setUseBreakdown] = useState<boolean>(true);
  const [observations, setObservations] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID()
  );

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modal de Edición / Anulación con trazabilidad
  const [modalSale, setModalSale] = useState<SaleRow | null>(null);
  const [modalAction, setModalAction] = useState<"EDIT" | "VOID">("EDIT");
  const [modalAmount, setModalAmount] = useState<string>("");
  const [modalDate, setModalDate] = useState<string>("");
  const [modalReason, setModalReason] = useState<string>("");
  const [modalSaving, setModalSaving] = useState<boolean>(false);

  useEffect(() => {
    if (hasGlobalBranchAccess(user.role) && selectedBranchId) {
      setFormBranchId(selectedBranchId);
    } else if (!hasGlobalBranchAccess(user.role) && user.branchId) {
      setFormBranchId(user.branchId);
    }
  }, [selectedBranchId, user]);

  const loadShiftsAndSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const branchQuery = formBranchId ? `?branchId=${formBranchId}` : "";
      const [shiftsRes, salesRes] = await Promise.all([
        fetch(`/api/shifts${branchQuery}`),
        fetch(`/api/sales${branchQuery}`),
      ]);

      if (shiftsRes.ok) {
        const sData = await shiftsRes.json();
        const activeShifts: ShiftOption[] = (sData.shifts || []).filter(
          (s: ShiftOption) => s.isActive
        );
        setShifts(activeShifts);

        if (activeShifts.length > 0 && !selectedShiftId) {
          const first = activeShifts[0];
          setSelectedShiftId(String(first.id));
          setShiftName(first.name);
          setShiftType(first.type);
          setStartTime(first.startTime);
          setEndTime(first.endTime);
        }
      }

      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSales(salesData.sales || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSales(false);
    }
  }, [formBranchId, selectedShiftId]);

  useEffect(() => {
    loadShiftsAndSales();
  }, [loadShiftsAndSales]);

  // Calcular sugerencia de fecha operativa cuando el turno cruza la medianoche
  const shiftDateSuggestion = suggestOperationalDateForShift(
    boliviaNow.dateStr,
    boliviaNow.hour,
    startTime,
    endTime
  );

  function handleSelectPresetShift(shiftIdStr: string) {
    setSelectedShiftId(shiftIdStr);
    if (shiftIdStr === "CUSTOM") {
      setShiftName("Turno Personalizado");
      setShiftType("PERSONALIZADO");
      return;
    }
    const found = shifts.find((s) => String(s.id) === shiftIdStr);
    if (found) {
      setShiftName(found.name);
      setShiftType(found.type);
      setStartTime(found.startTime);
      setEndTime(found.endTime);

      const suggestion = suggestOperationalDateForShift(
        boliviaNow.dateStr,
        boliviaNow.hour,
        found.startTime,
        found.endTime
      );
      setOperationalDate(suggestion.suggestedDate);
    }
  }

  function handleBreakdownChange(
    field: "cash" | "card" | "qr" | "rec",
    val: string
  ) {
    const nextCash = field === "cash" ? val : cashAmount;
    const nextCard = field === "card" ? val : cardAmount;
    const nextQr = field === "qr" ? val : qrAmount;
    const nextRec = field === "rec" ? val : recAmount;

    if (field === "cash") setCashAmount(val);
    if (field === "card") setCardAmount(val);
    if (field === "qr") setQrAmount(val);
    if (field === "rec") setRecAmount(val);

    const c = parseFloat(nextCash || "0") || 0;
    const t = parseFloat(nextCard || "0") || 0;
    const q = parseFloat(nextQr || "0") || 0;
    const r = parseFloat(nextRec || "0") || 0;
    const sum = c + t + q + r;
    setAmount(sum > 0 ? sum.toFixed(2) : "");
  }

  async function handleSubmitSale(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);

    try {
      const c = parseFloat(cashAmount || "0") || 0;
      const t = parseFloat(cardAmount || "0") || 0;
      const q = parseFloat(qrAmount || "0") || 0;
      const r = parseFloat(recAmount || "0") || 0;
      let finalObservations = observations;
      if (useBreakdown && (c > 0 || t > 0 || q > 0 || r > 0)) {
        const breakdownText = `[Desglose: Efectivo Bs ${c.toFixed(2)} | Tarjeta Bs ${t.toFixed(2)} | QR Bs ${q.toFixed(2)} | Recargas Bs ${r.toFixed(2)}]`;
        finalObservations = finalObservations
          ? `${finalObservations} - ${breakdownText}`
          : breakdownText;
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: formBranchId,
          shiftId:
            selectedShiftId && selectedShiftId !== "CUSTOM"
              ? Number(selectedShiftId)
              : null,
          shiftName,
          shiftType,
          operationalDate,
          startTime,
          endTime,
          amount: parseFloat(amount),
          observations: finalObservations,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          message: data.error || "Error al guardar la venta",
        });
        setSubmitting(false);
        return;
      }

      setFeedback({
        type: "success",
        message: `Venta registrada exitosamente por ${formatBOB(
          data.sale.amount
        )} en fecha operativa ${operationalDate}.`,
      });
      setAmount("");
      setCashAmount("");
      setCardAmount("");
      setQrAmount("");
      setRecAmount("");
      setObservations("");
      // Generar nueva clave de idempotencia para el siguiente registro
      setIdempotencyKey(crypto.randomUUID());
      await loadShiftsAndSales();
    } catch {
      setFeedback({
        type: "error",
        message: "Error de red al intentar guardar el registro.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openActionModal(sale: SaleRow, action: "EDIT" | "VOID") {
    setModalSale(sale);
    setModalAction(action);
    setModalAmount(String(sale.amount));
    setModalDate(sale.operationalDate);
    setModalReason("");
  }

  async function handleSaveModal(e: React.FormEvent) {
    e.preventDefault();
    if (!modalSale) return;
    setModalSaving(true);

    try {
      const res = await fetch(`/api/sales/${modalSale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalAction,
          amount: modalAction === "EDIT" ? parseFloat(modalAmount) : undefined,
          operationalDate: modalAction === "EDIT" ? modalDate : undefined,
          reason: modalReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo procesar la operación");
        setModalSaving(false);
        return;
      }
      setModalSale(null);
      await loadShiftsAndSales();
    } catch {
      alert("Error de conexión");
    } finally {
      setModalSaving(false);
    }
  }

  const userCanRegister = canUserRegisterSales(user);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
            Módulo Central • Turnos 24 Horas
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Registro de Ventas por Turno
          </h1>
          <p className="text-xs text-slate-500">
            Registra el importe vendido en Bolivianos (Bs) con validación en servidor, auditoría y protección de idempotencia.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-100 px-3.5 py-2 rounded-xl font-semibold text-slate-700">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>
            Hora Bolivia: {boliviaNow.dateStr} • {boliviaNow.timeStr}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Formulario de Registro */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5 h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Nuevo Registro de Venta
                </h2>
                <p className="text-xs text-slate-500">
                  Usuario que registra: <strong>{user.fullName}</strong>
                </p>
              </div>
            </div>
          </div>

          {!userCanRegister ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              Tu cuenta actual tiene acceso de lectura y supervisión, pero no tiene habilitado el permiso de registro de ventas.
            </div>
          ) : (
            <form onSubmit={handleSubmitSale} className="space-y-4">
              {feedback && (
                <div
                  className={`p-4 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                    feedback.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Sucursal */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Sucursal *
                </label>
                {hasGlobalBranchAccess(user.role) ? (
                  <select
                    required
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value={0} disabled>
                      Selecciona una sucursal...
                    </option>
                    {branches
                      .filter((b) => b.isActive)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>{user.branchName || `Sucursal #${user.branchId}`}</span>
                  </div>
                )}
              </div>

              {/* Selección de Turno */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Turno Operativo *
                </label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => handleSelectPresetShift(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} ({s.startTime} - {s.endTime})
                      {s.crossesMidnight ? " 🌙 Cruza medianoche" : ""}
                    </option>
                  ))}
                  <option value="CUSTOM">⚙️ Turno Personalizado...</option>
                </select>
              </div>

              {/* Si elige personalizado, permitir editar tipo y nombre */}
              {selectedShiftId === "CUSTOM" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre del Turno
                    </label>
                    <input
                      type="text"
                      required
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Clasificación
                    </label>
                    <select
                      value={shiftType}
                      onChange={(e) =>
                        setShiftType(
                          e.target.value as
                            | "MANANA"
                            | "TARDE"
                            | "NOCHE"
                            | "PERSONALIZADO"
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="MANANA">Mañana</option>
                      <option value="TARDE">Tarde</option>
                      <option value="NOCHE">Noche</option>
                      <option value="PERSONALIZADO">Personalizado</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Hora de Inicio y Hora de Finalización */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Hora de Inicio *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Hora de Finalización *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Alerta inteligente si el turno cruza la medianoche */}
              {shiftDateSuggestion.crossesMidnight && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-800">
                    <Moon className="w-4 h-4 shrink-0" />
                    <span>Turno Nocturno 24h (Cruza la Medianoche)</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    {shiftDateSuggestion.explanation}
                  </p>
                  {operationalDate !== shiftDateSuggestion.suggestedDate && (
                    <button
                      type="button"
                      onClick={() =>
                        setOperationalDate(shiftDateSuggestion.suggestedDate)
                      }
                      className="text-[11px] font-bold text-indigo-700 underline"
                    >
                      Usar fecha sugerida ({shiftDateSuggestion.suggestedDate})
                    </button>
                  )}
                </div>
              )}

              {/* Fecha Operativa */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fecha Operativa de la Venta *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={operationalDate}
                    onChange={(e) => setOperationalDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Desglose de Arqueo de Caja (Efectivo, Tarjeta, QR, Recargas) */}
              <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-blue-700" />
                    Arqueo por Conceptos (Fórmula Automática)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-200/70 text-blue-800">
                    TOTAL = EFECTIVO + TARJETA + REC + QR
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      1. Efectivo (Bs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={cashAmount}
                      onChange={(e) => handleBreakdownChange("cash", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      2. Tarjeta (Bs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={cardAmount}
                      onChange={(e) => handleBreakdownChange("card", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      3. QR (Bs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={qrAmount}
                      onChange={(e) => handleBreakdownChange("qr", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      4. Recargas / Otros (Bs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={recAmount}
                      onChange={(e) => handleBreakdownChange("rec", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Importe Vendido Total en Bs */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Importe Vendido Total en Bolivianos (Bs) *
                  </label>
                  {amount && (
                    <span className="text-[11px] font-extrabold text-blue-700">
                      Total Calculado: {formatBOB(parseFloat(amount) || 0)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-blue-700">
                    Bs
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-blue-200 focus:border-blue-600 text-lg font-extrabold text-slate-900 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Observaciones del Turno (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Cierre de caja turno noche sin novedades, arqueo verificado..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !formBranchId}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {submitting
                    ? "Validando y Guardando en PostgreSQL..."
                    : "Guardar Registro de Venta en Bs"}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Columna Derecha: Listado de Ventas Recientes de la Sucursal */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Registros de Ventas Recientes
              </h2>
              <p className="text-xs text-slate-500">
                Trazabilidad completa: ningún registro se borra físicamente
              </p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Fecha Operativa</th>
                  <th className="py-3 px-4">Sucursal / Turno</th>
                  <th className="py-3 px-4 text-right">Importe (Bs)</th>
                  <th className="py-3 px-4">Registrado por</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loadingSales ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-xs text-slate-500"
                    >
                      Cargando registros de ventas...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-xs text-slate-500"
                    >
                      No hay ventas registradas para esta selección.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => {
                    const allowEdit = canUserEditSale(user, s.branchId);
                    const allowVoid =
                      canUserVoidSale(user, s.branchId) &&
                      s.status !== "ANULADO";
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {s.operationalDate}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800 text-xs">
                            {s.branchCode} — {s.branchName}
                          </p>
                          <p className="text-xs text-slate-600">
                            {s.shiftName} ({s.startTime} - {s.endTime})
                            {s.crossesMidnight && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                24h Nocturno
                              </span>
                            )}
                          </p>
                          {s.observations && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                              “{s.observations}”
                            </p>
                          )}
                          {s.voidReason && (
                            <p className="text-[11px] text-red-600 font-semibold mt-0.5">
                              Motivo anulación: {s.voidReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                          {formatBOB(s.amount)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {s.registeredByName}
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
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {allowEdit && s.status !== "ANULADO" && (
                              <button
                                type="button"
                                onClick={() => openActionModal(s, "EDIT")}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                                title="Editar importe o fecha con motivo de auditoría"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {allowVoid && (
                              <button
                                type="button"
                                onClick={() => openActionModal(s, "VOID")}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                title="Anular registro con trazabilidad"
                              >
                                <Ban className="w-4 h-4" />
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
      </div>

      {/* Modal de Edición o Anulación Auditada */}
      {modalSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {modalAction === "VOID"
                  ? `Anular Registro de Venta #${modalSale.id}`
                  : `Editar Registro de Venta #${modalSale.id}`}
              </h3>
              <button
                onClick={() => setModalSale(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {modalAction === "EDIT" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Nuevo Importe en Bs
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={modalAmount}
                      onChange={(e) => setModalAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Fecha Operativa
                    </label>
                    <input
                      type="date"
                      required
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Motivo Obligatorio para Auditoría *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  placeholder="Explica claramente por qué se modifica o anula este registro..."
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSale(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold ${
                    modalAction === "VOID"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {modalSaving
                    ? "Guardando..."
                    : modalAction === "VOID"
                    ? "Confirmar Anulación"
                    : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
