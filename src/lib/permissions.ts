import type { UserRole } from "@/db/schema";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: number | null;
  branchName?: string | null;
  canRegisterSales: boolean;
  canEditSales: boolean;
  canVoidSales: boolean;
  canManageGoals: boolean;
  isActive: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: "Administradora General",
  INVITADO: "Modo Invitado (Solo Lectura de Resultados)",
  GERENCIA: "Gerencia General",
  ADMIN_SUCURSAL: "Administrador de Sucursal",
  ENCARGADO: "Encargado de Turno",
  TRABAJADOR: "Trabajador / Farmacéutico",
};

export type AppModule =
  | "INICIO"
  | "VENTAS"
  | "METAS"
  | "SUCURSALES"
  | "PERSONAL"
  | "TURNOS"
  | "RENDIMIENTO"
  | "REPORTES"
  | "HISTORIAL"
  | "AUDITORIA"
  | "CONFIGURACION";

const ROLE_MODULES: Record<UserRole, AppModule[]> = {
  SUPERADMIN: [
    "INICIO",
    "VENTAS",
    "METAS",
    "SUCURSALES",
    "PERSONAL",
    "TURNOS",
    "RENDIMIENTO",
    "REPORTES",
    "HISTORIAL",
    "AUDITORIA",
    "CONFIGURACION",
  ],
  INVITADO: [
    "INICIO",
    "METAS",
    "RENDIMIENTO",
    "REPORTES",
    "HISTORIAL",
  ],
  GERENCIA: [
    "INICIO",
    "VENTAS",
    "METAS",
    "SUCURSALES",
    "RENDIMIENTO",
    "REPORTES",
    "HISTORIAL",
  ],
  ADMIN_SUCURSAL: [
    "INICIO",
    "VENTAS",
    "METAS",
    "PERSONAL",
    "TURNOS",
    "RENDIMIENTO",
    "REPORTES",
    "HISTORIAL",
  ],
  ENCARGADO: [
    "INICIO",
    "VENTAS",
    "METAS",
    "TURNOS",
    "RENDIMIENTO",
    "HISTORIAL",
  ],
  TRABAJADOR: ["INICIO", "VENTAS", "HISTORIAL"],
};

export function canAccessModule(role: UserRole, module: AppModule): boolean {
  return ROLE_MODULES[role]?.includes(module) ?? false;
}

export function getAllowedModules(role: UserRole): AppModule[] {
  return ROLE_MODULES[role] || ["INICIO"];
}

/**
 * Determina si el usuario tiene visibilidad global de resultados de todas las sucursales.
 */
export function hasGlobalBranchAccess(role: UserRole): boolean {
  return (
    role === "SUPERADMIN" || role === "INVITADO" || role === "GERENCIA"
  );
}

/**
 * Resuelve y valida qué sucursal puede consultar o operar un usuario.
 */
export function resolveAuthorizedBranchId(
  user: SessionUser,
  requestedBranchId?: number | null
): number | null {
  if (hasGlobalBranchAccess(user.role)) {
    return requestedBranchId ?? null;
  }
  if (!user.branchId) {
    throw new Error(
      "Tu usuario no tiene una sucursal asignada. Contacta a la administradora."
    );
  }
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new Error(
      "Acceso denegado: No tienes autorización para consultar ni operar en otra sucursal."
    );
  }
  return user.branchId;
}

export function canUserRegisterSales(user: SessionUser): boolean {
  if (!user.isActive || user.role === "INVITADO") return false;
  if (user.role === "SUPERADMIN") return true;
  if (user.role === "GERENCIA") return user.canRegisterSales;
  return user.canRegisterSales && Boolean(user.branchId);
}

export function canUserEditSale(user: SessionUser, saleBranchId: number): boolean {
  if (!user.isActive || user.role === "INVITADO") return false;
  if (user.role === "SUPERADMIN") return true;
  if (user.role === "ADMIN_SUCURSAL" && user.branchId === saleBranchId) {
    return true;
  }
  return user.canEditSales && user.branchId === saleBranchId;
}

export function canUserVoidSale(user: SessionUser, saleBranchId: number): boolean {
  if (!user.isActive || user.role === "INVITADO") return false;
  if (user.role === "SUPERADMIN") return true;
  if (user.role === "ADMIN_SUCURSAL" && user.branchId === saleBranchId) {
    return true;
  }
  return user.canVoidSales && user.branchId === saleBranchId;
}

export function canUserManageGoals(
  user: SessionUser,
  targetBranchId?: number
): boolean {
  if (!user.isActive || user.role === "INVITADO") return false;
  if (user.role === "SUPERADMIN") return true;
  if (user.canManageGoals) {
    if (hasGlobalBranchAccess(user.role)) return true;
    if (targetBranchId && user.branchId === targetBranchId) return true;
  }
  return false;
}
