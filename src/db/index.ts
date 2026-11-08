import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import path from "path";
import * as schema from "./schema";

export function isRemoteNeonConfigured(): boolean {
  const connStr = process.env.DATABASE_URL;
  return Boolean(
    connStr &&
      connStr.trim() !== "" &&
      !connStr.includes("ep-host.region.aws.neon.tech") &&
      !connStr.includes("ep-ejemplo") &&
      (connStr.startsWith("postgres://") ||
        connStr.startsWith("postgresql://"))
  );
}

// Con PGlite integrado, la base de datos PostgreSQL SIEMPRE está configurada y lista
export function isDatabaseConfigured(): boolean {
  return true;
}

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  pglite: PGlite | undefined;
  drizzleInstance: ReturnType<typeof drizzlePostgres<typeof schema>> | undefined;
};

export function getPgliteClient(): PGlite {
  if (!globalForDb.pglite) {
    const dataDir = path.join(process.cwd(), ".pgdata");
    globalForDb.pglite = new PGlite(dataDir);
  }
  return globalForDb.pglite;
}

export function getDb() {
  if (globalForDb.drizzleInstance) {
    return globalForDb.drizzleInstance;
  }

  if (isRemoteNeonConfigured()) {
    const connStr = process.env.DATABASE_URL!;
    if (!globalForDb.conn) {
      globalForDb.conn = postgres(connStr, {
        ssl: connStr.includes("localhost") ? false : "require",
        max: 10,
        idle_timeout: 20,
        connect_timeout: 15,
      });
    }
    globalForDb.drizzleInstance = drizzlePostgres(globalForDb.conn, { schema });
    return globalForDb.drizzleInstance;
  }

  // Usar motor PostgreSQL persistente local (@electric-sql/pglite)
  const pgClient = getPgliteClient();
  globalForDb.drizzleInstance = drizzlePglite(pgClient, {
    schema,
  }) as unknown as ReturnType<typeof drizzlePostgres<typeof schema>>;

  return globalForDb.drizzleInstance;
}
