import { db } from '@/lib/db/drizzle';
import { platformConnections, dailyMetrics, posts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SyncResult } from './types';

interface PageInsightValue {
  value: number;
  end_time: string;
}

interface PageInsightMetric {
  name: string;
  period: string;
  values: PageInsightValue[];
}

interface PageInsightsResponse {
  data: PageInsightMetric[];
}

interface PostInsight {
  id: string;
  name: string;
  values: { value: number }[];
}

interface FBPost {
  id: string;
  message?: string;
  created_time: string;
  insights?: { data: PostInsight[] };
}

interface FBPostsResponse {
  data: FBPost[];
}

export async function syncFacebook(
  connectionId: string,
  accessToken: string,
  pageId: string,
  workspaceId: string
): Promise<SyncResult> {
  let postsUpserted = 0;
  let metricsUpserted = 0;

  try {
    const now = new Date();
    const since = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(now.getTime() / 1000);

    // Page insights
    const insightsUrl =
      `https://graph.facebook.com/v21.0/${pageId}/insights` +
      `?metric=page_impressions,page_reach,page_engaged_users,page_fan_count` +
      `&period=day&since=${since}&until=${until}&access_token=${accessToken}`;
    const insightsResp = await fetch(insightsUrl);
    const insightsData = (await insightsResp.json()) as PageInsightsResponse & { error?: { message: string } };

    if (!insightsResp.ok || insightsData.error) {
      throw new Error(insightsData.error?.message ?? 'Failed to fetch Facebook page insights');
    }

    const dateMetrics = new Map<
      string,
      { followers: number; impressions: number; reach: number; engagements: number }
    >();

    for (const metric of insightsData.data ?? []) {
      for (const entry of metric.values ?? []) {
        const dateKey = entry.end_time.split('T')[0];
        if (!dateMetrics.has(dateKey)) {
          dateMetrics.set(dateKey, { followers: 0, impressions: 0, reach: 0, engagements: 0 });
        }
        const row = dateMetrics.get(dateKey)!;
        if (metric.name === 'page_fan_count') row.followers = entry.value;
        if (metric.name === 'page_impressions') row.impressions = entry.value;
        if (metric.name === 'page_reach') row.reach = entry.value;
        if (metric.name === 'page_engaged_users') row.engagements = entry.value;
      }
    }

    for (const [dateKey, vals] of dateMetrics) {
      const date = new Date(dateKey);
      const existing = await db
        .select()
        .from(dailyMetrics)
        .where(and(eq(dailyMetrics.connectionId, connectionId), eq(dailyMetrics.date, date)));

      if (existing.length > 0) {
        await db
          .update(dailyMetrics)
          .set({ followers: vals.followers, impressions: vals.impressions, reach: vals.reach, engagements: vals.engagements })
          .where(eq(dailyMetrics.id, existing[0].id));
      } else {
        await db.insert(dailyMetrics).values({
          connectionId,
          workspaceId,
          date,
          platform: 'facebook',
          followers: vals.followers,
          impressions: vals.impressions,
          reach: vals.reach,
          engagements: vals.engagements,
        });
      }
      metricsUpserted++;
    }

    // Page posts
    const postsUrl =
      `https://graph.facebook.com/v21.0/${pageId}/posts` +
      `?fields=id,message,created_time,insights.metric(post_impressions,post_reach,post_engaged_users)` +
      `&limit=50&access_token=${accessToken}`;
    const postsResp = await fetch(postsUrl);
    const postsData = (await postsResp.json()) as FBPostsResponse & { error?: { message: string } };

    if (postsResp.ok && !postsData.error) {
      for (const item of postsData.data ?? []) {
        const insightMap: Record<string, number> = {};
        for (const ins of item.insights?.data ?? []) {
          insightMap[ins.name] = ins.values?.[0]?.value ?? 0;
        }

        const reach = insightMap['post_reach'] ?? 0;
        const impressions = insightMap['post_impressions'] ?? 0;
        const engagements = insightMap['post_engaged_users'] ?? 0;
        const engagementRate = reach > 0 ? engagements / reach : 0;

        const existing = await db
          .select()
          .from(posts)
          .where(and(eq(posts.connectionId, connectionId), eq(posts.externalId, item.id)));

        const values = {
          connectionId,
          workspaceId,
          platform: 'facebook',
          externalId: item.id,
          caption: item.message ?? null,
          contentType: 'post',
          postedAt: new Date(item.created_time),
          reach,
          impressions,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
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
