"use client";

import React, { useState } from "react";
import {
  Flame,
  Trophy,
  Sparkles,
  TrendingUp,
  CalendarCheck2,
  ArrowRight,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatBOB, formatPercent } from "@/lib/utils";
import type { DailyIntelligenceResult } from "@/lib/daily-goal-engine";

export default function DailyMotivationCard({
  intelligence,
  titleSubtitle,
}: {
  intelligence: DailyIntelligenceResult;
  titleSubtitle?: string;
}) {
  const [showClosingSummary, setShowClosingSummary] = useState(false);

  const isGreen = intelligence.visualStatus === "VERDE";
  const isOrange = intelligence.visualStatus === "NARANJA";

  const containerStyle = isGreen
    ? "bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 border-emerald-500/40 text-white"
    : isOrange
    ? "bg-gradient-to-br from-amber-900 via-orange-900 to-[#0B192C] border-amber-500/40 text-white"
    : "bg-gradient-to-br from-[#0B192C] via-[#0F2547] to-blue-900 border-blue-500/40 text-white";

  const badgeStyle = isGreen
    ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/40"
    : isOrange
    ? "bg-amber-400/20 text-amber-200 border-amber-400/40"
    : "bg-blue-400/20 text-blue-200 border-blue-400/40";

  const progressColor = isGreen
    ? "bg-emerald-400"
    : isOrange
    ? "bg-amber-400"
    : "bg-blue-400";

  const methodLabel =
    intelligence.distributionMethod === "UNIFORME"
      ? "Distribución Uniforme Mensual"
      : intelligence.distributionMethod === "DIAS_OPERATIVOS"
      ? "Distribución por Días Operativos"
      : "Distribución Personalizada por Día";

  return (
    <>
      <div
        className={`rounded-2xl p-6 border shadow-xl relative overflow-hidden transition-all ${containerStyle}`}
      >
        {/* Cabecera de la Tarjeta Visual de Motivación */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                isGreen
                  ? "bg-emerald-500 text-white"
                  : isOrange
                  ? "bg-amber-500 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {isGreen ? (
                <Trophy className="w-6 h-6" />
              ) : isOrange ? (
                <Flame className="w-6 h-6" />
              ) : (
                <Sparkles className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${badgeStyle}`}
                >
                  META DIARIA — ¡CADA DÍA CUENTA!
                </span>
                <span className="text-xs text-white/75 font-medium">
                  • {methodLabel} ({intelligence.todayDate})
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1.5 leading-snug">
                {intelligence.primaryMotivationalMessage}
              </h2>
              {titleSubtitle && (
                <p className="text-xs text-white/75 mt-1">{titleSubtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowClosingSummary(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition"
            >
              <FileText className="w-4 h-4 text-blue-300" />
              <span>Ver Resumen de Cierre del Día</span>
            </button>
          </div>
        </div>

        {/* 7 Indicadores Principales del Panel de Meta Diaria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-5">
          {/* 1. Meta Diaria Estimada vs Meta Mensual */}
          <div className="bg-black/25 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
              1. Meta Diaria de Hoy
            </span>
            <p className="text-2xl font-extrabold text-white mt-1">
              {formatBOB(intelligence.todayBaseTarget)}
            </p>
            <p className="text-xs text-white/70 mt-1">
              Meta Mensual:{" "}
              <strong className="text-white">
                {formatBOB(intelligence.monthlyGoalAmount)}
              </strong>
            </p>
          </div>

          {/* 2. Venta Acumulada del Día y Diferencia */}
          <div className="bg-black/25 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
              2. Venta Acumulada Hoy
            </span>
            <p className="text-2xl font-extrabold text-white mt-1">
              {formatBOB(intelligence.todaySales)}
            </p>
            <p className="text-xs mt-1">
              {intelligence.todaySurplus > 0 ? (
                <span className="text-emerald-300 font-bold">
                  + {formatBOB(intelligence.todaySurplus)} sobre la meta de hoy
                </span>
              ) : intelligence.todayPending > 0 ? (
                <span className="text-amber-300 font-bold">
                  Faltan {formatBOB(intelligence.todayPending)} hoy
                </span>
              ) : (
                <span className="text-emerald-300 font-bold">
                  ¡Meta de hoy alcanzada al 100%!
                </span>
              )}
            </p>
          </div>

          {/* 3. Saldo Acumulado a Favor o Pendiente */}
          <div className="bg-black/25 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
              3. Saldo Acumulado del Mes
            </span>
            <p
              className={`text-2xl font-extrabold mt-1 ${
                intelligence.cumulativeBalance >= 0
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {intelligence.cumulativeBalance >= 0 ? "+ " : "- "}
              {formatBOB(Math.abs(intelligence.cumulativeBalance))}
            </p>
            <p className="text-xs text-white/80 mt-1">
              {intelligence.cumulativeBalance >= 0
                ? "Saldo acumulado A FAVOR"
                : "Saldo acumulado PENDIENTE"}
            </p>
          </div>

          {/* 4. Meta Necesaria para los Próximos Días */}
          <div className="bg-black/25 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
              4. Meta Próximos Días ({intelligence.remainingOperatingDays}d rest.)
            </span>
            <p className="text-2xl font-extrabold text-white mt-1">
              {intelligence.isMonthlyGoalFulfilled
                ? "¡Meta Cumplida!"
                : formatBOB(intelligence.adjustedNextDaysTarget)}
            </p>
            <p className="text-xs text-white/75 mt-1">
              {intelligence.isMonthlyGoalFulfilled
                ? `Excedente mes: +${formatBOB(intelligence.monthlySurplusAmount)}`
                : "Ajuste automático por día restante"}
            </p>
          </div>
        </div>

        {/* Barra de Progreso Diario y Explicación del Saldo Acumulado + Ajuste Automático */}
        <div className="space-y-3 bg-black/20 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-300" />
              <span>
                Avance de Meta Diaria de Hoy:{" "}
                {formatPercent(intelligence.todayCompliancePercent)}
              </span>
            </span>
            <span>
              {formatBOB(intelligence.todaySales)} /{" "}
              {formatBOB(intelligence.todayBaseTarget)}
            </span>
          </div>

          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{
                width: `${Math.min(100, intelligence.todayCompliancePercent)}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="flex items-start gap-2 text-white/90">
              {intelligence.cumulativeBalance >= 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              )}
              <span>{intelligence.cumulativeBalanceMessage}</span>
            </div>
            <div className="flex items-start gap-2 text-white/85 lg:border-l lg:border-white/15 lg:pl-3">
              <CalendarCheck2 className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
              <span>{intelligence.adjustmentExplanation}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Resumen al Cierre del Día Operativo */}
      {showClosingSummary && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    RESUMEN DEL DÍA OPERATIVO ({intelligence.todayDate})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Basado en el día operativo (respeta turnos 24h que cruzan medianoche)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClosingSummary(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Meta Esperada Hoy:</span>
                <strong className="text-base font-extrabold text-slate-900">
                  {formatBOB(intelligence.todayBaseTarget)}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Venta Real Hoy:</span>
                <strong className="text-base font-extrabold text-blue-700">
                  {formatBOB(intelligence.todaySales)}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Diferencia del Día:
                </span>
                <strong
                  className={`text-base font-extrabold ${
                    intelligence.todayDifference >= 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {intelligence.todayDifference >= 0 ? "+ " : "- "}
                  {formatBOB(Math.abs(intelligence.todayDifference))}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Saldo Acumulado Mes:
                </span>
                <strong
                  className={`text-base font-extrabold ${
                    intelligence.cumulativeBalance >= 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {intelligence.cumulativeBalance >= 0 ? "+ " : "- "}
                  {formatBOB(Math.abs(intelligence.cumulativeBalance))}
                </strong>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs whitespace-pre-line leading-relaxed font-medium">
              {intelligence.closingDaySummaryText}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-blue-600" />
                <span>
                  Meta necesaria para mañana:{" "}
                  <strong className="text-slate-900">
                    {formatBOB(intelligence.adjustedNextDaysTarget)}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowClosingSummary(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Cerrar Resumen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
