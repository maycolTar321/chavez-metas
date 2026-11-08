"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  PlusCircle,
  Calendar,
  Award,
  ArrowUpRight,
  BarChart3,
  Layers,
} from "lucide-react";
import { useAppContext } from "@/components/layout/AppShell";
import { formatBOB, formatPercent, MONTHS_ES, getMonthName } from "@/lib/utils";
import type { DashboardPayload } from "@/lib/analytics";
import DailyMotivationCard from "@/components/motivation/DailyMotivationCard";
import SpeedometerGauge from "@/components/dashboard/SpeedometerGauge";

export default function DashboardPage() {
  const { user, selectedBranchId } = useAppContext();
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (selectedBranchId) {
        params.set("branchId", String(selectedBranchId));
      }
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al cargar el dashboard");
      }
      setData(json);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al cargar"
      );
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedBranchId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-white rounded-2xl border border-slate-200" />
        <div className="h-60 bg-white rounded-2xl border border-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-32 bg-white rounded-2xl border border-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span>Error al consultar datos del Dashboard</span>
        </div>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
        >
          Reintentar Ahora
        </button>
      </div>
    );
  }

  if (!data) return null;

  const {
    globalKpis,
    globalDailyIntelligence,
    branchSummaries,
    dailyEvolution,
    monthlyEvolution,
  } = data;

  const singleBranch =
    !data.isGlobalView && branchSummaries.length === 1
      ? branchSummaries[0]
      : null;

  const maxDailySale = Math.max(
    1,
    ...dailyEvolution.map((d) => d.dailySales)
  );
  const maxMonthlyVal = Math.max(
    1,
    ...monthlyEvolution.map((m) => Math.max(m.totalGoal, m.totalSales))
  );

  return (
    <div className="space-y-6">
      {/* Encabezado de Control y Filtros de Periodo */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              CHÁVEZ METAS
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Día {data.period.elapsedDays} de {data.period.daysInMonth} ({data.period.remainingDays} días restantes)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight">
            SUCURSAL CENTRAL — CAMPERO
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Control de metas y ventas de la operación comercial • {getMonthName(month)} {year}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 ml-2" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 py-1.5 px-2 focus:outline-none"
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
              className="bg-transparent text-xs font-bold text-slate-800 py-1.5 px-2 focus:outline-none border-l border-slate-300"
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
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              autoRefresh
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
            title="Actualización automática cada 30 segundos"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              }`}
            />
            <span>Tiempo Real {autoRefresh ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={fetchDashboard}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            title="Actualizar ahora"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`}
            />
          </button>

          {user.role !== "INVITADO" && (
            <Link
              href="/ventas"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Venta</span>
            </Link>
          )}
        </div>
      </div>

      {/* PANEL DESTACADO: META DIARIA INTELIGENTE Y MOTIVACIÓN — ¡CADA DÍA CUENTA! */}
      <DailyMotivationCard
        intelligence={globalDailyIntelligence}
        titleSubtitle="Sucursal CENTRAL (CAMPERO) — Operación Continua 24 Horas"
      />

      {/* VELOCÍMETROS DE RENDIMIENTO: META DIARIA Y META GENERAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpeedometerGauge
          title="Meta Diaria"
          subtitle={`Control de venta del día (${data.period.todayDate})`}
          type="DIARIA"
          targetAmount={globalDailyIntelligence.todayBaseTarget}
          actualAmount={globalDailyIntelligence.todaySales}
          percentage={globalDailyIntelligence.todayCompliancePercent}
          missingAmount={globalDailyIntelligence.todayPending}
          surplusAmount={globalDailyIntelligence.todaySurplus}
        />
        <SpeedometerGauge
          title="Meta General"
          subtitle={`Avance acumulado del mes (${getMonthName(month)} ${year})`}
          type="GENERAL"
          targetAmount={globalKpis.totalMonthlyGoal}
          actualAmount={globalKpis.totalAccumulatedSales}
          percentage={globalKpis.globalCompliancePercent}
          missingAmount={globalKpis.totalPendingBalance}
          surplusAmount={globalKpis.totalSurplusBalance}
        />
      </div>

      {/* Tarjetas KPI Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Meta Mensual */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Meta Mensual — CENTRAL (CAMPERO)
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900">
              {formatBOB(globalKpis.totalMonthlyGoal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Sucursal Central • CAMPERO
            </p>
          </div>
        </div>

        {/* KPI 2: Ventas Acumuladas del Mes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ventas Acumuladas Mes
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900">
              {formatBOB(globalKpis.totalAccumulatedSales)}
            </p>
            <div className="mt-2 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  globalKpis.globalCompliancePercent >= 100
                    ? "bg-emerald-500"
                    : globalKpis.globalCompliancePercent >= 75
                    ? "bg-blue-600"
                    : "bg-amber-500"
                }`}
                style={{
                  width: `${Math.min(100, globalKpis.globalCompliancePercent)}%`,
                }}
              />
            </div>
            <p className="text-xs font-semibold text-slate-700 mt-1.5 flex items-center justify-between">
              <span>Cumplimiento:</span>
              <span
                className={
                  globalKpis.globalCompliancePercent >= 100
                    ? "text-emerald-600 font-bold"
                    : "text-blue-600 font-bold"
                }
              >
                {formatPercent(globalKpis.globalCompliancePercent)}
              </span>
            </p>
          </div>
        </div>

        {/* KPI 3: Saldo Pendiente y Excedente */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Saldo Pendiente / Excedente Mes
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div>
              <span className="text-[11px] text-slate-500 block">
                Falta para alcanzar la meta mensual:
              </span>
              <p className="text-xl font-extrabold text-amber-600">
                {formatBOB(globalKpis.totalPendingBalance)}
              </p>
            </div>
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Excedente Mes:</span>
              <span className="font-bold text-emerald-600">
                + {formatBOB(globalKpis.totalSurplusBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Ventas de Hoy vs Ventas de Ayer */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ventas de Hoy ({data.period.todayDate})
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <p className="text-2xl font-extrabold text-slate-900">
              {formatBOB(globalKpis.todaySales)}
            </p>
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Ayer ({data.period.yesterdayDate}):
              </span>
              <span className="font-bold text-slate-800">
                {formatBOB(globalKpis.yesterdaySales)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Segunda fila de KPIs: Promedio Diario, Proyección de Cierre y Estado de Sucursales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B192C] text-white rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
            Promedio Diario Real
          </span>
          <p className="text-xl font-extrabold mt-2">
            {formatBOB(globalKpis.dailyAverageGlobal)} / día
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Calculado sobre {data.period.elapsedDays} días operativos transcurridos
          </p>
        </div>

        <div className="bg-[#0F2547] text-white rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Proyección de Cierre Mensual
          </span>
          <p className="text-xl font-extrabold mt-2">
            {formatBOB(globalKpis.projectedGlobalClosing)}
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Estimación al día {data.period.daysInMonth} manteniendo el ritmo actual
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Sucursales que Cumplieron
            </span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">
              {globalKpis.branchesFulfilledCount}
            </p>
            <span className="text-xs text-slate-500">
              Meta alcanzada (≥ 100%)
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Sucursales Pendientes
            </span>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">
              {globalKpis.branchesPendingCount}
            </p>
            <span className="text-xs text-slate-500">
              En progreso de meta mensual
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Gráficos Analíticos: Evolución de Ventas Diarias y Evolución Mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>
                  Evolución de Ventas Diarias ({getMonthName(month)} {year})
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Importes registrados en Bolivianos (Bs) por fecha operativa vs Meta Diaria ({formatBOB(globalDailyIntelligence.todayBaseTarget)})
              </p>
            </div>
          </div>

          <div className="h-56 flex items-end gap-1.5 pt-6 pb-2 border-b border-slate-200 overflow-x-auto">
            {dailyEvolution.map((day) => {
              const heightPercent =
                day.dailySales > 0
                  ? Math.max(8, Math.round((day.dailySales / maxDailySale) * 100))
                  : 2;
              const isToday = day.date === data.period.todayDate;
              const beatDailyGoal =
                globalDailyIntelligence.todayBaseTarget > 0 &&
                day.dailySales >= globalDailyIntelligence.todayBaseTarget;
              return (
                <div
                  key={day.date}
                  className="flex-1 min-w-[16px] flex flex-col items-center group relative h-full justify-end"
                >
                  <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-14 z-20 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap shadow-lg">
                    <p className="font-bold">
                      Día {day.dayNumber}: {formatBOB(day.dailySales)}
                    </p>
                    <p className="text-blue-300">
                      Acum: {formatBOB(day.cumulativeSales)}
                    </p>
                  </div>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isToday
                        ? "bg-amber-500"
                        : beatDailyGoal
                        ? "bg-emerald-500 hover:bg-emerald-600"
                        : day.dailySales > 0
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-slate-100"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-[10px] text-slate-500 mt-1 font-medium">
                    {day.dayNumber}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500" />
                Meta diaria alcanzada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-blue-600" />
                En progreso
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500" />
                Hoy ({data.period.todayDate})
              </span>
            </div>
            <span>Pico diario: {formatBOB(maxDailySale)}</span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Evolución Mensual: Meta frente a Ventas
            </h2>
            <p className="text-xs text-slate-500">
              Comparativa histórica de los últimos 6 meses en Bs
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {monthlyEvolution.map((item) => {
              const goalWidth = Math.round(
                (item.totalGoal / maxMonthlyVal) * 100
              );
              const salesWidth = Math.round(
                (item.totalSales / maxMonthlyVal) * 100
              );
              return (
                <div
                  key={`${item.year}-${item.month}`}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      {item.label}
                    </span>
                    <span
                      className={`font-bold ${
                        item.compliancePercent >= 100
                          ? "text-emerald-600"
                          : "text-blue-600"
                      }`}
                    >
                      {formatPercent(item.compliancePercent)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="w-12 text-slate-500">Meta:</span>
                      <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-slate-500 h-full rounded-full"
                          style={{ width: `${Math.max(2, goalWidth)}%` }}
                        />
                      </div>
                      <span className="w-28 text-right font-medium text-slate-600">
                        {formatBOB(item.totalGoal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="w-12 text-slate-700 font-semibold">
                        Ventas:
                      </span>
                      <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.compliancePercent >= 100
                              ? "bg-emerald-500"
                              : "bg-blue-600"
                          }`}
                          style={{ width: `${Math.max(2, salesWidth)}%` }}
                        />
                      </div>
                      <span className="w-28 text-right font-bold text-slate-900">
                        {formatBOB(item.totalSales)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comparación de Sucursales */}
      {data.isGlobalView && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Sucursales con Mejor Rendimiento y Saldo a Favor
                </h2>
              </div>
              <Link
                href="/rendimiento"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                Ver ranking completo <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {data.topBranches.map((b, idx) => (
                <div
                  key={b.branchId}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {b.branchCode} — {b.branchName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Hoy: <strong>{formatBOB(b.todaySales)}</strong> / Meta día:{" "}
                        {formatBOB(b.dailyIntelligence.todayBaseTarget)} • Saldo acum:{" "}
                        <strong
                          className={
                            b.dailyIntelligence.cumulativeBalance >= 0
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }
                        >
                          {b.dailyIntelligence.cumulativeBalance >= 0 ? "+" : "-"}
                          {formatBOB(
                            Math.abs(b.dailyIntelligence.cumulativeBalance)
                          )}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        b.compliancePercent >= 100
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {formatPercent(b.compliancePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  Sucursales con Saldo Pendiente por Recuperar
                </h2>
              </div>
              <Link
                href="/metas"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Revisar metas diarias
              </Link>
            </div>

            <div className="space-y-3">
              {data.attentionBranches.length === 0 ? (
                <div className="p-6 rounded-xl bg-emerald-50 text-emerald-800 text-center text-xs font-semibold">
                  ¡Excelente! Todas las sucursales activas han cumplido su meta mensual.
                </div>
              ) : (
                data.attentionBranches.map((b) => (
                  <div
                    key={b.branchId}
                    className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {b.branchCode} — {b.branchName}
                      </p>
                      <p className="text-xs text-slate-600">
                        Saldo acum:{" "}
                        <strong
                          className={
                            b.dailyIntelligence.cumulativeBalance >= 0
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {b.dailyIntelligence.cumulativeBalance >= 0 ? "+" : "-"}
                          {formatBOB(
                            Math.abs(b.dailyIntelligence.cumulativeBalance)
                          )}
                        </strong>{" "}
                        • Nueva meta próximos días:{" "}
                        <strong>
                          {formatBOB(
                            b.dailyIntelligence.adjustedNextDaysTarget
                          )}
                          /día
                        </strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          b.status === "EN_RIESGO"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {formatPercent(b.compliancePercent)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabla Comparativa de Cumplimiento y Meta Diaria por Sucursal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Control de Meta Mensual, Meta Diaria, Saldo Acumulado y Próximos Días ({getMonthName(month)} {year})
            </h2>
            <p className="text-xs text-slate-500">
              Consulta en tiempo real del saldo a favor o pendiente de cada sucursal
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4 text-right">Meta Mensual</th>
                <th className="py-3.5 px-4 text-right">Meta Diaria Hoy</th>
                <th className="py-3.5 px-4 text-right">Venta Hoy</th>
                <th className="py-3.5 px-4 text-right">Saldo Acumulado</th>
                <th className="py-3.5 px-4 text-right">Meta Próximos Días</th>
                <th className="py-3.5 px-4 text-center">Cumplimiento Mes</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {branchSummaries.map((b) => {
                const di = b.dailyIntelligence;
                return (
                  <tr key={b.branchId} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">
                        {b.branchCode} — {b.branchName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Acum. Mes: <strong>{formatBOB(b.accumulatedSales)}</strong>
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                      {formatBOB(b.goalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                      {formatBOB(di.todayBaseTarget)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <p className="font-extrabold text-slate-900">
                        {formatBOB(b.todaySales)}
                      </p>
                      <span
                        className={`text-[11px] font-bold ${
                          di.todayDifference >= 0
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {di.todayDifference >= 0 ? "+" : "-"}
                        {formatBOB(Math.abs(di.todayDifference))}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          di.cumulativeBalance >= 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {di.cumulativeBalance >= 0
                          ? `+${formatBOB(di.cumulativeBalance)} a favor`
                          : `-${formatBOB(Math.abs(di.cumulativeBalance))} pend.`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-blue-700">
                      {di.isMonthlyGoalFulfilled ? (
                        <span className="text-emerald-600">¡Meta Cumplida!</span>
                      ) : (
                        `${formatBOB(di.adjustedNextDaysTarget)} / día`
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-extrabold text-slate-900">
                          {formatPercent(b.compliancePercent)}
                        </span>
                        <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              b.compliancePercent >= 100
                                ? "bg-emerald-500"
                                : b.compliancePercent >= 75
                                ? "bg-blue-600"
                                : "bg-amber-500"
                            }`}
                            style={{
                              width: `${Math.min(100, b.compliancePercent)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          b.status === "CUMPLIDA"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.status === "EN_CAMINO"
                            ? "bg-blue-100 text-blue-800"
                            : b.status === "EN_RIESGO"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.status === "CUMPLIDA"
                          ? "META CUMPLIDA"
                          : b.status === "EN_CAMINO"
                          ? "EN CAMINO"
                          : b.status === "EN_RIESGO"
                          ? "ATENCIÓN"
                          : "SIN META"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimos Registros de Ventas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Últimos Registros de Ventas en Turno
            </h2>
            <p className="text-xs text-slate-500">
              Actividad reciente sincronizada con PostgreSQL
            </p>
          </div>
          <Link
            href="/historial"
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Ver Historial Completo →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Fecha Operativa</th>
                <th className="py-3 px-4">Sucursal</th>
                <th className="py-3 px-4">Turno y Horario</th>
                <th className="py-3 px-4">Registrado por</th>
                <th className="py-3 px-4 text-right">Importe (Bs)</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.recentSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    Aún no existen ventas registradas para este filtro.
                  </td>
                </tr>
              ) : (
                data.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {sale.operationalDate}
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <span className="font-bold">{sale.branchCode}</span> —{" "}
                      {sale.branchName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">
                        {sale.shiftName}
                      </span>{" "}
                      <span className="text-xs text-slate-500">
                        ({sale.startTime} - {sale.endTime})
                      </span>
                      {sale.crossesMidnight && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          Cruza 00:00
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {sale.registeredByName}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatBOB(sale.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.status === "ACTIVO"
                            ? "bg-emerald-100 text-emerald-800"
                            : sale.status === "EDITADO"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800 line-through"
                        }`}
                      >
                        {sale.status}
                      </span>
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
