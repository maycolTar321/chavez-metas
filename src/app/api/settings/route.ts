import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { systemSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { systemSettingsSchema } from "@/lib/validations";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const db = getDb();
    const rows = await db.select().from(systemSettings).limit(1);
    const settings = rows[0] || {
      companyName: "CHÁVEZ METAS — Cadena de Farmacias",
      currencyCode: "BOB",
      currencySymbol: "Bs",
      timezone: "America/La_Paz",
      nightShiftOperationalRule: "START_DATE",
      alertThresholdWarning: 75,
      alertThresholdSuccess: 100,
      allowFutureDates: false,
      maxDaysBackdateRegistration: 3,
    };

    return NextResponse.json({ settings });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al obtener configuración",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: Solo el SUPERADMIN puede modificar la configuración global del sistema.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = systemSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db.select().from(systemSettings).limit(1);

    let saved;
    if (existing.length > 0) {
      const [updated] = await db
        .update(systemSettings)
        .set({
          ...parsed.data,
          updatedById: user.id,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, existing[0].id))
        .returning();
      saved = updated;
    } else {
      const [inserted] = await db
        .insert(systemSettings)
        .values({
          ...parsed.data,
          updatedById: user.id,
        })
        .returning();
      saved = inserted;
    }

    await recordAuditLog({
      userId: user.id,
      module: "CONFIGURACION",
      action: "ACTUALIZAR_CONFIGURACION",
      entityId: saved.id,
      description: `Se actualizaron los parámetros generales del sistema (${saved.companyName})`,
      previousData: existing[0] || null,
      newData: saved,
    });

    return NextResponse.json({ ok: true, settings: saved });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al guardar la configuración",
      },
      { status: 500 }
    );
  }
}
