import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { workspaces, dailyMetrics, posts } from '@/lib/db/schema';
import { eq, and, gte, lte, or } from 'drizzle-orm';

type PlatformBreakdown = {
  platform: string;
  followers: number;
  reach: number;
  engagementRate: number;
  wowChange: number;
};

type TopPost = {
  id: string;
  platform: string;
  contentType: string;
  caption: string | null;
  postedAt: Date;
  reach: number;
  engagementRate: number;
  discoveryScore: number;
  thumbnailUrl: string | null;
};

type TimeSeriesEntry = {
  date: string;
  reach: number;
  engagements: number;
};

function pctChange(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }
    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid startDate or endDate' }, { status: 400 });
    }

    // Find workspace by slug or id
    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(or(eq(workspaces.slug, workspaceId), eq(workspaces.id, workspaceId)));

    const workspace = workspaceRows[0];
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    // Query dailyMetrics for the period
    const periodMetrics = await db
      .select()
      .from(dailyMetrics)
      .where(
        and(
          eq(dailyMetrics.workspaceId, workspace.id),
          gte(dailyMetrics.date, startDate),
          lte(dailyMetrics.date, endDate)
        )
      );

    // Query posts for the period
    const periodPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, workspace.id),
          gte(posts.postedAt, startDate),
          lte(posts.postedAt, endDate)
        )
      );

    // --- Summary ---
    const totalReach = periodMetrics.reduce((sum, m) => sum + m.reach, 0);
    const totalEngagements = periodMetrics.reduce((sum, m) => sum + m.engagements, 0);
    const avgEngagementRate = totalReach > 0 ? totalEngagements / totalReach : 0;

    // followerGrowth: followers at end minus followers at start across all connections
    // "Start" = earliest-dated entry per platform, "End" = latest-dated entry per platform
    const sortedAsc = [...periodMetrics].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const sortedDesc = [...periodMetrics].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const startFollowerByPlatform = new Map<string, number>();
    for (const m of sortedAsc) {
      if (!startFollowerByPlatform.has(m.platform)) {
        startFollowerByPlatform.set(m.platform, m.followers);
      }
    }
    const endFollowerByPlatform = new Map<string, number>();
    for (const m of sortedDesc) {
      if (!endFollowerByPlatform.has(m.platform)) {
        endFollowerByPlatform.set(m.platform, m.followers);
      }
    }

    let followerGrowth = 0;
    for (const platform of endFollowerByPlatform.keys()) {
      const endFollowers = endFollowerByPlatform.get(platform) ?? 0;
      const startFollowers = startFollowerByPlatform.get(platform) ?? 0;
      followerGrowth += endFollowers - startFollowers;
    }

    // --- Platform breakdown ---
    const platforms = Array.from(new Set(periodMetrics.map((m) => m.platform)));

    // For wowChange, use last 7 days of the period vs the 7 days before that
    const wow7End = new Date(endDate);
    const wow7Start = new Date(endDate);
    wow7Start.setDate(wow7Start.getDate() - 7);
    wow7Start.setHours(0, 0, 0, 0);

    const wow14Start = new Date(wow7Start);
    wow14Start.setDate(wow14Start.getDate() - 7);
    wow14Start.setHours(0, 0, 0, 0);

    const platformBreakdown: PlatformBreakdown[] = platforms.map((platform) => {
      const platformMetrics = periodMetrics.filter((m) => m.platform === platform);

      // Latest followers
      const sortedPlatformDesc = [...platformMetrics].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const followers = sortedPlatformDesc[0]?.followers ?? 0;

      const platformReach = platformMetrics.reduce((sum, m) => sum + m.reach, 0);
      const platformEngagements = platformMetrics.reduce((sum, m) => sum + m.engagements, 0);
      const engagementRate = platformReach > 0 ? platformEngagements / platformReach : 0;

      // wowChange: last 7 days reach vs prior 7 days reach (within or relative to the period)
      const last7Reach = platformMetrics
        .filter((m) => new Date(m.date) >= wow7Start && new Date(m.date) <= wow7End)
        .reduce((sum, m) => sum + m.reach, 0);
      const prior7Reach = platformMetrics
        .filter((m) => new Date(m.date) >= wow14Start && new Date(m.date) < wow7Start)
        .reduce((sum, m) => sum + m.reach, 0);
      const wowChange = pctChange(last7Reach, prior7Reach);

      return {
        platform,
        followers,
        reach: platformReach,
        engagementRate,
        wowChange,
      };
    });

    // --- Top posts: top 5 by engagementRate ---
    const topPosts: TopPost[] = [...periodPosts]
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        platform: p.platform,
        contentType: p.contentType,
        caption: p.caption,
        postedAt: p.postedAt,
        reach: p.reach,
        engagementRate: p.engagementRate,
        discoveryScore: p.discoveryScore,
        thumbnailUrl: p.thumbnailUrl,
      }));

    // --- Time series: group by date, sum reach and engagements ---
    const dateMap = new Map<string, { reach: number; engagements: number }>();

    for (const m of periodMetrics) {
      const dateKey = new Date(m.date).toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { reach: 0, engagements: 0 });
      }
      const entry = dateMap.get(dateKey)!;
      entry.reach += m.reach;
      entry.engagements += m.engagements;
    }

    const timeSeries: TimeSeriesEntry[] = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));

    return NextResponse.json({
      workspace: { name: workspace.name, slug: workspace.slug },
      period: { startDate: startDateParam, endDate: endDateParam },
      summary: {
        totalReach,
        totalEngagements,
        avgEngagementRate,
        followerGrowth,
      },
      platformBreakdown,
      topPosts,
      timeSeries,
    });
  } catch (error) {
    console.error('Report route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
