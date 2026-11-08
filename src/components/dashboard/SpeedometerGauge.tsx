"use client";

import React from "react";
import { formatBOB, formatPercent } from "@/lib/utils";
import { Target, TrendingUp, AlertCircle, CheckCircle2, Award } from "lucide-react";

interface SpeedometerProps {
  title: string;
  subtitle: string;
  type: "DIARIA" | "GENERAL";
  targetAmount: number;
  actualAmount: number;
  percentage: number;
  missingAmount?: number;
  surplusAmount?: number;
}

export default function SpeedometerGauge({
  title,
  subtitle,
  type,
  targetAmount,
  actualAmount,
  percentage,
  missingAmount = 0,
  surplusAmount = 0,
}: SpeedometerProps) {
  // Clamped percentage for needle angle (0% to 150%)
  const clampedPercent = Math.max(0, Math.min(150, percentage));
  // Angle: 0% -> -90 deg (left), 100% -> +30 deg, 150% -> +90 deg (right)
  // Total span 180 deg: angle = -90 + (clampedPercent / 150) * 180
  const needleAngle = -90 + (clampedPercent / 150) * 180;

  const isFulfilled = percentage >= 100;
  const isNear = percentage >= 75 && percentage < 100;

  // Arc stroke dash calculations for 180 deg arc with radius 75 (circumference = PI * 75 ≈ 235.6)
  const arcLength = 235.6;
  const progressRatio = Math.min(1, Math.max(0, percentage / 100));
  const strokeDashoffset = arcLength * (1 - progressRatio);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
              type === "DIARIA"
                ? "bg-sky-100 text-sky-800 border border-sky-300"
                : "bg-blue-100 text-blue-800 border border-blue-300"
            }`}
          >
            {type === "DIARIA" ? (
              <Target className="w-3.5 h-3.5 text-sky-600" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            )}
            {title}
          </span>
          <p className="text-xs text-slate-500 font-medium mt-1">{subtitle}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-black ${
            isFulfilled
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : isNear
              ? "bg-sky-50 text-sky-700 border border-sky-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {formatPercent(percentage)}
        </span>
      </div>

      {/* Speedometer SVG Visual */}
      <div className="relative flex flex-col items-center justify-center my-3 pt-2">
        <svg
          viewBox="0 0 200 115"
          className="w-48 sm:w-56 h-auto overflow-visible select-none drop-shadow-xs"
        >
          <defs>
            <linearGradient id={`gaugeGrad-${type}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" /> {/* Sky blue */}
              <stop offset="60%" stopColor="#2563EB" /> {/* Chavez blue */}
              <stop offset="100%" stopColor="#10B981" /> {/* Emerald success */}
            </linearGradient>
            <filter id={`needleShadow-${type}`} x1="-20%" y1="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Background track arc (180 degrees) */}
          <path
            d="M 25 100 A 75 75 0 0 1 175 100"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Dynamic filled arc */}
          <path
            d="M 25 100 A 75 75 0 0 1 175 100"
            fill="none"
            stroke={`url(#gaugeGrad-${type})`}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />

          {/* Scale markers (0%, 50%, 100%, 150%) */}
          <text x="22" y="115" fontSize="9" fill="#94A3B8" fontWeight="bold" textAnchor="middle">
            0%
          </text>
          <text x="100" y="20" fontSize="9" fill="#94A3B8" fontWeight="bold" textAnchor="middle">
            100%
          </text>
          <text x="178" y="115" fontSize="9" fill="#94A3B8" fontWeight="bold" textAnchor="middle">
            150%+
          </text>

          {/* Needle Pin and Pointer */}
          <g
            transform={`translate(100, 100) rotate(${needleAngle})`}
            className="transition-transform duration-700 ease-out"
            filter={`url(#needleShadow-${type})`}
          >
            {/* Needle shape */}
            <polygon points="-3,0 0,-70 3,0" fill="#0F172A" />
            <circle cx="0" cy="0" r="7" fill="#1E293B" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#38BDF8" />
          </g>
        </svg>

        {/* Central percentage reading badge */}
        <div className="text-center mt-[-10px]">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight block">
            {formatPercent(percentage)}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {isFulfilled ? "¡Meta Alcanzada!" : type === "DIARIA" ? "Avance Diario" : "Avance Mensual"}
          </span>
        </div>
      </div>

      {/* Quantitative breakdown grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 text-xs">
        <div className="bg-slate-50 rounded-xl p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            {type === "DIARIA" ? "Meta del Día" : "Meta Mensual"}
          </span>
          <p className="text-sm font-extrabold text-slate-900 mt-0.5">
            {formatBOB(targetAmount)}
          </p>
        </div>

        <div className="bg-blue-50/70 rounded-xl p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
            {type === "DIARIA" ? "Ventas del Día" : "Ventas Acumuladas"}
          </span>
          <p className="text-sm font-extrabold text-blue-900 mt-0.5">
            {formatBOB(actualAmount)}
          </p>
        </div>

        <div className="bg-amber-50/70 rounded-xl p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            {type === "DIARIA" ? "Monto Faltante" : "Monto Restante"}
          </span>
          <p className="text-sm font-extrabold text-amber-800 mt-0.5">
            {missingAmount > 0 ? formatBOB(missingAmount) : "Bs 0,00"}
          </p>
        </div>

        <div className="bg-emerald-50/70 rounded-xl p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Excedente
          </span>
          <p className="text-sm font-extrabold text-emerald-800 mt-0.5">
            {surplusAmount > 0 ? `+ ${formatBOB(surplusAmount)}` : "Bs 0,00"}
          </p>
        </div>
      </div>

      {/* Motivational Status Footer */}
      <div className="mt-3 pt-2 text-center">
        {isFulfilled ? (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>¡Objetivo superado con éxito!</span>
          </div>
        ) : isNear ? (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-sky-700">
            <TrendingUp className="w-4 h-4 text-sky-600" />
            <span>¡A tiro de meta! Falta solo {formatBOB(missingAmount)}.</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>En ritmo activo para completar la cuota.</span>
          </div>
        )}
      </div>
    </div>
  );
}
