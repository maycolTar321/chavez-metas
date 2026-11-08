import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardAnalytics } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month")
      ? parseInt(searchParams.get("month")!, 10)
      : undefined;
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!, 10)
      : undefined;
    const branchId = searchParams.get("branchId")
      ? parseInt(searchParams.get("branchId")!, 10)
      : null;

    const payload = await getDashboardAnalytics(user, month, year, branchId);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al obtener métricas del dashboard",
      },
      { status: 500 }
    );
  }
}
