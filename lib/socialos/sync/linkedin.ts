import { db } from '@/lib/db/drizzle';
import { platformConnections, posts, dailyMetrics } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SyncResult } from './types';

interface LinkedInProfile {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}

interface LinkedInPost {
  id: string;
  specificContent?: {
    'com.linkedin.ugc.ShareContent'?: {
      shareCommentary?: { text: string };
    };
  };
  created?: { time: number };
}

interface LinkedInPostsResponse {
  elements: LinkedInPost[];
}

interface LinkedInShareStats {
  totalShareStatistics?: {
    impressionCount?: number;
    clickCount?: number;
    engagement?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  organizationalEntity?: string;
}

interface LinkedInStatsResponse {
  elements: LinkedInShareStats[];
}

export async function syncLinkedIn(
  connectionId: string,
  accessToken: string,
  workspaceId: string,
  personId: string
): Promise<SyncResult> {
  let postsUpserted = 0;
  let metricsUpserted = 0;

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Get profile info
    const profileResp = await fetch('https://api.linkedin.com/v2/me', { headers });
    const profile = (await profileResp.json()) as LinkedInProfile & { message?: string };

    if (!profileResp.ok) {
      throw new Error(profile.message ?? 'Failed to fetch LinkedIn profile');
    }

    const authorUrn = `urn:li:person:${personId}`;

    // Get posts
    const postsResp = await fetch(
      `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=50`,
      { headers }
    );
    const postsData = (await postsResp.json()) as LinkedInPostsResponse & { message?: string };

    if (postsResp.ok && postsData.elements) {
      for (const item of postsData.elements) {
        const caption =
          item.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text ?? null;
        const postedAt = item.created?.time ? new Date(item.created.time) : new Date();
        const externalId = item.id;

        const existing = await db
          .select()
          .from(posts)
          .where(and(eq(posts.connectionId, connectionId), eq(posts.externalId, externalId)));

        const values = {
          connectionId,
          workspaceId,
          platform: 'linkedin',
          externalId,
          caption,
          contentType: 'post',
          postedAt,
          reach: 0,
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          engagementRate: 0,
        };

        if (existing.length > 0) {
          await db.update(posts).set(values).where(eq(posts.id, existing[0].id));
        } else {
          await db.insert(posts).values(values);
        }
        postsUpserted++;
      }
    }

    // Organization stats (daily)
    const now = new Date();
    const statsResp = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(authorUrn)}&timeIntervals.timeGranularityType=DAY`,
      { headers }
    );
    const statsData = (await statsResp.json()) as LinkedInStatsResponse;

    if (statsResp.ok && statsData.elements) {
      const totalImpressions = statsData.elements.reduce(
        (sum, e) => sum + (e.totalShareStatistics?.impressionCount ?? 0),
        0
      );
      const totalEngagements = statsData.elements.reduce(
        (sum, e) => sum + (e.totalShareStatistics?.engagement ? Math.round(e.totalShareStatistics.engagement * totalImpressions) : 0),
        0
      );

      // Insert a single summary metric for today
      const today = new Date(now.toISOString().split('T')[0]);
      const existing = await db
        .select()
        .from(dailyMetrics)
        .where(and(eq(dailyMetrics.connectionId, connectionId), eq(dailyMetrics.date, today)));

      if (existing.length > 0) {
        await db
          .update(dailyMetrics)
          .set({ impressions: totalImpressions, engagements: totalEngagements })
          .where(eq(dailyMetrics.id, existing[0].id));
      } else {
        await db.insert(dailyMetrics).values({
          connectionId,
          workspaceId,
          date: today,
          platform: 'linkedin',
          followers: 0,
          impressions: totalImpressions,
          reach: totalImpressions,
          engagements: totalEngagements,
        });
      }
      metricsUpserted++;
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
