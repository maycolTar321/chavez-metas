import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/db";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { user: null, dbConfigured: false },
      { status: 200 }
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { user: null, dbConfigured: true },
      { status: 401 }
    );
  }
  return NextResponse.json({ user, dbConfigured: true });
}
