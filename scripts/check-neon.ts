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

async function main() {
  loadEnv();
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error("No DATABASE_URL configured");
    process.exit(1);
  }
  const sql = postgres(connStr, { ssl: "require" });
  console.log("Conectando a Neon...");
  const res = await sql`SELECT current_database(), current_user, NOW();`;
  console.log("NEON CONNECTION SUCCESSFUL:");
  console.log(JSON.stringify(res[0], null, 2));

  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log("TABLES IN NEON (" + tables.length + "):");
  console.log(tables.map((t) => t.table_name).join(", "));
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("NEON ERROR:", err);
  process.exit(1);
});
