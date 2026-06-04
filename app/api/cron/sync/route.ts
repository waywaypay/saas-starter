import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { platformConnections } from '@/lib/db/schema';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { syncPlatform } from '@/lib/socialos/sync/index';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  // Find all active connections that haven't synced in 4+ hours
  const staleConnections = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.isActive, true),
        or(
          isNull(platformConnections.lastSyncAt),
          lt(platformConnections.lastSyncAt, fourHoursAgo)
        )
      )
    );

  const results = await Promise.allSettled(
    staleConnections.map((conn) => syncPlatform(conn.id))
  );

  const summary = results.map((r, i) => ({
    connectionId: staleConnections[i].id,
    platform: staleConnections[i].platform,
    result: r.status === 'fulfilled' ? r.value : { success: false, error: String(r.reason) },
  }));

  console.log(`Cron sync: processed ${staleConnections.length} connections`);

  return NextResponse.json({ synced: staleConnections.length, summary });
}
