import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

loadEnv();

/**
 * Applies all pending SQL migrations, then exits. Used by `pnpm db:migrate`
 * locally and by Render's preDeployCommand (after build, before the new
 * instance starts — the documented home for migrations, so they never race
 * the build or each other on zero-downtime deploys).
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  // A dedicated single-connection client we can close cleanly.
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log("[migrate] applying migrations from lib/db/migrations …");
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("[migrate] done.");

  await client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
