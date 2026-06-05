import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Lazy, process-wide singleton DB client.
 *
 * Lazy because `next build` imports server modules during page-data collection;
 * creating the postgres connection eagerly would touch DATABASE_URL (skipped at
 * build) and could open sockets at build time. We defer creation until the
 * first real query. The global cache prevents connection exhaustion under dev
 * HMR, which re-evaluates modules on every edit.
 */
declare global {
  // eslint-disable-next-line no-var
  var __socialos_db__: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const client = postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    // postgres.js prepared statements are incompatible with some poolers; off
    // keeps us portable across Render's pooled/unpooled endpoints.
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

export const db: Database =
  globalThis.__socialos_db__ ?? (globalThis.__socialos_db__ = createDb());

export * as schema from "./schema";
