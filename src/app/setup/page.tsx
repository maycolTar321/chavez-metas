"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  UserPlus,
  ArrowLeft,
  Terminal,
} from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<{
    loading: boolean;
    dbConfigured: boolean;
    needsInitialSetup: boolean;
    dbError?: string;
  }>({
    loading: true,
    dbConfigured: false,
    needsInitialSetup: true,
  });

  const [formData, setFormData] = useState({
    setupToken: "chavez-setup-inicial-2026",
    fullName: "",
    username: "admin",
    email: "admin@farmaciaschavez.bo",
    password: "",
    seedInitialBranches: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data) => {
        setStatus({
          loading: false,
          dbConfigured: Boolean(data.dbConfigured),
          needsInitialSetup: Boolean(data.needsInitialSetup),
          dbError: data.dbError,
        });
      })
      .catch(() => {
        setStatus((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo completar la configuración inicial");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de red al conectar con el servidor.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B192C] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                CHÁVEZ METAS — Configuración Inicial y Base de Datos
              </h1>
              <p className="text-sm text-blue-300">
                Puesta en marcha segura de PostgreSQL (Neon) y creación del primer SUPERADMIN
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Login
          </Link>
        </div>

        {/* Paso 1: Estado de PostgreSQL en Neon */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 text-slate-900 shadow-xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  status.dbConfigured && !status.dbError
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Paso 1: Conexión con PostgreSQL en Neon
                </h2>
                <p className="text-xs text-slate-500">
                  Verificación de <code className="font-mono">DATABASE_URL</code> y tablas de Drizzle ORM
                </p>
              </div>
            </div>

            {status.loading ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                Verificando...
              </span>
            ) : status.dbConfigured && !status.dbError ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                Conectado a PostgreSQL
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                Requiere Configuración
              </span>
            )}
          </div>

          {(!status.dbConfigured || status.dbError) && (
            <div className="bg-slate-900 text-slate-100 rounded-xl p-5 space-y-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-blue-400 font-sans font-semibold text-sm">
                <Terminal className="w-4 h-4" />
                <span>Instrucciones para conectar tu base de datos Neon PostgreSQL:</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 font-sans text-slate-300 text-xs leading-relaxed">
                <li>
                  Crea un archivo llamado <code className="text-amber-300 font-mono">.env</code> en la raíz del proyecto (puedes copiar <code className="text-amber-300 font-mono">.env.example</code>).
                </li>
                <li>
                  Coloca tu cadena real de conexión de <strong>Neon PostgreSQL</strong> en la variable <code className="text-emerald-300 font-mono">DATABASE_URL</code>:
                  <pre className="mt-1.5 p-2.5 rounded-lg bg-black/50 text-emerald-300 overflow-x-auto">
                    DATABASE_URL=&quot;postgresql://usuario:password@ep-tu-instancia.aws.neon.tech/neondb?sslmode=require&quot;
                  </pre>
                </li>
                <li>
                  Sincroniza el esquema en Neon ejecutando en la terminal:
                  <pre className="mt-1.5 p-2.5 rounded-lg bg-black/50 text-blue-300 overflow-x-auto">
                    npm run db:push
                  </pre>
                </li>
                <li>
                  Recarga esta página para completar el Paso 2.
                </li>
              </ol>
              {status.dbError && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 font-sans">
                  <strong>Detalle técnico reportado por PostgreSQL:</strong> {status.dbError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paso 2: Creación del Primer SUPERADMIN */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 text-slate-900 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Paso 2: Creación Segura del Primer Administrador (SUPERADMIN)
              </h2>
              <p className="text-xs text-slate-500">
                Sin contraseñas fijas en el código. Se bloquea automáticamente en cuanto se registra el primer administrador.
              </p>
            </div>
          </div>

          {!status.loading &&
          status.dbConfigured &&
          !status.dbError &&
          !status.needsInitialSetup ? (
            <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  El sistema ya fue inicializado correctamente
                </p>
                <p className="text-xs text-emerald-800">
                  Ya existe al menos un usuario administrador en PostgreSQL. Por seguridad, este formulario ya no permite crear nuevos accesos sin iniciar sesión.
                </p>
              </div>
              <Link
                href="/login"
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 text-center"
              >
                Ir a Iniciar Sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Token de Seguridad de Configuración (INITIAL_SETUP_TOKEN)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.setupToken}
                      onChange={(e) =>
                        setFormData({ ...formData, setupToken: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nombre Completo del Administrador
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Lic. Roberto Chávez"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nombre de Usuario (Login)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Correo Electrónico Corporativo
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Contraseña Segura (mín. 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.seedInitialBranches}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seedInitialBranches: e.target.checked,
                      })
                    }
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <span className="font-bold text-slate-900 block">
                      Crear catálogo base de Turnos 24h y 3 Sucursales iniciales de Farmacias Chávez
                    </span>
                    <span>
                      Incluye Turno Mañana (06:00-14:00), Turno Tarde (14:00-22:00), Turno Noche que cruza medianoche (22:00-06:00) y las sucursales SUC-01 Central, SUC-02 Norte y SUC-03 Sur en PostgreSQL.
                    </span>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !status.dbConfigured}
                className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-lg transition"
              >
                {submitting
                  ? "Inicializando Base de Datos y SUPERADMIN..."
                  : "Inicializar CHÁVEZ METAS y Crear SUPERADMIN"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
