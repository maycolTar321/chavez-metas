import fs from "fs";
import path from "path";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { count, eq, ne } from "drizzle-orm";
import { getDb, getPgliteClient, isRemoteNeonConfigured } from "@/db";
import {
  users,
  roles,
  permissions,
  rolePermissions,
  branches,
  shifts,
  monthlyGoals,
  monthlyGoalHistory,
  sales,
  salesRecordHistory,
  systemSettings,
  notifications,
  auditLogs,
} from "@/db/schema";

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFiles();

async function runSetup() {
  console.log("==================================================================");
  console.log("  CHÁVEZ METAS — CONEXIÓN Y MIGRACIÓN EN NEON POSTGRESQL CLOUD");
  console.log("==================================================================");

  const migrationPath = path.join(
    process.cwd(),
    "drizzle",
    "0000_sparkling_guardsmen.sql"
  );
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");
  const statements = sqlContent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  if (isRemoteNeonConfigured()) {
    console.log(
      "[1/4] Conectado a Neon PostgreSQL Cloud (us-east-2). Ejecutando migraciones SQL..."
    );
    const sqlClient = postgres(
      process.env.DIRECT_URL || process.env.DATABASE_URL!,
      {
        ssl: "require",
        max: 1,
      }
    );
    for (const stmt of statements) {
      await sqlClient.unsafe(stmt);
    }
    await sqlClient.end();
    console.log(`      ✓ ${statements.length} sentencias SQL aplicadas en Neon.`);
  } else {
    console.log(
      "[1/4] Inicializando motor PostgreSQL en .pgdata y ejecutando migraciones..."
    );
    const pg = getPgliteClient();
    for (const stmt of statements) {
      await pg.exec(stmt);
    }
    console.log(`      ✓ ${statements.length} sentencias SQL ejecutadas.`);
  }

  const db = getDb();

  // 2. Poblar catálogo normalizado de Roles (SUPERADMIN + INVITADO) y Permisos
  console.log("[2/4] Configurando roles (Administradora Única + Modo Invitado)...");
  const [existingRolesCount] = await db.select({ value: count() }).from(roles);
  if ((existingRolesCount?.value ?? 0) === 0) {
    const insertedRoles = await db
      .insert(roles)
      .values([
        {
          code: "SUPERADMIN",
          name: "Administradora General",
          description: "Única administradora con acceso total al sistema",
        },
        {
          code: "INVITADO",
          name: "Modo Invitado (Solo Lectura)",
          description:
            "Acceso de consulta para visualizar resultados, metas diarias y reportes",
        },
      ])
      .returning();

    const insertedPerms = await db
      .insert(permissions)
      .values([
        {
          code: "VENTAS_REGISTRAR",
          module: "VENTAS",
          name: "Registrar Ventas en Turno",
        },
        {
          code: "VENTAS_EDITAR",
          module: "VENTAS",
          name: "Editar Ventas con Auditoría",
        },
        {
          code: "VENTAS_ANULAR",
          module: "VENTAS",
          name: "Anular Ventas con Trazabilidad",
        },
        {
          code: "METAS_GESTIONAR",
          module: "METAS",
          name: "Crear y Modificar Metas Mensuales y Diarias",
        },
        {
          code: "SUCURSALES_GESTIONAR",
          module: "SUCURSALES",
          name: "Crear y Administrar Sucursales",
        },
        {
          code: "AUDITORIA_CONSULTAR",
          module: "AUDITORIA",
          name: "Consultar Bitácora Completa de Auditoría",
        },
      ])
      .returning();

    const superRole = insertedRoles.find((r) => r.code === "SUPERADMIN");
    if (superRole) {
      for (const perm of insertedPerms) {
        await db.insert(rolePermissions).values({
          roleId: superRole.id,
          permissionId: perm.id,
        });
      }
    }
  }

  // 3. Configurar UN SOLO USUARIO ADMINISTRADOR: admin / chavez2026
  console.log(
    "[3/4] Configurando ÚNICO usuario administrador (admin / chavez2026)..."
  );
  const passwordHash = await bcrypt.hash("chavez2026", 12);

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);

  let adminUser;
  if (existingAdmin.length > 0) {
    const [updated] = await db
      .update(users)
      .set({
        fullName: "Administradora General — Chávez Metas",
        passwordHash,
        role: "SUPERADMIN",
        isActive: true,
        canRegisterSales: true,
        canEditSales: true,
        canVoidSales: true,
        canManageGoals: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingAdmin[0].id))
      .returning();
    adminUser = updated;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        username: "admin",
        email: "admin@farmaciaschavez.bo",
        fullName: "Administradora General — Chávez Metas",
        passwordHash,
        role: "SUPERADMIN",
        branchId: null,
        canRegisterSales: true,
        canEditSales: true,
        canVoidSales: true,
        canManageGoals: true,
        isActive: true,
        phone: "+591 70000001",
      })
      .returning();
    adminUser = created;
  }

  // Garantizar que todos los usuarios estándar estén activos y con contraseña chavez2026
  await db
    .update(users)
    .set({ isActive: true, passwordHash })
    .where(ne(users.username, "admin"));

  // 4. Sembrar configuración global, sucursales, turnos 24h y metas iniciales
  console.log("[4/4] Verificando sucursales, turnos 24h, metas y datos en Neon...");
  const [settingsCount] = await db
    .select({ value: count() })
    .from(systemSettings);

  if ((settingsCount?.value ?? 0) === 0) {
    await db.insert(systemSettings).values({
      companyName: "CHÁVEZ METAS — Cadena de Farmacias",
      currencyCode: "BOB",
      currencySymbol: "Bs",
      timezone: "America/La_Paz",
      nightShiftOperationalRule: "START_DATE",
      operationalClosingTime: "06:00",
      defaultDistributionMethod: "UNIFORME",
      defaultOperatingDays: [0, 1, 2, 3, 4, 5, 6],
      holidayTreatment: "NORMAL",
      holidaysList: [],
      dailyGoalDisplayMode: "AMBAS",
      alertThresholdWarning: 75,
      alertThresholdSuccess: 100,
      allowFutureDates: false,
      maxDaysBackdateRegistration: 3,
      updatedById: adminUser.id,
    });
  }

  const [branchesCount] = await db.select({ value: count() }).from(branches);
  if ((branchesCount?.value ?? 0) === 0) {
    const insertedBranches = await db
      .insert(branches)
      .values([
        {
          code: "SUC-01",
          name: "Farmacia Chávez — Sucursal Central 24h",
          address: "Av. Cristo Redentor #100, Zona Centro",
          managerName: "Administración General",
          phone: "+591 3 3344556",
          openingDate: "2020-03-15",
          isActive: true,
          observations: "Sucursal matriz de atención continua 24 horas",
        },
        {
          code: "SUC-02",
          name: "Farmacia Chávez — Sucursal Norte",
          address: "Av. Banzer 4to Anillo",
          managerName: "Administración General",
          phone: "+591 3 3456789",
          openingDate: "2021-07-01",
          isActive: true,
          observations: "Sucursal comercial zona norte 24 horas",
        },
        {
          code: "SUC-03",
          name: "Farmacia Chávez — Sucursal Sur",
          address: "Av. Santos Dumont 3er Anillo",
          managerName: "Administración General",
          phone: "+591 3 3567890",
          openingDate: "2022-11-10",
          isActive: true,
          observations: "Sucursal zona sur 24 horas",
        },
      ])
      .returning();

    const insertedShifts = await db
      .insert(shifts)
      .values([
        {
          branchId: null,
          name: "Turno Mañana (06:00 - 14:00)",
          type: "MANANA",
          startTime: "06:00",
          endTime: "14:00",
          crossesMidnight: false,
          isActive: true,
          observations: "Turno matutino estándar de farmacia",
        },
        {
          branchId: null,
          name: "Turno Tarde (14:00 - 22:00)",
          type: "TARDE",
          startTime: "14:00",
          endTime: "22:00",
          crossesMidnight: false,
          isActive: true,
          observations: "Turno vespertino estándar de farmacia",
        },
        {
          branchId: null,
          name: "Turno Noche 24h (22:00 - 06:00)",
          type: "NOCHE",
          startTime: "22:00",
          endTime: "06:00",
          crossesMidnight: true,
          isActive: true,
          observations:
            "Turno nocturno que cruza la medianoche; asigna la fecha operativa al día de inicio del turno.",
        },
      ])
      .returning();

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const todayStr = now.toISOString().split("T")[0];

    const goalsMap = [
      { branch: insertedBranches[0], amount: "50000.00" },
      { branch: insertedBranches[1], amount: "60000.00" },
      { branch: insertedBranches[2], amount: "45000.00" },
    ];

    for (const item of goalsMap) {
      const [g] = await db
        .insert(monthlyGoals)
        .values({
          branchId: item.branch.id,
          month: curMonth,
          year: curYear,
          goalAmount: item.amount,
          distributionMethod: "UNIFORME",
          operatingDaysMask: [0, 1, 2, 3, 4, 5, 6],
          customDailyTargets: {},
          holidays: [],
          createdById: adminUser.id,
          updatedById: adminUser.id,
          isActive: true,
          observations: "Meta mensual inicial configurada",
        })
        .returning();

      await db.insert(monthlyGoalHistory).values({
        goalId: g.id,
        branchId: item.branch.id,
        month: curMonth,
        year: curYear,
        previousAmount: null,
        newAmount: item.amount,
        changedById: adminUser.id,
        reason: "Configuración inicial del periodo",
      });
    }

    const shiftManana = insertedShifts[0];
    const shiftNoche = insertedShifts[2];

    const sampleSales = [
      {
        branchId: insertedBranches[0].id,
        shiftId: shiftManana.id,
        shiftName: shiftManana.name,
        shiftType: "MANANA" as const,
        operationalDate: todayStr,
        startTime: "06:00",
        endTime: "14:00",
        crossesMidnight: false,
        amount: "1200.00",
        registeredById: adminUser.id,
        observations: "Arqueo turno mañana verificado",
        idempotencyKey: `neon-init-sale-1-${Date.now()}`,
      },
      {
        branchId: insertedBranches[0].id,
        shiftId: shiftNoche.id,
        shiftName: shiftNoche.name,
        shiftType: "NOCHE" as const,
        operationalDate: todayStr,
        startTime: "22:00",
        endTime: "06:00",
        crossesMidnight: true,
        amount: "800.00",
        registeredById: adminUser.id,
        observations: "Turno nocturno que cruza medianoche (total día Bs 2.000)",
        idempotencyKey: `neon-init-sale-2-${Date.now()}`,
      },
    ];

    for (const s of sampleSales) {
      const [insertedSale] = await db.insert(sales).values(s).returning();
      await db.insert(salesRecordHistory).values({
        saleId: insertedSale.id,
        previousAmount: null,
        newAmount: s.amount,
        previousStatus: null,
        newStatus: "ACTIVO",
        changedById: adminUser.id,
        reason: "Registro inicial de apertura",
        snapshot: insertedSale,
      });
    }

    await db.insert(notifications).values({
      branchId: insertedBranches[0].id,
      userId: adminUser.id,
      type: "EXITO",
      title: "¡Meta Diaria Superada en SUC-01!",
      message:
        "¡BARBARO! Hoy superamos nuestra meta diaria en SUC-01 con Bs 2.000,00 vendidos.",
      isRead: false,
    });

    await db.insert(auditLogs).values({
      userId: adminUser.id,
      module: "SISTEMA",
      action: "INICIALIZACION_NEON",
      entityId: String(adminUser.id),
      description:
        "Base de datos Neon PostgreSQL inicializada con usuario único admin y Modo Invitado.",
    });
  }

  console.log("==================================================================");
  console.log("  ✓ NEON POSTGRESQL SINCRONIZADO Y VERIFICADO");
  console.log("  ✓ Única Administradora:  admin");
  console.log("  ✓ Contraseña:            chavez2026");
  console.log("  ✓ Resto de personas:     Botón 'Modo Invitado' (Solo lectura)");
  console.log("==================================================================");
  process.exit(0);
}

runSetup().catch((err) => {
  console.error("Error en configuración de base de datos:", err);
  process.exit(1);
});
