import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { respondOk } from "@/lib/api/http";
import type { HealthResponse } from "@/lib/api/types";

// Always evaluate fresh; a health check must reflect live DB state.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health -> { ok, db, ts }
 *
 * Returns 200 when the database is reachable, 503 when it is not, so Render's
 * health check (and our smoke script) treat a DB-down server as unhealthy
 * rather than letting a broken deploy go live green.
 */
export async function GET() {
  let dbUp = false;
  try {
    await db.execute(sql`select 1`);
    dbUp = true;
  } catch (err) {
    console.error("[health] db ping failed", err);
  }

  const body: HealthResponse = {
    ok: dbUp,
    db: dbUp ? "up" : "down",
    ts: new Date().toISOString(),
  };

  return respondOk(body, { status: dbUp ? 200 : 503 });
}
