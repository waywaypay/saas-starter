import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { platformConnections, workspaces, teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  // Verify workspace belongs to user's team
  const workspaceRows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const workspace = workspaceRows[0];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const memberRows = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, workspace.teamId), eq(teamMembers.userId, session.user.id)));

  if (memberRows.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const connections = await db
    .select({
      id: platformConnections.id,
      platform: platformConnections.platform,
      accountName: platformConnections.accountName,
      avatarUrl: platformConnections.avatarUrl,
      connectedAt: platformConnections.connectedAt,
      lastSyncAt: platformConnections.lastSyncAt,
      isActive: platformConnections.isActive,
      errorMessage: platformConnections.errorMessage,
    })
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, workspaceId));

  return NextResponse.json({ connections });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
  }

  // Find connection and verify ownership
  const connRows = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.id, connectionId));
  const connection = connRows[0];
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const workspaceRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, connection.workspaceId));
  const workspace = workspaceRows[0];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const memberRows = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, workspace.teamId), eq(teamMembers.userId, session.user.id)));

  if (memberRows.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Deactivate and clear tokens
  await db
    .update(platformConnections)
    .set({
      isActive: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    })
    .where(eq(platformConnections.id, connectionId));

  return NextResponse.json({ success: true });
}
