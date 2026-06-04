import { db } from '@/lib/db/drizzle';
import { platformConnections, posts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SyncResult } from './types';

interface TikTokUserInfo {
  data: {
    user: {
      open_id: string;
      display_name: string;
      avatar_url: string;
      follower_count: number;
      following_count: number;
      video_count: number;
    };
  };
  error?: { code: string; message: string };
}

interface TikTokVideo {
  id: string;
  title?: string;
  create_time: number;
  cover_image_url?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

interface TikTokVideoListResponse {
  data: {
    videos: TikTokVideo[];
    cursor?: number;
    has_more?: boolean;
  };
  error?: { code: string; message: string };
}

export async function syncTikTok(
  connectionId: string,
  accessToken: string,
  workspaceId: string
): Promise<SyncResult> {
  let postsUpserted = 0;
  const metricsUpserted = 0;

  try {
    // Get user info
    const userResp = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,video_count',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const userData = (await userResp.json()) as TikTokUserInfo;

    if (!userResp.ok || userData.error?.code !== 'ok') {
      throw new Error(userData.error?.message ?? 'Failed to fetch TikTok user info');
    }

    const user = userData.data.user;

    // Update connection with latest account name/avatar
    await db
      .update(platformConnections)
      .set({
        accountName: user.display_name,
        avatarUrl: user.avatar_url,
        externalAccountId: user.open_id,
      })
      .where(eq(platformConnections.id, connectionId));

    // Get videos
    const videosResp = await fetch(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,cover_image_url,view_count,like_count,comment_count,share_count',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_count: 20 }),
      }
    );
    const videosData = (await videosResp.json()) as TikTokVideoListResponse;

    if (videosResp.ok && (!videosData.error || videosData.error.code === 'ok')) {
      const followers = user.follower_count ?? 0;
      for (const video of videosData.data?.videos ?? []) {
        const reach = video.view_count ?? 0;
        const likes = video.like_count ?? 0;
        const comments = video.comment_count ?? 0;
        const shares = video.share_count ?? 0;
        const engagementRate = reach > 0 ? (likes + comments + shares) / reach : 0;

        const existing = await db
          .select()
          .from(posts)
          .where(and(eq(posts.connectionId, connectionId), eq(posts.externalId, video.id)));

        const values = {
          connectionId,
          workspaceId,
          platform: 'tiktok',
          externalId: video.id,
          caption: video.title ?? null,
          contentType: 'video',
          postedAt: new Date(video.create_time * 1000),
          reach,
          impressions: reach,
          likes,
          comments,
          shares,
          saves: 0,
          thumbnailUrl: video.cover_image_url ?? null,
          engagementRate,
          followerCountAtPostTime: followers,
          discoveryScore: followers > 0 ? reach / followers : 0,
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
