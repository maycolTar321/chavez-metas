"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  LayoutDashboard,
  Receipt,
  Target,
  Building2,
  Users,
  Clock,
  TrendingUp,
  FileBarChart2,
  History,
  ShieldAlert,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Bell,
  LogOut,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { SessionUser, AppModule } from "@/lib/permissions";
import {
  ROLE_LABELS,
  canAccessModule,
  hasGlobalBranchAccess,
} from "@/lib/permissions";

export interface BranchOption {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface BranchContextValue {
  user: SessionUser;
  branches: BranchOption[];
  selectedBranchId: number | null;
  setSelectedBranchId: (id: number | null) => void;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error("useAppContext debe utilizarse dentro de AppShell");
  }
  return ctx;
}

interface NavGroup {
  id: string;
  title: string;
  items: Array<{
    module: AppModule;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "operaciones",
    title: "Operación Comercial",
    items: [
      {
        module: "INICIO",
        label: "1. Inicio",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        module: "VENTAS",
        label: "2. Registro de ventas",
        href: "/ventas",
        icon: Receipt,
      },
      {
        module: "METAS",
        label: "3. Metas mensuales",
        href: "/metas",
        icon: Target,
      },
    ],
  },
  {
    id: "estructura",
    title: "Gestión de Red 24h",
    items: [
      {
        module: "SUCURSALES",
        label: "4. Sucursal Central",
        href: "/sucursales",
        icon: Building2,
      },
      {
        module: "PERSONAL",
        label: "5. Personal",
        href: "/personal",
        icon: Users,
      },
      {
        module: "TURNOS",
        label: "6. Turnos",
        href: "/turnos",
        icon: Clock,
      },
    ],
  },
  {
    id: "analisis",
    title: "Inteligencia y Control",
    items: [
      {
        module: "RENDIMIENTO",
        label: "7. Rendimiento",
        href: "/rendimiento",
        icon: TrendingUp,
      },
      {
        module: "REPORTES",
        label: "8. Reportes",
        href: "/reportes",
        icon: FileBarChart2,
      },
      {
        module: "HISTORIAL",
        label: "9. Historial",
        href: "/historial",
        icon: History,
      },
    ],
  },
  {
    id: "gobernanza",
    title: "Seguridad y Sistema",
    items: [
      {
        module: "AUDITORIA",
        label: "10. Auditoría",
        href: "/auditoria",
        icon: ShieldAlert,
      },
      {
        module: "CONFIGURACION",
        label: "11. Configuración",
        href: "/configuracion",
        icon: Settings,
      },
    ],
  },
];

export default function AppShell({
  user,
  initialBranches,
  children,
}: {
  user: SessionUser;
  initialBranches: BranchOption[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [branches, setBranches] = useState<BranchOption[]>(initialBranches);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(1);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    operaciones: true,
    estructura: true,
    analisis: true,
    gobernanza: true,
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function refreshBranches() {
    try {
      const res = await fetch("/api/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allowedGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessModule(user.role, item.module)),
  })).filter((g) => g.items.length > 0);

  const initials = user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <BranchContext.Provider
      value={{
        user,
        branches,
        selectedBranchId,
        setSelectedBranchId,
        refreshBranches,
      }}
    >
      <div className="min-h-screen flex bg-[#F3F4F6] text-slate-900">
        {/* Overlay Móvil */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Menú Lateral Interactivo (Sidebar) */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#0B192C] text-slate-100 flex flex-col border-r border-white/10 transition-transform duration-200 ease-in-out no-print ${
            mobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Identificador CHÁVEZ METAS */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-white block leading-none">
                  CHÁVEZ METAS
                </span>
                <span className="text-[11px] text-blue-300 font-medium">
                  Control Comercial 24h
                </span>
              </div>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Indicador de Sucursal Exclusiva del Sistema */}
          <div className="px-5 py-2.5 bg-blue-950/60 border-b border-white/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="leading-tight">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-200 block">
                SUCURSAL CENTRAL — CAMPERO
              </span>
              <span className="text-[10px] text-slate-400">
                Operación Central CHÁVEZ METAS
              </span>
            </div>
          </div>

          {/* Navegación por Secciones Desplegables */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            {allowedGroups.map((group) => {
              const isOpen = openGroups[group.id] ?? true;
              return (
                <div key={group.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition"
                  >
                    <span>{group.title}</span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                              active
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                                : "text-slate-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                active ? "text-white" : "text-blue-300"
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Pie de barra lateral: Usuario y Cerrar Sesión */}
          <div className="p-4 border-t border-white/10 bg-[#081220] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-200 font-bold text-xs flex items-center justify-center shrink-0">
                {initials || "CM"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {user.fullName}
                </p>
                <p className="text-[11px] text-blue-300 truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-red-600/20 text-slate-300 hover:text-red-200 border border-white/10 hover:border-red-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión Segura</span>
            </button>
          </div>
        </aside>

        {/* Contenedor Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Encabezado Superior */}
          <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Indicador Fijo: Exclusivo Sucursal CENTRAL (CAMPERO) */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm font-extrabold shadow-2xs">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">
                  SUCURSAL CENTRAL — CAMPERO
                </span>
              </div>
            </div>

            {/* Lado derecho del Header: Zona Horaria, Notificaciones y Avatar */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>America/La_Paz • Bs (BOB)</span>
              </div>

              {/* Botón de Notificaciones Operativas */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 relative"
                  title="Centro de notificaciones operativas"
                >
                  <Bell className="w-5 h-5" />
                  <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 right-1.5" />
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Estado Operativo del Sistema
                      </span>
                      <button
                        onClick={() => setNotificationsOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50 text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            Control de Turnos 24h Activo
                          </p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Los turnos nocturnos que cruzan la medianoche asignan automáticamente la fecha operativa correcta.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            Protección de Idempotencia
                          </p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            Cada registro de venta incluye validación única para impedir duplicados por doble clic.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-[#0B192C] text-white text-xs font-bold flex items-center justify-center">
                  {initials || "CM"}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 leading-none">
                    {user.fullName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {ROLE_LABELS[user.role]}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Contenido de cada Módulo */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </BranchContext.Provider>
  );
}
