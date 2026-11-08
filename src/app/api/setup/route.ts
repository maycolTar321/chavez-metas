import { NextRequest, NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  users,
  branches,
  shifts,
  systemSettings,
  monthlyGoals,
} from "@/db/schema";
import { initialSetupSchema } from "@/lib/validations";
import { hashPassword, createServerSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getBoliviaNow } from "@/lib/utils";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      dbConfigured: false,
      needsInitialSetup: true,
      message:
        "DATABASE_URL no está configurada o contiene el valor de ejemplo en .env",
    });
  }

  try {
    const db = getDb();
    const [result] = await db.select({ value: count() }).from(users);
    const hasUsers = (result?.value ?? 0) > 0;
    return NextResponse.json({
      dbConfigured: true,
      needsInitialSetup: !hasUsers,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        dbConfigured: true,
        needsInitialSetup: true,
        dbError:
          error instanceof Error
            ? error.message
            : "Error consultando las tablas. Asegúrate de ejecutar npm run db:push",
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Configura DATABASE_URL en el archivo .env antes de ejecutar la inicialización.",
        },
        { status: 503 }
      );
    }

    const db = getDb();
    const [existingUsers] = await db.select({ value: count() }).from(users);
    if ((existingUsers?.value ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "El sistema ya cuenta con un administrador configurado. Por seguridad, el proceso de inicialización está cerrado.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = initialSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const expectedToken =
      process.env.INITIAL_SETUP_TOKEN || "chavez-setup-inicial-2026";
    if (parsed.data.setupToken.trim() !== expectedToken) {
      return NextResponse.json(
        {
          error:
            "Token de configuración inicial inválido. Revisa la variable INITIAL_SETUP_TOKEN en tu archivo .env.",
        },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const boliviaNow = getBoliviaNow();

    const createdUser = await db.transaction(async (tx) => {
      const [adminUser] = await tx
        .insert(users)
        .values({
          username: parsed.data.username.trim(),
          email: parsed.data.email.trim().toLowerCase(),
          fullName: parsed.data.fullName.trim(),
          passwordHash,
          role: "SUPERADMIN",
          branchId: null,
          canRegisterSales: true,
          canEditSales: true,
          canVoidSales: true,
          canManageGoals: true,
          isActive: true,
        })
        .returning();

      // Crear configuración global por defecto
      await tx.insert(systemSettings).values({
        companyName: "CHÁVEZ METAS — Cadena de Farmacias",
        currencyCode: "BOB",
        currencySymbol: "Bs",
        timezone: "America/La_Paz",
        nightShiftOperationalRule: "START_DATE",
        alertThresholdWarning: 75,
        alertThresholdSuccess: 100,
        allowFutureDates: false,
        maxDaysBackdateRegistration: 3,
        updatedById: adminUser.id,
      });

      // Crear turnos base de 24 horas (Mañana, Tarde, Noche que cruza medianoche)
      await tx.insert(shifts).values([
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
      ]);

      if (parsed.data.seedInitialBranches) {
        const insertedBranches = await tx
          .insert(branches)
          .values([
            {
              code: "SUC-01",
              name: "Farmacia Chávez — Sucursal Central",
              address: "Av. Principal #100, Zona Centro",
              managerName: "Dra. Carla Mendoza",
              phone: "+591 3 3344556",
              openingDate: "2020-03-15",
              isActive: true,
              observations: "Sucursal matriz de atención 24 horas",
            },
            {
              code: "SUC-02",
              name: "Farmacia Chávez — Sucursal Norte",
              address: "Av. Banzer 4to Anillo",
              managerName: "Dr. Rodrigo Suárez",
              phone: "+591 3 3456789",
              openingDate: "2021-07-01",
              isActive: true,
              observations: "Sucursal comercial zona norte 24 horas",
            },
            {
              code: "SUC-03",
              name: "Farmacia Chávez — Sucursal Sur",
              address: "Av. Santos Dumont 3er Anillo",
              managerName: "Dra. Patricia Rojas",
              phone: "+591 3 3567890",
              openingDate: "2022-11-10",
              isActive: true,
              observations: "Sucursal zona sur 24 horas",
            },
          ])
          .returning();

        // Metas mensuales iniciales para el periodo actual
        for (const b of insertedBranches) {
          await tx.insert(monthlyGoals).values({
            branchId: b.id,
            month: boliviaNow.month,
            year: boliviaNow.year,
            goalAmount: b.code === "SUC-01" ? "250000.00" : b.code === "SUC-02" ? "180000.00" : "150000.00",
            createdById: adminUser.id,
            updatedById: adminUser.id,
            isActive: true,
            observations: "Meta mensual inicial establecida durante la puesta en marcha",
          });
        }
      }

      return adminUser;
    });

    await recordAuditLog({
      userId: createdUser.id,
      module: "SISTEMA",
      action: "CONFIGURACION_INICIAL_SUPERADMIN",
      entityId: createdUser.id,
      description: `Se configuró el primer usuario SUPERADMIN (${createdUser.username}) y los parámetros base de CHÁVEZ METAS.`,
    });

    await createServerSession(
      createdUser.id,
      createdUser.role,
      null,
      true,
      req.headers.get("x-forwarded-for") || "local",
      req.headers.get("user-agent") || "setup"
    );

    return NextResponse.json({
      ok: true,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        fullName: createdUser.fullName,
        role: createdUser.role,
      },
    });
  } catch (error: unknown) {
    console.error("Error en POST /api/setup:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al inicializar el sistema",
      },
      { status: 500 }
    );
  }
}
