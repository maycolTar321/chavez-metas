import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { users, sessions, branches } from "@/db/schema";
import type { SessionUser } from "./permissions";

export const SESSION_COOKIE_NAME = "chavez_metas_session";

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "chavez_metas_default_development_secret_key_change_in_prod_2026";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtSessionPayload {
  sessionId: string;
  userId: number;
  role: string;
  branchId: number | null;
}

export async function signSessionToken(
  payload: JwtSessionPayload,
  rememberMe: boolean
): Promise<string> {
  const expirationTime = rememberMe ? "30d" : "12h";
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<JwtSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sessionId) return null;
    return {
      sessionId: String(payload.sessionId),
      userId: Number(payload.userId ?? 0),
      role: String(payload.role),
      branchId: payload.branchId ? Number(payload.branchId) : null,
    };
  } catch {
    return null;
  }
}

export async function createServerSession(
  userId: number,
  role: string,
  branchId: number | null,
  rememberMe: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const db = getDb();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000)
  );

  const token = await signSessionToken(
    { sessionId, userId, role, branchId },
    rememberMe
  );

  if (role !== "INVITADO" && userId > 0) {
    const tokenHash = await bcrypt.hash(sessionId, 6);
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      tokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      rememberMe,
      isRevoked: false,
      expiresAt,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function createGuestServerSession(): Promise<string> {
  return createServerSession(0, "INVITADO", null, false);
}

export async function destroyServerSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token && isDatabaseConfigured()) {
      const payload = await verifySessionToken(token);
      if (payload?.sessionId && payload.role !== "INVITADO") {
        const db = getDb();
        await db
          .update(sessions)
          .set({ isRevoked: true })
          .where(eq(sessions.id, payload.sessionId));
      }
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignore cookie deletion errors
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    // Sesión en Modo Invitado (Solo Lectura de Resultados)
    if (payload.role === "INVITADO" || payload.userId === 0) {
      return {
        id: 0,
        username: "invitado",
        email: "invitado@chavezmetas.bo",
        fullName: "Modo Invitado (Consulta de Resultados)",
        role: "INVITADO",
        branchId: null,
        branchName: "Todas las Sucursales (Solo Lectura)",
        canRegisterSales: false,
        canEditSales: false,
        canVoidSales: false,
        canManageGoals: false,
        isActive: true,
      };
    }

    const db = getDb();
    const now = new Date();

    const sessionRecords = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, payload.sessionId),
          eq(sessions.isRevoked, false),
          gt(sessions.expiresAt, now)
        )
      )
      .limit(1);

    if (sessionRecords.length === 0) {
      return null;
    }

    const userRecords = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        branchId: users.branchId,
        branchName: branches.name,
        canRegisterSales: users.canRegisterSales,
        canEditSales: users.canEditSales,
        canVoidSales: users.canVoidSales,
        canManageGoals: users.canManageGoals,
        isActive: users.isActive,
      })
      .from(users)
      .leftJoin(branches, eq(users.branchId, branches.id))
      .where(eq(users.id, payload.userId))
      .limit(1);

    const user = userRecords[0];
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
