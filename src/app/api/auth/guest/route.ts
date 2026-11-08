import { NextResponse } from "next/server";
import { createGuestServerSession } from "@/lib/auth";

export async function POST() {
  try {
    await createGuestServerSession();
    return NextResponse.json({
      ok: true,
      user: {
        id: 0,
        username: "invitado",
        fullName: "Modo Invitado (Consulta de Resultados)",
        role: "INVITADO",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al iniciar modo invitado",
      },
      { status: 500 }
    );
  }
}
