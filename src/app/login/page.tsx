"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Users,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor. Intenta nuevamente.");
      setLoading(false);
    }
  }

  async function handleGuestLogin() {
    setError(null);
    setGuestLoading(true);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) {
        setError("No se pudo iniciar el Modo Invitado");
        setGuestLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de red al ingresar en Modo Invitado.");
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0B192C]">
      {/* Columna izquierda: Identidad corporativa CHÁVEZ METAS */}
      <div className="lg:w-7/12 flex flex-col justify-between p-8 lg:p-16 text-white relative overflow-hidden bg-gradient-to-br from-[#0B192C] via-[#0F2547] to-[#1D4ED8]/40">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-400/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block leading-none">
                CHÁVEZ METAS
              </span>
              <span className="text-xs text-blue-300 font-medium tracking-wider uppercase">
                Cadena de Farmacias • Gestión Comercial 24h
              </span>
            </div>
          </div>

          <div className="mt-12 lg:mt-20 max-w-xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Moneda Oficial: Bolivianos (Bs) • Zona Horaria: America/La_Paz
            </span>
            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight text-white">
              Control en tiempo real de metas mensuales, meta diaria y rendimiento de sucursales.
            </h1>
            <p className="mt-5 text-slate-300 text-base lg:text-lg leading-relaxed">
              Plataforma conectada a Neon PostgreSQL. La administración general controla el registro de ventas, metas y sucursales, mientras que el personal puede ingresar en <strong>Modo Invitado</strong> para consultar en tiempo real el avance diario, saldos a favor y cumplimiento.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10 pt-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              Meta Diaria Inteligente
            </p>
            <p className="text-sm text-slate-200 mt-1">
              Cálculo diario automático, saldo a favor o pendiente y motivación en vivo.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Turnos 24 Horas
            </p>
            <p className="text-sm text-slate-200 mt-1">
              Soporte completo para turnos nocturnos que cruzan la medianoche (22:00 a 06:00).
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Modo Invitado Directo
            </p>
            <p className="text-sm text-slate-200 mt-1">
              Acceso rápido de solo lectura para ver resultados sin alterar configuraciones.
            </p>
          </div>
        </div>
      </div>

      {/* Columna derecha: Acceso de Administradora y Botón de Modo Invitado */}
      <div className="lg:w-5/12 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md space-y-6">
          {/* Acceso Rápido Modo Invitado (Para ver resultados) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 space-y-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-emerald-950">
                  ¿Solo deseas consultar los resultados y metas?
                </h3>
                <p className="text-xs text-emerald-800">
                  Ingresa sin contraseña en Modo Invitado (Solo lectura)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={guestLoading || loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>
                {guestLoading
                  ? "Ingresando a Resultados..."
                  : "Entrar en Modo Invitado (Ver Resultados)"}
              </span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              O Acceso Exclusivo Administradora
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Acceso Administradora (Admin)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Ingresa con tu usuario <strong>admin</strong> y tu contraseña para registrar ventas, configurar metas y administrar sucursales.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Usuario Administrador
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-600">
                  Mantener sesión de administradora activa (30 días)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || guestLoading}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Verificando credenciales...</span>
              ) : (
                <>
                  <span>Ingresar como Administradora</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
