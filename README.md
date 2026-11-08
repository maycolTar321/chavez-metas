# CHÁVEZ METAS — Sistema Profesional de Control de Metas, Ventas y Rendimiento de Sucursales

Plataforma web empresarial construida con **Next.js App Router, React 19, TypeScript, Tailwind CSS, Drizzle ORM, Zod y PostgreSQL (Neon)** para el control centralizado de metas mensuales, **Meta Diaria Inteligente ("¡Cada Día Cuenta!")**, ventas en turnos de 24 horas (incluyendo turnos nocturnos que cruzan la medianoche), rendimiento de sucursales y auditoría.

---

## 1. Inicio Rápido con Archivo `.bat`

Para iniciar el sistema rápidamente en Windows y abrir el navegador en `http://localhost:3000`:

1. Haz doble clic en **`iniciar_chavez_metas.bat`** en la raíz del proyecto (`d:\appmetas\iniciar_chavez_metas.bat`).

---

## 2. Configuración de Base de Datos PostgreSQL en Neon

1. Copia `.env.example` a `.env` (el script `.bat` lo crea automáticamente si no existe).
2. Coloca tu URL real de **Neon PostgreSQL** en `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://usuario:password@ep-tu-instancia.aws.neon.tech/neondb?sslmode=require"
   AUTH_SECRET="clave_secreta_segura_de_al_menos_32_caracteres_2026"
   INITIAL_SETUP_TOKEN="chavez-setup-inicial-2026"
   ```
3. Sincroniza las tablas del esquema en PostgreSQL ejecutando:
   ```bash
   npm run db:push
   ```
4. Ingresa a `http://localhost:3000/setup` para crear el primer usuario **SUPERADMIN** y poblar opcionalmente el catálogo base de turnos 24h y sucursales iniciales.

---

## 3. Módulos Implementados

1. **Inicio (`/dashboard`)**: Dashboard General de Gerencia y Dashboard Operativo de Sucursal con actualización en tiempo real, tarjeta destacada **Meta Diaria — ¡Cada Día Cuenta!**, evolución diaria, evolución mensual y comparativa de sucursales.
2. **Registro de Ventas (`/ventas`)**: Registro con validación Zod en servidor, clave de idempotencia anti-duplicados, detección automática de turnos nocturnos que cruzan la medianoche (ej. `22:00` a `06:00`), edición y anulación con trazabilidad.
3. **Metas Mensuales y Meta Diaria (`/metas`)**: Asignación de metas en Bolivianos (`NUMERIC(14,2)`), configuración de método de cálculo diario (**Distribución Uniforme**, **Por Días Operativos** o **Personalizada por Día**), saldo acumulado a favor/pendiente y ajuste automático de los próximos días.
4. **Sucursales (`/sucursales`)**: Alta, edición, activación y desactivación sin pérdida de datos históricos.
5. **Personal (`/personal`)**: Administración de usuarios y permisos con roles `SUPERADMIN`, `GERENCIA`, `ADMIN_SUCURSAL`, `ENCARGADO` y `TRABAJADOR` y aislamiento de datos por sucursal en el backend.
6. **Turnos 24h (`/turnos`)**: Configuración de horarios Mañana, Tarde, Noche (cruza medianoche) y Personalizados.
7. **Rendimiento (`/rendimiento`)**: Ranking de sucursales, productividad por turno y desempeño por trabajador.
8. **Reportes (`/reportes`)**: Reportes ejecutivos exportables a Excel (CSV) y formato imprimible/PDF con detalle de metas diarias y saldos acumulados.
9. **Historial (`/historial`)**: Búsqueda avanzada por rango de fechas operativas, turno y estado, con visor de historial de cambios por registro.
10. **Auditoría (`/auditoria`)**: Bitácora central inmutable con instantáneas JSON (`previousData` / `newData`).
11. **Configuración (`/configuracion`)**: Parámetros de moneda (`BOB` / `Bs`), zona horaria (`America/La_Paz`), horario de cierre operativo, tratamiento de feriados y plantillas de mensajes motivadores (Casos A, B y C).
