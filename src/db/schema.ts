import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type UserRole =
  | "SUPERADMIN"
  | "INVITADO"
  | "GERENCIA"
  | "ADMIN_SUCURSAL"
  | "ENCARGADO"
  | "TRABAJADOR";

export type ShiftType = "MANANA" | "TARDE" | "NOCHE" | "PERSONALIZADO";

export type SaleStatus = "ACTIVO" | "EDITADO" | "ANULADO";

export type DailyGoalDistributionMethod =
  | "UNIFORME"
  | "DIAS_OPERATIVOS"
  | "PERSONALIZADO";

export type HolidayTreatment =
  | "NORMAL"
  | "EXCLUIR"
  | "META_REDUCIDA_50";

// 1. Catálogo Normalizado de Roles
export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 30 }).$type<UserRole>().notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roleCodeIdx: uniqueIndex("roles_code_idx").on(table.code),
  })
);

// 2. Catálogo Normalizado de Permisos
export const permissions = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 60 }).notNull().unique(),
    module: varchar("module", { length: 50 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    permCodeIdx: uniqueIndex("permissions_code_idx").on(table.code),
  })
);

// 3. Relación Muchos-a-Muchos entre Roles y Permisos
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueRolePerm: uniqueIndex("role_permissions_unique_idx").on(
      table.roleId,
      table.permissionId
    ),
  })
);

// 4. Sucursales
export const branches = pgTable(
  "branches",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    name: varchar("name", { length: 150 }).notNull(),
    address: text("address").notNull(),
    managerName: varchar("manager_name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    openingDate: date("opening_date").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    operatingDaysOfWeek: jsonb("operating_days_of_week")
      .$type<number[]>()
      .default([0, 1, 2, 3, 4, 5, 6])
      .notNull(),
    operationalClosingHour: varchar("operational_closing_hour", { length: 5 })
      .default("06:00")
      .notNull(),
    observations: text("observations"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex("branches_code_idx").on(table.code),
    activeIdx: index("branches_active_idx").on(table.isActive),
  })
);

// 5. Usuarios
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 60 }).notNull().unique(),
    email: varchar("email", { length: 150 }).notNull().unique(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 30 }).$type<UserRole>().notNull(),
    branchId: integer("branch_id").references(() => branches.id, {
      onDelete: "restrict",
    }),
    canRegisterSales: boolean("can_register_sales").default(true).notNull(),
    canEditSales: boolean("can_edit_sales").default(false).notNull(),
    canVoidSales: boolean("can_void_sales").default(false).notNull(),
    canManageGoals: boolean("can_manage_goals").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    phone: varchar("phone", { length: 40 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    branchIdx: index("users_branch_idx").on(table.branchId),
    roleIdx: index("users_role_idx").on(table.role),
  })
);

// 6. Asignación de Usuarios a Sucursales (branch_users)
export const branchUsers = pgTable(
  "branch_users",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").default(true).notNull(),
    canOperateTurn: boolean("can_operate_turn").default(true).notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    branchUserUnique: uniqueIndex("branch_users_unique_idx").on(
      table.branchId,
      table.userId
    ),
  })
);

// 7. Sesiones Protegidas
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 60 }),
    rememberMe: boolean("remember_me").default(false).notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_idx").on(table.userId),
    expiresIdx: index("sessions_expires_idx").on(table.expiresAt),
  })
);

// 8. Turnos Operativos 24 Horas (shifts)
export const shifts = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 30 }).$type<ShiftType>().notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(), // HH:mm
    endTime: varchar("end_time", { length: 5 }).notNull(), // HH:mm
    crossesMidnight: boolean("crosses_midnight").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    observations: text("observations"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    branchShiftIdx: index("shifts_branch_idx").on(table.branchId),
  })
);

// 9. Metas Mensuales y Configuración de Meta Diaria Inteligente
export const monthlyGoals = pgTable(
  "monthly_goals",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    month: integer("month").notNull(), // 1 - 12
    year: integer("year").notNull(), // e.g., 2026
    goalAmount: numeric("goal_amount", { precision: 14, scale: 2 }).notNull(),
    distributionMethod: varchar("distribution_method", { length: 30 })
      .$type<DailyGoalDistributionMethod>()
      .default("UNIFORME")
      .notNull(),
    operatingDaysMask: jsonb("operating_days_mask")
      .$type<number[]>()
      .default([0, 1, 2, 3, 4, 5, 6])
      .notNull(),
    customDailyTargets: jsonb("custom_daily_targets")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    holidays: jsonb("holidays")
      .$type<string[]>()
      .default([])
      .notNull(),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedById: integer("updated_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    observations: text("observations"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueBranchPeriod: uniqueIndex("monthly_goals_branch_period_idx").on(
      table.branchId,
      table.month,
      table.year
    ),
    periodIdx: index("monthly_goals_period_idx").on(table.year, table.month),
  })
);

export const monthlyGoalHistory = pgTable(
  "monthly_goal_history",
  {
    id: serial("id").primaryKey(),
    goalId: integer("goal_id")
      .notNull()
      .references(() => monthlyGoals.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    previousAmount: numeric("previous_amount", { precision: 14, scale: 2 }),
    newAmount: numeric("new_amount", { precision: 14, scale: 2 }).notNull(),
    changedById: integer("changed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    goalHistoryIdx: index("monthly_goal_history_goal_idx").on(table.goalId),
  })
);

// 10. Ventas por Turno (sales) - exportado también como salesRecords para compatibilidad total
export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    shiftId: integer("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    shiftName: varchar("shift_name", { length: 100 }).notNull(),
    shiftType: varchar("shift_type", { length: 30 }).$type<ShiftType>().notNull(),
    operationalDate: date("operational_date").notNull(), // YYYY-MM-DD (respeta turnos que cruzan medianoche)
    startTime: varchar("start_time", { length: 5 }).notNull(), // HH:mm
    endTime: varchar("end_time", { length: 5 }).notNull(), // HH:mm
    crossesMidnight: boolean("crosses_midnight").default(false).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    registeredById: integer("registered_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedById: integer("updated_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    status: varchar("status", { length: 20 })
      .$type<SaleStatus>()
      .default("ACTIVO")
      .notNull(),
    voidReason: text("void_reason"),
    observations: text("observations"),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("sales_idempotency_idx").on(table.idempotencyKey),
    branchDateIdx: index("sales_branch_date_idx").on(
      table.branchId,
      table.operationalDate
    ),
    operationalDateIdx: index("sales_op_date_idx").on(table.operationalDate),
    userIdx: index("sales_user_idx").on(table.registeredById),
    statusIdx: index("sales_status_idx").on(table.status),
  })
);

export const salesRecords = sales;

export const salesRecordHistory = pgTable(
  "sales_record_history",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    previousAmount: numeric("previous_amount", { precision: 14, scale: 2 }),
    newAmount: numeric("new_amount", { precision: 14, scale: 2 }),
    previousStatus: varchar("previous_status", { length: 20 }),
    newStatus: varchar("new_status", { length: 20 }).notNull(),
    changedById: integer("changed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    snapshot: jsonb("snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    saleHistoryIdx: index("sales_history_sale_idx").on(table.saleId),
  })
);

// 11. Notificaciones Operativas y de Cumplimiento
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 40 }).default("INFO").notNull(), // EXITO | ALERTA | INFO
    title: varchar("title", { length: 150 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    notifBranchIdx: index("notifications_branch_idx").on(table.branchId),
    notifUserIdx: index("notifications_user_idx").on(table.userId),
  })
);

// 12. Bitácora Central de Auditoría
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    branchId: integer("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    module: varchar("module", { length: 50 }).notNull(),
    action: varchar("action", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 60 }),
    description: text("description").notNull(),
    previousData: jsonb("previous_data"),
    newData: jsonb("new_data"),
    ipAddress: varchar("ip_address", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    moduleIdx: index("audit_module_idx").on(table.module),
    createdIdx: index("audit_created_idx").on(table.createdAt),
    branchAuditIdx: index("audit_branch_idx").on(table.branchId),
  })
);

// 13. Configuración Global del Sistema
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 150 })
    .default("CHÁVEZ METAS — Cadena de Farmacias")
    .notNull(),
  currencyCode: varchar("currency_code", { length: 10 }).default("BOB").notNull(),
  currencySymbol: varchar("currency_symbol", { length: 10 }).default("Bs").notNull(),
  timezone: varchar("timezone", { length: 60 })
    .default("America/La_Paz")
    .notNull(),
  nightShiftOperationalRule: varchar("night_shift_rule", { length: 40 })
    .default("START_DATE")
    .notNull(),
  operationalClosingTime: varchar("operational_closing_time", { length: 5 })
    .default("06:00")
    .notNull(),
  defaultDistributionMethod: varchar("default_distribution_method", { length: 30 })
    .$type<DailyGoalDistributionMethod>()
    .default("UNIFORME")
    .notNull(),
  defaultOperatingDays: jsonb("default_operating_days")
    .$type<number[]>()
    .default([0, 1, 2, 3, 4, 5, 6])
    .notNull(),
  holidayTreatment: varchar("holiday_treatment", { length: 30 })
    .$type<HolidayTreatment>()
    .default("NORMAL")
    .notNull(),
  holidaysList: jsonb("holidays_list")
    .$type<string[]>()
    .default([])
    .notNull(),
  dailyGoalDisplayMode: varchar("daily_goal_display_mode", { length: 30 })
    .default("AMBAS")
    .notNull(),
  motivationalMsgCaseA: text("motivational_msg_case_a")
    .default(
      "¡Vamos, todavía podemos mejorar! Hoy nos faltaron {diferencia} para alcanzar nuestra meta diaria. Mañana tenemos una nueva oportunidad. ¡Esfuérzate, tú puedes!"
    )
    .notNull(),
  motivationalMsgCaseB: text("motivational_msg_case_b")
    .default(
      "¡Excelente trabajo! Alcanzamos nuestra meta diaria. Cada esfuerzo cuenta y estamos avanzando hacia nuestro objetivo mensual. ¡Sigamos así!"
    )
    .notNull(),
  motivationalMsgCaseC: text("motivational_msg_case_c")
    .default(
      "¡BARBARO! ¡Hoy superamos nuestra meta diaria! Tenemos {excedente} de saldo a favor. Ese excedente nos ayuda a cubrir los próximos días. ¡Sigue así!"
    )
    .notNull(),
  alertThresholdWarning: integer("alert_threshold_warning").default(75).notNull(),
  alertThresholdSuccess: integer("alert_threshold_success").default(100).notNull(),
  allowFutureDates: boolean("allow_future_dates").default(false).notNull(),
  maxDaysBackdateRegistration: integer("max_days_backdate").default(3).notNull(),
  updatedById: integer("updated_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  branchUsers: many(branchUsers),
  shifts: many(shifts),
  monthlyGoals: many(monthlyGoals),
  sales: many(sales),
  notifications: many(notifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
  branchUsers: many(branchUsers),
  sales: many(sales),
  notifications: many(notifications),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  branch: one(branches, {
    fields: [shifts.branchId],
    references: [branches.id],
  }),
}));

export const monthlyGoalsRelations = relations(monthlyGoals, ({ one, many }) => ({
  branch: one(branches, {
    fields: [monthlyGoals.branchId],
    references: [branches.id],
  }),
  createdBy: one(users, {
    fields: [monthlyGoals.createdById],
    references: [users.id],
  }),
  history: many(monthlyGoalHistory),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  branch: one(branches, {
    fields: [sales.branchId],
    references: [branches.id],
  }),
  shift: one(shifts, {
    fields: [sales.shiftId],
    references: [shifts.id],
  }),
  registeredBy: one(users, {
    fields: [sales.registeredById],
    references: [users.id],
  }),
  history: many(salesRecordHistory),
}));
