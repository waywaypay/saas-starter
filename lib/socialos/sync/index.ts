import { db } from '@/lib/db/drizzle';
import { platformConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { SyncResult } from './types';
import { syncInstagram } from './instagram';
import { syncFacebook } from './facebook';
import { syncTikTok } from './tiktok';
import { syncLinkedIn } from './linkedin';
import { syncYouTube } from './youtube';

async function refreshGoogleToken(connectionId: string, refreshToken: string): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
    }),
  });

  const data = (await resp.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error ?? 'Failed to refresh Google access token');
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await db
    .update(platformConnections)
    .set({ accessToken: data.access_token, tokenExpiresAt: expiresAt })
    .where(eq(platformConnections.id, connectionId));

  return data.access_token;
}

async function refreshTikTokToken(connectionId: string, refreshToken: string): Promise<string> {
  const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_key: process.env.TIKTOK_CLIENT_KEY ?? '',
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
    }),
  });

  const data = (await resp.json()) as { data?: { access_token?: string; expires_in?: number }; error?: { message: string } };
  const accessToken = data.data?.access_token;
  if (!resp.ok || !accessToken) {
    throw new Error(data.error?.message ?? 'Failed to refresh TikTok access token');
  }

  const expiresAt = new Date(Date.now() + (data.data?.expires_in ?? 86400) * 1000);
  await db
    .update(platformConnections)
    .set({ accessToken, tokenExpiresAt: expiresAt })
    .where(eq(platformConnections.id, connectionId));

  return accessToken;
}

export async function syncPlatform(connectionId: string): Promise<SyncResult> {
  const rows = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.id, connectionId));

  const connection = rows[0];
  if (!connection) {
    return { success: false, postsUpserted: 0, metricsUpserted: 0, error: 'Connection not found' };
  }

  if (!connection.isActive) {
    return { success: false, postsUpserted: 0, metricsUpserted: 0, error: 'Connection is inactive' };
  }

  if (!connection.accessToken) {
    return { success: false, postsUpserted: 0, metricsUpserted: 0, error: 'No access token — reconnect the account' };
  }

  let accessToken = connection.accessToken;
  const platform = connection.platform;

  // Check token expiry and refresh if needed
  const tokenExpired =
    connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (tokenExpired && connection.refreshToken) {
    try {
      if (platform === 'youtube') {
        accessToken = await refreshGoogleToken(connectionId, connection.refreshToken);
      } else if (platform === 'tiktok') {
        accessToken = await refreshTikTokToken(connectionId, connection.refreshToken);
      }
      // Meta and LinkedIn don't support token refresh — require re-auth
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(platformConnections)
        .set({ errorMessage: `Token refresh failed: ${msg}` })
        .where(eq(platformConnections.id, connectionId));
      return { success: false, postsUpserted: 0, metricsUpserted: 0, error: `Token refresh failed: ${msg}` };
    }
  }

  const workspaceId = connection.workspaceId;
  const externalId = connection.externalAccountId ?? '';

  switch (platform) {
    case 'instagram':
      return syncInstagram(connectionId, accessToken, externalId, workspaceId);

    case 'facebook':
      return syncFacebook(connectionId, accessToken, externalId, workspaceId);

    case 'tiktok':
      return syncTikTok(connectionId, accessToken, workspaceId);

    case 'linkedin':
      return syncLinkedIn(connectionId, accessToken, workspaceId, externalId);

    case 'youtube':
      return syncYouTube(connectionId, accessToken, workspaceId);

    default:
      return { success: false, postsUpserted: 0, metricsUpserted: 0, error: `Unknown platform: ${platform}` };
  }
}
