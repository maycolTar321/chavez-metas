import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHÁVEZ METAS | Sistema de Control de Metas, Ventas y Rendimiento",
  description:
    "Plataforma empresarial de control centralizado de metas mensuales, ventas por turnos de 24 horas y rendimiento de sucursales para Cadena de Farmacias Chávez.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#F3F4F6] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
