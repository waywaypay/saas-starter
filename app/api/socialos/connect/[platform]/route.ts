import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { workspaces, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { getOAuthUrl } from '@/lib/socialos/oauth';

const VALID_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform } = await params;
    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Verify workspace belongs to current user's team
    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    const workspace = workspaceRows[0];
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const memberRows = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, workspace.teamId),
          eq(teamMembers.userId, session.user.id)
        )
      );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const oauthUrl = await getOAuthUrl(platform, workspaceId);
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error('Connect route error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
