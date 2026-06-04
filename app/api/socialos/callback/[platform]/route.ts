import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { platformConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyState } from '@/lib/socialos/oauth';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

// ---- Meta (Instagram + Facebook) ----
async function handleMetaCallback(code: string, workspaceId: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_APP_ID or META_APP_SECRET not set');

  const redirectUri = `${BASE_URL}/api/socialos/callback/meta`;

  // Exchange code for short-lived token
  const tokenResp = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenResp.json()) as TokenResponse;
  if (!tokenResp.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? 'Meta token exchange failed');
  }

  // Exchange for long-lived token
  const llResp = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  );
  const llData = (await llResp.json()) as TokenResponse;
  const longLivedToken = llData.access_token ?? tokenData.access_token;
  const expiresAt = new Date(Date.now() + (llData.expires_in ?? 5184000) * 1000); // default 60 days

  // Get Facebook page list
  const pagesResp = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}`
  );
  const pagesData = (await pagesResp.json()) as { data: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } };

  // Upsert Facebook connection
  const fbName = pagesData.data?.[0]?.name ?? 'Facebook Page';
  const fbPageId = pagesData.data?.[0]?.id ?? '';
  const fbPageToken = pagesData.data?.[0]?.access_token ?? longLivedToken;

  await upsertConnection({
    workspaceId,
    platform: 'facebook',
    accountName: fbName,
    accessToken: fbPageToken,
    tokenExpiresAt: expiresAt,
    externalAccountId: fbPageId,
    scopes: 'pages_show_list,pages_read_engagement',
  });

  // Get Instagram Business Account
  if (fbPageId) {
    const igResp = await fetch(
      `https://graph.facebook.com/v21.0/${fbPageId}?fields=instagram_business_account&access_token=${fbPageToken}`
    );
    const igData = (await igResp.json()) as { instagram_business_account?: { id: string }; error?: { message: string } };

    if (igData.instagram_business_account?.id) {
      const igId = igData.instagram_business_account.id;
      // Get IG user details
      const igUserResp = await fetch(
        `https://graph.facebook.com/v21.0/${igId}?fields=name,username,profile_picture_url&access_token=${fbPageToken}`
      );
      const igUser = (await igUserResp.json()) as { name?: string; username?: string; profile_picture_url?: string };

      await upsertConnection({
        workspaceId,
        platform: 'instagram',
        accountName: igUser.username ?? igUser.name ?? 'Instagram Account',
        avatarUrl: igUser.profile_picture_url,
        accessToken: fbPageToken,
        tokenExpiresAt: expiresAt,
        externalAccountId: igId,
        scopes: 'instagram_basic,instagram_manage_insights',
      });
    }
  }
}

// ---- TikTok ----
async function handleTikTokCallback(code: string, workspaceId: string) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not set');

  const redirectUri = `${BASE_URL}/api/socialos/callback/tiktok`;

  const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenResp.json()) as {
    data?: { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; scope?: string };
    error?: { message: string };
  };

  const data = tokenData.data;
  if (!tokenResp.ok || !data?.access_token) {
    throw new Error(tokenData.error?.message ?? 'TikTok token exchange failed');
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000);

  // Get user info
  const userResp = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  const userData = (await userResp.json()) as { data?: { user?: { display_name?: string; avatar_url?: string; open_id?: string } }; error?: { message: string } };
  const user = userData.data?.user;

  await upsertConnection({
    workspaceId,
    platform: 'tiktok',
    accountName: user?.display_name ?? 'TikTok Account',
    avatarUrl: user?.avatar_url,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: expiresAt,
    externalAccountId: data.open_id ?? user?.open_id,
    scopes: data.scope,
  });
}

// ---- LinkedIn ----
async function handleLinkedInCallback(code: string, workspaceId: string) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not set');

  const redirectUri = `${BASE_URL}/api/socialos/callback/linkedin`;

  const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokenData = (await tokenResp.json()) as TokenResponse;
  if (!tokenResp.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? 'LinkedIn token exchange failed');
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 5184000) * 1000);

  // Get profile
  const profileResp = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = (await profileResp.json()) as { id?: string; localizedFirstName?: string; localizedLastName?: string };

  const name = [profile.localizedFirstName, profile.localizedLastName].filter(Boolean).join(' ') || 'LinkedIn Account';

  await upsertConnection({
    workspaceId,
    platform: 'linkedin',
    accountName: name,
    accessToken: tokenData.access_token,
    tokenExpiresAt: expiresAt,
    externalAccountId: profile.id,
    scopes: 'r_liteprofile,r_emailaddress,w_member_social',
  });
}

// ---- YouTube/Google ----
async function handleYouTubeCallback(code: string, workspaceId: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');

  const redirectUri = `${BASE_URL}/api/socialos/callback/youtube`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = (await tokenResp.json()) as TokenResponse;
  if (!tokenResp.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? 'YouTube token exchange failed');
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

  // Get channel info
  const channelResp = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  const channelData = (await channelResp.json()) as { items?: Array<{ id: string; snippet: { title: string; thumbnails?: { default?: { url: string } } } }>; error?: { message: string } };
  const channel = channelData.items?.[0];

  await upsertConnection({
    workspaceId,
    platform: 'youtube',
    accountName: channel?.snippet.title ?? 'YouTube Channel',
    avatarUrl: channel?.snippet.thumbnails?.default?.url,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenExpiresAt: expiresAt,
    externalAccountId: channel?.id,
    scopes: 'youtube.readonly,yt-analytics.readonly',
  });
}

// ---- Upsert helper ----
async function upsertConnection(params: {
  workspaceId: string;
  platform: string;
  accountName: string;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date;
  externalAccountId?: string | null;
  scopes?: string | null;
}) {
  const existing = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, params.workspaceId),
        eq(platformConnections.platform, params.platform)
      )
    );

  const values = {
    workspaceId: params.workspaceId,
    platform: params.platform,
    accountName: params.accountName,
    avatarUrl: params.avatarUrl ?? null,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken ?? null,
    tokenExpiresAt: params.tokenExpiresAt ?? null,
    externalAccountId: params.externalAccountId ?? null,
    scopes: params.scopes ?? null,
    isActive: true,
    errorMessage: null,
    connectedAt: new Date(),
    lastSyncAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(platformConnections).set(values).where(eq(platformConnections.id, existing[0].id));
  } else {
    await db.insert(platformConnections).values(values);
  }
}

// ---- Route handler ----
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const redirectBase = `${BASE_URL}/socialos/settings`;

  if (error) {
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?error=missing_params`);
  }

  // Verify state — the platform in state should match 'meta', 'tiktok', 'linkedin', 'youtube'
  // For 'meta' callback, state platform might be 'facebook' or 'instagram'
  const verified = await verifyState(state);
  if (!verified) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_state`);
  }

  const { workspaceId } = verified;

  try {
    switch (platform) {
      case 'meta':
        await handleMetaCallback(code, workspaceId);
        break;
      case 'tiktok':
        await handleTikTokCallback(code, workspaceId);
        break;
      case 'linkedin':
        await handleLinkedInCallback(code, workspaceId);
        break;
      case 'youtube':
        await handleYouTubeCallback(code, workspaceId);
        break;
      default:
        return NextResponse.redirect(`${redirectBase}?error=unknown_platform`);
    }

    return NextResponse.redirect(`${redirectBase}?connected=true`);
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err);
    const msg = err instanceof Error ? err.message : 'unknown_error';
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(msg)}`);
  }
}
