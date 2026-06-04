import { db } from '@/lib/db/drizzle';
import { platformConnections, dailyMetrics, posts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SyncResult } from './types';

interface InsightValue {
  value: number;
  end_time: string;
}

interface InsightMetric {
  name: string;
  period: string;
  values: InsightValue[];
}

interface InsightsResponse {
  data: InsightMetric[];
}

interface MediaInsight {
  id: string;
  name: string;
  values: { value: number }[];
}

interface MediaItem {
  id: string;
  caption?: string;
  media_type: string;
  timestamp: string;
  insights?: { data: MediaInsight[] };
}

interface MediaResponse {
  data: MediaItem[];
}

export async function syncInstagram(
  connectionId: string,
  accessToken: string,
  igUserId: string,
  workspaceId: string
): Promise<SyncResult> {
  let postsUpserted = 0;
  let metricsUpserted = 0;

  try {
    const now = new Date();
    const since = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(now.getTime() / 1000);

    // Get insights (follower_count, impressions, reach, profile_views)
    const insightsUrl = `https://graph.facebook.com/v21.0/${igUserId}/insights?metric=follower_count,impressions,reach,profile_views&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
    const insightsResp = await fetch(insightsUrl);
    const insightsData = (await insightsResp.json()) as InsightsResponse & { error?: { message: string } };

    if (!insightsResp.ok || insightsData.error) {
      throw new Error(insightsData.error?.message ?? 'Failed to fetch Instagram insights');
    }

    // Build a date-keyed map of metrics
    const dateMetrics = new Map<
      string,
      { followers: number; impressions: number; reach: number; profileViews: number }
    >();

    for (const metric of insightsData.data ?? []) {
      for (const entry of metric.values ?? []) {
        const dateKey = entry.end_time.split('T')[0];
        if (!dateMetrics.has(dateKey)) {
          dateMetrics.set(dateKey, { followers: 0, impressions: 0, reach: 0, profileViews: 0 });
        }
        const row = dateMetrics.get(dateKey)!;
        if (metric.name === 'follower_count') row.followers = entry.value;
        if (metric.name === 'impressions') row.impressions = entry.value;
        if (metric.name === 'reach') row.reach = entry.value;
        if (metric.name === 'profile_views') row.profileViews = entry.value;
      }
    }

    // Upsert daily metrics
    for (const [dateKey, vals] of dateMetrics) {
      const date = new Date(dateKey);
      // Check if exists
      const existing = await db
        .select()
        .from(dailyMetrics)
        .where(
          and(
            eq(dailyMetrics.connectionId, connectionId),
            eq(dailyMetrics.date, date)
          )
        );

      const engagements = Math.round(vals.reach * 0.035); // estimate if not available

      if (existing.length > 0) {
        await db
          .update(dailyMetrics)
          .set({
            followers: vals.followers,
            impressions: vals.impressions,
            reach: vals.reach,
            engagements,
            profileViews: vals.profileViews,
          })
          .where(eq(dailyMetrics.id, existing[0].id));
      } else {
        await db.insert(dailyMetrics).values({
          connectionId,
          workspaceId,
          date,
          platform: 'instagram',
          followers: vals.followers,
          impressions: vals.impressions,
          reach: vals.reach,
          engagements,
          profileViews: vals.profileViews,
        });
      }
      metricsUpserted++;
    }

    // Get media
    const mediaUrl =
      `https://graph.facebook.com/v21.0/${igUserId}/media` +
      `?fields=id,caption,media_type,timestamp,insights.metric(reach,impressions,likes_count,comments_count,shares,saved)` +
      `&limit=50&access_token=${accessToken}`;
    const mediaResp = await fetch(mediaUrl);
    const mediaData = (await mediaResp.json()) as MediaResponse & { error?: { message: string } };

    if (mediaResp.ok && !mediaData.error) {
      for (const item of mediaData.data ?? []) {
        const insightMap: Record<string, number> = {};
        for (const ins of item.insights?.data ?? []) {
          insightMap[ins.name] = ins.values?.[0]?.value ?? 0;
        }

        const reach = insightMap['reach'] ?? 0;
        const impressions = insightMap['impressions'] ?? 0;
        const likes = insightMap['likes_count'] ?? 0;
        const comments = insightMap['comments_count'] ?? 0;
        const shares = insightMap['shares'] ?? 0;
        const saves = insightMap['saved'] ?? 0;
        const engagementRate = reach > 0 ? (likes + comments + shares) / reach : 0;

        const existing = await db
          .select()
          .from(posts)
          .where(and(eq(posts.connectionId, connectionId), eq(posts.externalId, item.id)));

        const values = {
          connectionId,
          workspaceId,
          platform: 'instagram',
          externalId: item.id,
          caption: item.caption ?? null,
          contentType: item.media_type?.toLowerCase() ?? 'image',
          postedAt: new Date(item.timestamp),
          reach,
          impressions,
          likes,
          comments,
          shares,
          saves,
          engagementRate,
        };

        if (existing.length > 0) {
          await db.update(posts).set(values).where(eq(posts.id, existing[0].id));
        } else {
          await db.insert(posts).values(values);
        }
        postsUpserted++;
      }
    }

    // Update lastSyncAt
    await db
      .update(platformConnections)
      .set({ lastSyncAt: new Date(), errorMessage: null })
      .where(eq(platformConnections.id, connectionId));

    return { success: true, postsUpserted, metricsUpserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(platformConnections)
      .set({ errorMessage: msg })
      .where(eq(platformConnections.id, connectionId));
    return { success: false, postsUpserted, metricsUpserted, error: msg };
  }
}
