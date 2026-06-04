import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { workspaces, posts } from '@/lib/db/schema';
import { eq, and, inArray, desc, or, SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const platformParam = searchParams.get('platform');
    const contentTypeParam = searchParams.get('contentType');
    const sortBy = searchParams.get('sortBy') ?? 'postedAt';
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Find workspace by slug or id
    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(or(eq(workspaces.slug, workspaceId), eq(workspaces.id, workspaceId)));

    const workspace = workspaceRows[0];
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    // Build where conditions
    const conditions: SQL[] = [eq(posts.workspaceId, workspace.id)];

    if (platformParam) {
      const platforms = platformParam.split(',').map((p) => p.trim()).filter(Boolean);
      if (platforms.length === 1) {
        conditions.push(eq(posts.platform, platforms[0]));
      } else if (platforms.length > 1) {
        conditions.push(inArray(posts.platform, platforms));
      }
    }

    if (contentTypeParam) {
      const contentTypes = contentTypeParam.split(',').map((c) => c.trim()).filter(Boolean);
      if (contentTypes.length === 1) {
        conditions.push(eq(posts.contentType, contentTypes[0]));
      } else if (contentTypes.length > 1) {
        conditions.push(inArray(posts.contentType, contentTypes));
      }
    }

    const whereClause = and(...conditions);

    // Determine sort column
    let orderByCol;
    if (sortBy === 'engagementRate') {
      orderByCol = desc(posts.engagementRate);
    } else if (sortBy === 'reach') {
      orderByCol = desc(posts.reach);
    } else if (sortBy === 'discoveryScore') {
      orderByCol = desc(posts.discoveryScore);
    } else {
      // postedAt (default) — newest first
      orderByCol = desc(posts.postedAt);
    }

    // Query posts with pagination
    const postRows = await db
      .select()
      .from(posts)
      .where(whereClause)
      .orderBy(orderByCol)
      .limit(limit)
      .offset(offset);

    // Query total count
    const allRows = await db
      .select({ id: posts.id })
      .from(posts)
      .where(whereClause);

    const total = allRows.length;

    return NextResponse.json({
      posts: postRows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Posts route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
