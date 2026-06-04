/**
 * OAuth helpers for SocialOS platform connections.
 * Generates and verifies HMAC-signed state params for CSRF protection,
 * and returns platform-specific authorization URLs.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

/** Encode bytes to base64url */
function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode base64url to bytes */
function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET environment variable is not set');
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Generate a signed state param for OAuth CSRF protection.
 * Format: base64url(JSON({platform, workspaceId, ts})) + '.' + base64url(hmac)
 */
export async function generateState(platform: string, workspaceId: string): Promise<string> {
  const payload = JSON.stringify({ platform, workspaceId, ts: Date.now() });
  const payloadEncoded = toBase64Url(new TextEncoder().encode(payload));
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadEncoded));
  const sigEncoded = toBase64Url(new Uint8Array(sig));
  return `${payloadEncoded}.${sigEncoded}`;
}

/**
 * Verify state param and extract platform + workspaceId.
 * Returns null if invalid or expired (>10 minutes).
 */
export async function verifyState(
  state: string
): Promise<{ platform: string; workspaceId: string } | null> {
  try {
    const [payloadEncoded, sigEncoded] = state.split('.');
    if (!payloadEncoded || !sigEncoded) return null;

    const key = await getHmacKey();
    const sigBytes = fromBase64Url(sigEncoded);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadEncoded)
    );
    if (!valid) return null;

    const payloadStr = new TextDecoder().decode(fromBase64Url(payloadEncoded));
    const parsed = JSON.parse(payloadStr) as { platform: string; workspaceId: string; ts: number };

    // Reject states older than 10 minutes
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;

    return { platform: parsed.platform, workspaceId: parsed.workspaceId };
  } catch {
    return null;
  }
}

/**
 * Return the OAuth authorization URL for the given platform.
 */
export async function getOAuthUrl(platform: string, workspaceId: string): Promise<string> {
  const state = await generateState(platform, workspaceId);

  switch (platform) {
    case 'instagram':
    case 'facebook': {
      const appId = process.env.META_APP_ID;
      if (!appId) throw new Error('META_APP_ID is not set');
      const redirectUri = encodeURIComponent(`${BASE_URL}/api/socialos/callback/meta`);
      return (
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${appId}` +
        `&redirect_uri=${redirectUri}` +
        `&scope=pages_show_list,instagram_basic,instagram_manage_insights,pages_read_engagement` +
        `&state=${encodeURIComponent(state)}` +
        `&response_type=code`
      );
    }

    case 'tiktok': {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) throw new Error('TIKTOK_CLIENT_KEY is not set');
      const redirectUri = encodeURIComponent(`${BASE_URL}/api/socialos/callback/tiktok`);
      return (
        `https://www.tiktok.com/v2/auth/authorize/` +
        `?client_key=${clientKey}` +
        `&redirect_uri=${redirectUri}` +
        `&scope=user.info.basic,video.list` +
        `&state=${encodeURIComponent(state)}` +
        `&response_type=code`
      );
    }

    case 'linkedin': {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) throw new Error('LINKEDIN_CLIENT_ID is not set');
      const redirectUri = encodeURIComponent(`${BASE_URL}/api/socialos/callback/linkedin`);
      return (
        `https://www.linkedin.com/oauth/v2/authorization` +
        `?response_type=code` +
        `&client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&scope=r_liteprofile%20r_emailaddress%20w_member_social%20rw_organization_admin%20r_organization_social` +
        `&state=${encodeURIComponent(state)}`
      );
    }

    case 'youtube': {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
      const redirectUri = encodeURIComponent(`${BASE_URL}/api/socialos/callback/youtube`);
      return (
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/yt-analytics.readonly` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(state)}` +
        `&response_type=code`
      );
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
