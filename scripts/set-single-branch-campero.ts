import fs from "fs";
import path from "path";
import postgres from "postgres";

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function configureSingleBranch() {
  loadEnv();
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error("DATABASE_URL no configurada");
    process.exit(1);
  }

  const sql = postgres(connStr, { ssl: "require" });
  console.log("Configurando Sucursal CENTRAL (CAMPERO) como ÚNICA activa en Neon...");

  // 1. Actualizar o asegurar que la Sucursal 1 sea CENTRAL / CAMPERO
  await sql`
    UPDATE branches
    SET code = 'CAMPERO',
        name = 'CENTRAL',
        observations = 'Sucursal central donde se registrarán y controlarán las ventas de la operación que estamos implementando.',
        is_active = true,
        updated_at = NOW()
    WHERE id = 1;
  `;

  // 2. Desactivar cualquier otra sucursal existente (SUC-02, SUC-03, etc.)
  await sql`
    UPDATE branches
    SET is_active = false,
        updated_at = NOW()
    WHERE id != 1;
  `;

  // 3. Registrar o asegurar que las otras sucursales empresariales existan en BD como inactivas (para soporte futuro)
  const otherBranches = [
    { code: "PLAZA", name: "Plaza Principal", obs: "Sucursal inactiva en CHÁVEZ METAS (no operativa)" },
    { code: "BELGRANO", name: "Belgrano", obs: "Sucursal inactiva en CHÁVEZ METAS (no operativa)" },
    { code: "JUAN23", name: "Juan XXIII", obs: "Sucursal inactiva en CHÁVEZ METAS (no operativa)" },
    { code: "MASTIL", name: "El Mástil", obs: "Sucursal inactiva en CHÁVEZ METAS (no operativa)" },
  ];

  for (const ob of otherBranches) {
    const existing = await sql`SELECT id FROM branches WHERE code = ${ob.code}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO branches (code, name, address, manager_name, phone, opening_date, is_active, observations)
        VALUES (${ob.code}, ${ob.name}, 'Tarija / Red Farmacias', 'No asignado', '+591 4 0000000', '2020-01-01', false, ${ob.obs});
      `;
    } else {
      await sql`
        UPDATE branches 
        SET name = ${ob.name}, is_active = false, observations = ${ob.obs}
        WHERE code = ${ob.code};
      `;
    }
  }

  // 4. Asignar todos los trabajadores y encargados a la Sucursal CENTRAL (id = 1)
  await sql`
    UPDATE users
    SET branch_id = 1,
        updated_at = NOW()
    WHERE role IN ('TRABAJADOR', 'ENCARGADO', 'ADMIN_SUCURSAL');
  `;

  // 5. Vincular todas las ventas y turnos a CENTRAL (id = 1)
  await sql`
    UPDATE sales
    SET branch_id = 1
    WHERE branch_id != 1;
  `;

  await sql`
    UPDATE shifts
    SET branch_id = 1
    WHERE branch_id IS NOT NULL AND branch_id != 1;
  `;

  // 6. Vincular metas mensuales activas exclusivamente a CENTRAL (id = 1) y desactivar metas de otras sucursales
  await sql`
    UPDATE monthly_goals
    SET is_active = false
    WHERE branch_id != 1;
  `;
  await sql`
    UPDATE monthly_goals
    SET is_active = true
    WHERE branch_id = 1;
  `;

  console.log("✓ Neon configurado exitosamente: CENTRAL (CAMPERO) es la única sucursal activa.");
  await sql.end();

  // 7. Replicar exactamente en PGlite local para pruebas
  try {
    const { getPgliteClient } = await import("@/db");
    const pg = getPgliteClient();
    await pg.exec(`
      UPDATE branches SET code = 'CAMPERO', name = 'CENTRAL', observations = 'Sucursal central donde se registrarán y controlarán las ventas de la operación que estamos implementando.', is_active = true WHERE id = 1;
      UPDATE branches SET is_active = false WHERE id != 1;
      UPDATE users SET branch_id = 1 WHERE role IN ('TRABAJADOR', 'ENCARGADO', 'ADMIN_SUCURSAL');
      UPDATE sales SET branch_id = 1 WHERE branch_id != 1;
      UPDATE monthly_goals SET is_active = false WHERE branch_id != 1;
      UPDATE monthly_goals SET is_active = true WHERE branch_id = 1;
    `);
    console.log("✓ Local PGlite también sincronizado con CENTRAL (CAMPERO) como única activa.");
  } catch (err) {
    console.log("Nota PGlite:", err);
  }

  process.exit(0);
}

configureSingleBranch().catch((err) => {
  console.error("Error al configurar single branch:", err);
  process.exit(1);
});
