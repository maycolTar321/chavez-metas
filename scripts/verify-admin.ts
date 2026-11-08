import fs from "fs";
import path from "path";
import postgres from "postgres";
import bcrypt from "bcryptjs";

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

async function main() {
  loadEnv();
  const connStr = process.env.DATABASE_URL;
  const sql = postgres(connStr!, { ssl: "require" });
  
  // Check if admin user exists
  const existing = await sql`
    SELECT id, username, email, role, is_active, can_register_sales, can_edit_sales, can_void_sales, can_manage_goals
    FROM users
    WHERE username = 'admin' OR email = 'admin@chavezmetas.local'
  `;
  
  console.log("Current admin user in Neon:", JSON.stringify(existing, null, 2));

  // If email is not admin@chavezmetas.local, update it
  if (existing.length > 0) {
    const updated = await sql`
      UPDATE users
      SET email = 'admin@chavezmetas.local',
          role = 'SUPERADMIN',
          is_active = true,
          can_register_sales = true,
          can_edit_sales = true,
          can_void_sales = true,
          can_manage_goals = true,
          updated_at = NOW()
      WHERE id = ${existing[0].id}
      RETURNING id, username, email, role, is_active;
    `;
    console.log("Updated admin user:", JSON.stringify(updated[0], null, 2));
  } else {
    const hash = await bcrypt.hash("chavez2026", 12);
    const created = await sql`
      INSERT INTO users (
        username, email, full_name, password_hash, role, branch_id,
        can_register_sales, can_edit_sales, can_void_sales, can_manage_goals,
        is_active, phone
      ) VALUES (
        'admin', 'admin@chavezmetas.local', 'Administradora General — Chávez Metas', ${hash}, 'SUPERADMIN', NULL,
        true, true, true, true,
        true, '+591 70000001'
      )
      RETURNING id, username, email, role;
    `;
    console.log("Created admin user:", JSON.stringify(created[0], null, 2));
  }

  await sql.end();

  // Also update local PGlite
  try {
    const { getPgliteClient } = await import("@/db");
    const pg = getPgliteClient();
    await pg.query(
      "UPDATE users SET email = 'admin@chavezmetas.local', is_active = true WHERE username = 'admin';"
    );
    console.log("Local PGlite admin also updated to admin@chavezmetas.local");
  } catch (e) {
    console.log("Local PGlite note:", e);
  }
}

main().catch((err) => {
  console.error("Error verifying admin:", err);
  process.exit(1);
});
