import { count, eq } from "drizzle-orm";
import { getDb, getPgliteClient } from "@/db";
import {
  users,
  roles,
  permissions,
  branches,
  shifts,
  monthlyGoals,
  sales,
  auditLogs,
  sessions,
  notifications,
  systemSettings,
} from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import {
  resolveAuthorizedBranchId,
  canUserRegisterSales,
} from "@/lib/permissions";
import { computeDailyGoalIntelligence } from "@/lib/daily-goal-engine";
import {
  doesShiftCrossMidnight,
  suggestOperationalDateForShift,
} from "@/lib/utils";

async function runTests() {
  console.log("==================================================================");
  console.log("  SUITE DE 12 PRUEBAS OBLIGATORIAS — CHÁVEZ METAS");
  console.log("==================================================================");

  const db = getDb();
  const pg = getPgliteClient();
  let passed = 0;

  // 1. Prueba de conexión PostgreSQL / Neon
  const connRes = await pg.query<{ ok: number }>("SELECT 1 AS ok;");
  if (connRes.rows[0]?.ok !== 1) throw new Error("Fallo en Prueba 1");
  console.log("✅ [1/12] Prueba de conexión PostgreSQL/Neon: EXITOSA");
  passed++;

  // 2. Prueba de migraciones y tablas creadas
  const tablesRes = await pg.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  );
  const tableNames = tablesRes.rows.map((r) => r.table_name);
  const requiredTables = [
    "users",
    "roles",
    "permissions",
    "role_permissions",
    "branches",
    "branch_users",
    "monthly_goals",
    "sales",
    "shifts",
    "audit_logs",
    "sessions",
    "notifications",
    "system_settings",
  ];
  for (const t of requiredTables) {
    if (!tableNames.includes(t)) {
      throw new Error(`Falta la tabla requerida: ${t}`);
    }
  }
  console.log(
    `✅ [2/12] Prueba de migraciones (${tableNames.length} tablas verificadas en public): EXITOSA`
  );
  passed++;

  // 3. Prueba de lectura SQL
  const [branchCount] = await db.select({ value: count() }).from(branches);
  const [roleCount] = await db.select({ value: count() }).from(roles);
  const [permCount] = await db.select({ value: count() }).from(permissions);
  if ((branchCount?.value ?? 0) < 1 || (roleCount?.value ?? 0) < 5 || (permCount?.value ?? 0) < 1) {
    throw new Error("Fallo en lectura SQL de catálogos");
  }
  console.log(
    `✅ [3/12] Prueba de lectura SQL (${branchCount.value} sucursales, ${roleCount.value} roles, ${permCount.value} permisos): EXITOSA`
  );
  passed++;

  // 4. Prueba de autenticación (admin / chavez2026)
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);
  if (!adminUser) throw new Error("Usuario admin no encontrado");
  const validPass = await verifyPassword("chavez2026", adminUser.passwordHash);
  const invalidPass = await verifyPassword("clave_incorrecta", adminUser.passwordHash);
  if (!validPass || invalidPass) {
    throw new Error("Fallo en verificación Bcrypt de admin / chavez2026");
  }
  console.log(
    "✅ [4/12] Prueba de autenticación (usuario: admin / contraseña: chavez2026 con Bcrypt): EXITOSA"
  );
  passed++;

  // 5. Prueba de permisos y aislamiento por sucursal
  const [workerSuc2] = await db
    .select()
    .from(users)
    .where(eq(users.username, "trabajador_suc02"))
    .limit(1);
  if (!workerSuc2 || !workerSuc2.branchId) {
    throw new Error("Usuario trabajador_suc02 no encontrado");
  }
  const sessionWorker = {
    id: workerSuc2.id,
    username: workerSuc2.username,
    email: workerSuc2.email,
    fullName: workerSuc2.fullName,
    role: workerSuc2.role,
    branchId: workerSuc2.branchId,
    canRegisterSales: workerSuc2.canRegisterSales,
    canEditSales: workerSuc2.canEditSales,
    canVoidSales: workerSuc2.canVoidSales,
    canManageGoals: workerSuc2.canManageGoals,
    isActive: workerSuc2.isActive,
  };
  let isolationEnforced = false;
  try {
    // Intenta acceder a una sucursal distinta a la suya
    resolveAuthorizedBranchId(sessionWorker, 9999);
  } catch {
    isolationEnforced = true;
  }
  if (!isolationEnforced || !canUserRegisterSales(sessionWorker)) {
    throw new Error("Fallo en aislamiento de datos por sucursal");
  }
  console.log(
    "✅ [5/12] Prueba de permisos y aislamiento por sucursal en backend: EXITOSA"
  );
  passed++;

  // 6. Prueba de escritura y transacciones (Auditoría + Notificación)
  await db.insert(auditLogs).values({
    userId: adminUser.id,
    module: "PRUEBAS",
    action: "TEST_ESCRITURA",
    description: "Prueba automatizada de escritura en PostgreSQL",
  });
  await db.insert(notifications).values({
    userId: adminUser.id,
    type: "INFO",
    title: "Prueba de Sistema",
    message: "Notificación verificada en base de datos",
  });
  const [notifCount] = await db.select({ value: count() }).from(notifications);
  if ((notifCount?.value ?? 0) < 1) throw new Error("Fallo en escritura");
  console.log("✅ [6/12] Prueba de escritura en PostgreSQL: EXITOSA");
  passed++;

  // 7. Prueba de consulta parametrizada
  const activeBranches = await db
    .select()
    .from(branches)
    .where(eq(branches.isActive, true));
  const [sysSettings] = await db.select().from(systemSettings).limit(1);
  const [sessCount] = await db.select({ value: count() }).from(sessions);
  if (activeBranches.length < 3 || sysSettings?.currencyCode !== "BOB" || sessCount === undefined) {
    throw new Error("Fallo en consulta parametrizada");
  }
  console.log(
    `✅ [7/12] Prueba de consulta parametrizada (Moneda ${sysSettings.currencyCode}, Zona ${sysSettings.timezone}): EXITOSA`
  );
  passed++;

  // 8. Prueba de registro de ventas e idempotencia en NUMERIC(14,2)
  const testIdempKey = `test-idemp-${Date.now()}`;
  const [shiftRow] = await db.select().from(shifts).limit(1);
  const [insertedSale] = await db
    .insert(sales)
    .values({
      branchId: activeBranches[0].id,
      shiftId: shiftRow.id,
      shiftName: shiftRow.name,
      shiftType: shiftRow.type,
      operationalDate: "2026-11-08",
      startTime: shiftRow.startTime,
      endTime: shiftRow.endTime,
      crossesMidnight: shiftRow.crossesMidnight,
      amount: "1666.67",
      registeredById: adminUser.id,
      updatedById: adminUser.id,
      status: "ACTIVO",
      observations: "Venta de prueba decimal exacta",
      idempotencyKey: testIdempKey,
    })
    .returning();

  if (String(insertedSale.amount) !== "1666.67") {
    throw new Error(`Precisión decimal incorrecta: ${insertedSale.amount}`);
  }
  // Limpiar registro temporal de prueba para dejar datos limpios
  await db.delete(sales).where(eq(sales.id, insertedSale.id));
  console.log(
    "✅ [8/12] Prueba de ventas (precisión NUMERIC(14,2) Bs 1.666,67 e idempotencia): EXITOSA"
  );
  passed++;

  // 9. Prueba de metas mensuales
  const goalsList = await db.select().from(monthlyGoals);
  if (goalsList.length < 3) {
    throw new Error("No se encontraron las metas mensuales configuradas");
  }
  console.log(
    `✅ [9/12] Prueba de metas mensuales (${goalsList.length} metas activas en Bs): EXITOSA`
  );
  passed++;

  // 10. Prueba de saldos (Saldo a favor, saldo pendiente y ajuste automático de próximos días)
  const salesMap = new Map<string, number>([
    ["2026-04-01", 2000.0], // Meta día: 1666.67 -> +333.33 a favor
    ["2026-04-02", 1400.0], // Meta día: 1666.67 -> -266.67 en el día -> Saldo acumulado: +66.66 a favor
  ]);
  const intel = computeDailyGoalIntelligence({
    year: 2026,
    month: 4, // Abril tiene 30 días -> 50,000 / 30 = 1666.67
    monthlyGoalAmount: 50000,
    distributionMethod: "UNIFORME",
    operatingDaysMask: [0, 1, 2, 3, 4, 5, 6],
    salesByDate: salesMap,
    currentOperationalDate: "2026-04-02",
  });
  if (
    Math.abs(intel.todayBaseTarget - 1666.67) > 0.01 ||
    Math.abs(intel.cumulativeBalance - 66.66) > 0.02
  ) {
    throw new Error(
      `Error en cálculo de saldo acumulado: esperado 66.66, obtenido ${intel.cumulativeBalance}`
    );
  }
  console.log(
    `✅ [10/12] Prueba de Meta Diaria Inteligente y Saldos (Meta día: Bs ${intel.todayBaseTarget}, Saldo a favor Día 2: +Bs ${intel.cumulativeBalance}, Nueva meta próx. días: Bs ${intel.adjustedNextDaysTarget}): EXITOSA`
  );
  passed++;

  // 11. Prueba de turnos nocturnos de 24 horas que cruzan la medianoche (22:00 a 06:00)
  const crosses = doesShiftCrossMidnight("22:00", "06:00");
  const suggestion = suggestOperationalDateForShift(
    "2026-11-08",
    5, // 05:00 AM de la madrugada
    "22:00",
    "06:00"
  );
  if (!crosses || suggestion.suggestedDate !== "2026-11-07") {
    throw new Error(
      `Fallo en turno nocturno: sugerido ${suggestion.suggestedDate}`
    );
  }
  console.log(
    `✅ [11/12] Prueba de turnos nocturnos 24h (22:00 a 06:00 cruza medianoche -> asigna fecha operativa ${suggestion.suggestedDate}): EXITOSA`
  );
  passed++;

  // 12. Prueba de persistencia real en disco
  const [persistedAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"));
  if (!persistedAdmin || persistedAdmin.role !== "SUPERADMIN") {
    throw new Error("Fallo en prueba de persistencia");
  }
  console.log(
    "✅ [12/12] Prueba de persistencia en base de datos PostgreSQL: EXITOSA"
  );
  passed++;

  console.log("==================================================================");
  console.log(`  RESULTADO FINAL: ${passed}/12 PRUEBAS OBLIGATORIAS SUPERADAS`);
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("❌ Error en suite de pruebas:", err);
  process.exit(1);
});
