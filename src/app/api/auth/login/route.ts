import { NextRequest, NextResponse } from "next/server";
import { or, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/validations";
import { verifyPassword, createServerSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Base de datos no configurada. Define DATABASE_URL en tu archivo .env para conectar con PostgreSQL (Neon).",
          code: "DB_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { identifier, password, rememberMe } = parsed.data;
    const db = getDb();

    const foundUsers = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, identifier.trim()),
          eq(users.email, identifier.trim().toLowerCase())
        )
      )
      .limit(1);

    const user = foundUsers[0];
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales incorrectas. Verifica tu usuario y contraseña." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error:
            "Tu cuenta se encuentra desactivada. Contacta con la administración de CHÁVEZ METAS.",
        },
        { status: 403 }
      );
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      await recordAuditLog({
        userId: user.id,
        branchId: user.branchId,
        module: "AUTENTICACION",
        action: "LOGIN_FALLIDO",
        entityId: user.id,
        description: `Intento fallido de inicio de sesión para el usuario ${user.username}`,
      });
      return NextResponse.json(
        { error: "Credenciales incorrectas. Verifica tu usuario y contraseña." },
        { status: 401 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const ua = req.headers.get("user-agent") || "unknown";

    await createServerSession(
      user.id,
      user.role,
      user.branchId,
      Boolean(rememberMe),
      ip,
      ua
    );

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await recordAuditLog({
      userId: user.id,
      branchId: user.branchId,
      module: "AUTENTICACION",
      action: "LOGIN_EXITOSO",
      entityId: user.id,
      description: `Inicio de sesión exitoso de ${user.fullName} (${user.role})`,
      ipAddress: ip,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        branchId: user.branchId,
      },
    });
  } catch (error: unknown) {
    console.error("Error en POST /api/auth/login:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno del servidor al procesar el inicio de sesión",
      },
      { status: 500 }
    );
  }
}
