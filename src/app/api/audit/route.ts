import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, users, branches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Acceso denegado: Solo el SUPERADMIN puede consultar la bitácora completa de auditoría.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const moduleFilter = searchParams.get("module");
    const branchIdFilter = searchParams.get("branchId")
      ? parseInt(searchParams.get("branchId")!, 10)
      : null;
    const limitParam = Math.min(
      300,
      parseInt(searchParams.get("limit") || "150", 10)
    );

    const db = getDb();
    const conditions = [];
    if (moduleFilter && moduleFilter !== "TODOS") {
      conditions.push(eq(auditLogs.module, moduleFilter));
    }
    if (branchIdFilter) {
      conditions.push(eq(auditLogs.branchId, branchIdFilter));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userFullName: users.fullName,
        username: users.username,
        userRole: users.role,
        branchId: auditLogs.branchId,
        branchName: branches.name,
        branchCode: branches.code,
        module: auditLogs.module,
        action: auditLogs.action,
        entityId: auditLogs.entityId,
        description: auditLogs.description,
        previousData: auditLogs.previousData,
        newData: auditLogs.newData,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(branches, eq(auditLogs.branchId, branches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitParam);

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al consultar bitácora de auditoría",
      },
      { status: 500 }
    );
  }
}
