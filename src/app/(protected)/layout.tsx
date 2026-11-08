import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { branches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasGlobalBranchAccess } from "@/lib/permissions";
import AppShell, { type BranchOption } from "@/components/layout/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isDatabaseConfigured()) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const db = getDb();
  let branchList: BranchOption[] = [];

  try {
    if (hasGlobalBranchAccess(user.role)) {
      branchList = await db
        .select({
          id: branches.id,
          code: branches.code,
          name: branches.name,
          isActive: branches.isActive,
        })
        .from(branches)
        .orderBy(asc(branches.code));
    } else if (user.branchId) {
      branchList = await db
        .select({
          id: branches.id,
          code: branches.code,
          name: branches.name,
          isActive: branches.isActive,
        })
        .from(branches)
        .where(eq(branches.id, user.branchId));
    }
  } catch {
    branchList = [];
  }

  return (
    <AppShell user={user} initialBranches={branchList}>
      {children}
    </AppShell>
  );
}
