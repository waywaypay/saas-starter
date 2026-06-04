import { db } from '@/lib/db/drizzle';
import { platformConnections, posts, dailyMetrics } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SyncResult } from './types';

interface YTChannel {
  id: string;
  snippet: { title: string; thumbnails?: { default?: { url: string } } };
  statistics: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
  };
}

interface YTChannelsResponse {
  items: YTChannel[];
  error?: { message: string };
}

interface YTSearchItem {
  id: { videoId: string };
  snippet: { title: string; publishedAt: string; thumbnails?: { default?: { url: string } } };
}

interface YTSearchResponse {
  items: YTSearchItem[];
  error?: { message: string };
}

interface YTAnalyticsRow {
  [key: string]: string | number;
}

interface YTAnalyticsResponse {
  columnHeaders: Array<{ name: string }>;
  rows?: YTAnalyticsRow[][];
  error?: { message: string };
}

export async function syncYouTube(
  connectionId: string,
  accessToken: string,
  workspaceId: string
): Promise<SyncResult> {
  let postsUpserted = 0;
  let metricsUpserted = 0;

  try {
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Channel info
    const channelResp = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: authHeader }
    );
    const channelData = (await channelResp.json()) as YTChannelsResponse;

    if (!channelResp.ok || channelData.error) {
      throw new Error(channelData.error?.message ?? 'Failed to fetch YouTube channel');
    }

    const channel = channelData.items?.[0];
    if (!channel) throw new Error('No YouTube channel found');

    const subscribers = parseInt(channel.statistics.subscriberCount ?? '0', 10);

    // Update connection
    await db
      .update(platformConnections)
      .set({
        accountName: channel.snippet.title,
        avatarUrl: channel.snippet.thumbnails?.default?.url ?? null,
        externalAccountId: channel.id,
      })
      .where(eq(platformConnections.id, connectionId));

    // Videos
    const videosResp = await fetch(
      'https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=50',
      { headers: authHeader }
    );
    const videosData = (await videosResp.json()) as YTSearchResponse;

    if (videosResp.ok && !videosData.error) {
      for (const item of videosData.items ?? []) {
        const externalId = item.id.videoId;
        const existing = await db
          .select()
          .from(posts)
          .where(and(eq(posts.connectionId, connectionId), eq(posts.externalId, externalId)));

        const values = {
          connectionId,
          workspaceId,
          platform: 'youtube',
          externalId,
          caption: item.snippet.title,
          contentType: 'video',
          postedAt: new Date(item.snippet.publishedAt),
          thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
          reach: 0,
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          engagementRate: 0,
          followerCountAtPostTime: subscribers,
        };

        if (existing.length > 0) {
          await db.update(posts).set(values).where(eq(posts.id, existing[0].id));
        } else {
          await db.insert(posts).values(values);
        }
        postsUpserted++;
      }
    }

    // Analytics
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const startDateObj = new Date(now);
    startDateObj.setDate(startDateObj.getDate() - 30);
    const startDate = startDateObj.toISOString().split('T')[0];

    const analyticsResp = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&metrics=views,estimatedMinutesWatched,likes,dislikes,comments,shares&dimensions=day&startDate=${startDate}&endDate=${endDate}`,
      { headers: authHeader }
    );
    const analyticsData = (await analyticsResp.json()) as YTAnalyticsResponse;

    if (analyticsResp.ok && !analyticsData.error && analyticsData.rows) {
      const cols = analyticsData.columnHeaders.map((h) => h.name);
      for (const row of analyticsData.rows) {
        const get = (name: string): number => {
          const idx = cols.indexOf(name);
          return idx >= 0 ? Number(row[idx]) : 0;
        };
        const dateKey = String(row[0]);
        const date = new Date(dateKey);
        const views = get('views');
        const likes = get('likes');
        const comments = get('comments');
        const shares = get('shares');
        const engagements = likes + comments + shares;

        const existing = await db
          .select()
          .from(dailyMetrics)
          .where(and(eq(dailyMetrics.connectionId, connectionId), eq(dailyMetrics.date, date)));

        if (existing.length > 0) {
          await db
            .update(dailyMetrics)
            .set({ reach: views, impressions: views, engagements, followers: subscribers })
            .where(eq(dailyMetrics.id, existing[0].id));
        } else {
          await db.insert(dailyMetrics).values({
            connectionId,
            workspaceId,
            date,
            platform: 'youtube',
            followers: subscribers,
            impressions: views,
            reach: views,
            engagements,
          });
        }
        metricsUpserted++;
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
