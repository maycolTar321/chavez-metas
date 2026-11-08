import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Ingresa tu usuario o correo electrónico"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rememberMe: z.boolean().optional().default(false),
});

export const initialSetupSchema = z.object({
  setupToken: z.string().min(4, "Token de configuración inicial requerido"),
  fullName: z.string().trim().min(3, "El nombre completo es obligatorio"),
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, puntos y guiones"),
  email: z.string().trim().email("Correo electrónico inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener mínimo 8 caracteres"),
  seedInitialBranches: z.boolean().optional().default(true),
});

export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "El código es obligatorio (ej. SUC-01)")
    .max(30, "Máximo 30 caracteres"),
  name: z
    .string()
    .trim()
    .min(3, "El nombre de la sucursal es obligatorio")
    .max(150),
  address: z.string().trim().min(5, "La dirección es obligatoria"),
  managerName: z
    .string()
    .trim()
    .min(3, "El nombre del responsable es obligatorio")
    .max(150),
  phone: z.string().trim().max(40).optional().nullable(),
  openingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  isActive: z.boolean().default(true),
  operatingDaysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .default([0, 1, 2, 3, 4, 5, 6]),
  operationalClosingHour: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .default("06:00"),
  observations: z.string().trim().optional().nullable(),
});

export const monthlyGoalSchema = z.object({
  branchId: z.coerce.number().int().positive("Selecciona una sucursal válida"),
  month: z.coerce.number().int().min(1).max(12, "Mes inválido (1-12)"),
  year: z.coerce.number().int().min(2020).max(2100, "Año inválido"),
  goalAmount: z.coerce
    .number()
    .positive("La meta mensual debe ser mayor que 0 Bs")
    .max(999999999.99, "Monto excede el límite permitido"),
  distributionMethod: z
    .enum(["UNIFORME", "DIAS_OPERATIVOS", "PERSONALIZADO"])
    .optional()
    .default("UNIFORME"),
  operatingDaysMask: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .default([0, 1, 2, 3, 4, 5, 6]),
  customDailyTargets: z
    .record(z.string(), z.coerce.number().min(0))
    .optional()
    .default({}),
  holidays: z.array(z.string()).optional().default([]),
  observations: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
});

export const saleRegistrationSchema = z.object({
  branchId: z.coerce.number().int().positive("Sucursal inválida"),
  shiftId: z.coerce.number().int().positive().optional().nullable(),
  shiftName: z.string().trim().min(2, "El turno es obligatorio"),
  shiftType: z.enum(["MANANA", "TARDE", "NOCHE", "PERSONALIZADO"]),
  operationalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha operativa inválida (YYYY-MM-DD)"),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora de inicio inválida (HH:mm)"),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora de finalización inválida (HH:mm)"),
  amount: z.coerce
    .number()
    .positive("El importe vendido debe ser mayor que 0.00 Bs")
    .max(99999999.99, "Importe fuera de rango"),
  observations: z.string().trim().max(1000).optional().nullable(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Clave de idempotencia requerida para evitar registros duplicados")
    .max(100),
});

export const saleUpdateSchema = z.object({
  amount: z.coerce
    .number()
    .positive("El importe debe ser mayor que 0.00 Bs")
    .optional(),
  operationalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha operativa inválida")
    .optional(),
  shiftName: z.string().trim().min(2).optional(),
  shiftType: z.enum(["MANANA", "TARDE", "NOCHE", "PERSONALIZADO"]).optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  observations: z.string().trim().optional().nullable(),
  reason: z
    .string()
    .trim()
    .min(5, "Especifica el motivo de modificación o anulación (mín. 5 caracteres)"),
  action: z.enum(["EDIT", "VOID"]),
});

export const shiftSchema = z.object({
  branchId: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().min(2, "El nombre del turno es obligatorio").max(100),
  type: z.enum(["MANANA", "TARDE", "NOCHE", "PERSONALIZADO"]),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora de inicio inválida (HH:mm)"),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora de finalización inválida (HH:mm)"),
  isActive: z.boolean().default(true),
  observations: z.string().trim().optional().nullable(),
});

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, puntos o guiones"),
  email: z.string().trim().email("Correo inválido"),
  fullName: z.string().trim().min(3, "Nombre completo obligatorio").max(150),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .optional(),
  role: z.enum([
    "SUPERADMIN",
    "GERENCIA",
    "ADMIN_SUCURSAL",
    "ENCARGADO",
    "TRABAJADOR",
  ]),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  canRegisterSales: z.boolean().default(true),
  canEditSales: z.boolean().default(false),
  canVoidSales: z.boolean().default(false),
  canManageGoals: z.boolean().default(false),
  isActive: z.boolean().default(true),
  phone: z.string().trim().max(40).optional().nullable(),
});

export const systemSettingsSchema = z.object({
  companyName: z.string().trim().min(3).max(150),
  currencyCode: z.string().trim().min(2).max(10),
  currencySymbol: z.string().trim().min(1).max(10),
  timezone: z.string().trim().min(3).max(60),
  nightShiftOperationalRule: z.enum(["START_DATE", "END_DATE"]),
  operationalClosingTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default("06:00"),
  defaultDistributionMethod: z
    .enum(["UNIFORME", "DIAS_OPERATIVOS", "PERSONALIZADO"])
    .default("UNIFORME"),
  defaultOperatingDays: z
    .array(z.number().int().min(0).max(6))
    .default([0, 1, 2, 3, 4, 5, 6]),
  holidayTreatment: z
    .enum(["NORMAL", "EXCLUIR", "META_REDUCIDA_50"])
    .default("NORMAL"),
  holidaysList: z.array(z.string()).default([]),
  dailyGoalDisplayMode: z
    .enum(["INDIVIDUAL", "CONSOLIDADA", "AMBAS"])
    .default("AMBAS"),
  motivationalMsgCaseA: z.string().trim().min(10),
  motivationalMsgCaseB: z.string().trim().min(10),
  motivationalMsgCaseC: z.string().trim().min(10),
  alertThresholdWarning: z.coerce.number().int().min(10).max(99),
  alertThresholdSuccess: z.coerce.number().int().min(50).max(200),
  allowFutureDates: z.boolean(),
  maxDaysBackdateRegistration: z.coerce.number().int().min(0).max(60),
});
