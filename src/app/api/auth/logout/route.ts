import { NextResponse } from "next/server";
import { getCurrentUser, destroyServerSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await recordAuditLog({
        userId: user.id,
        branchId: user.branchId,
        module: "AUTENTICACION",
        action: "LOGOUT",
        entityId: user.id,
        description: `Cierre de sesión de ${user.fullName}`,
      });
    }
    await destroyServerSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
