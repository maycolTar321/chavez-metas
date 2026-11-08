import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export interface AuditLogInput {
  userId?: number | null;
  branchId?: number | null;
  module: string;
  action: string;
  entityId?: string | number | null;
  description: string;
  previousData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLogs).values({
      userId: input.userId ?? null,
      branchId: input.branchId ?? null,
      module: input.module,
      action: input.action,
      entityId: input.entityId ? String(input.entityId) : null,
      description: input.description,
      previousData: input.previousData ? input.previousData : null,
      newData: input.newData ? input.newData : null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error("Error registrando bitácora de auditoría:", err);
  }
}
