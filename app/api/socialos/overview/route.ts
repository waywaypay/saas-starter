import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { workspaces, dailyMetrics } from '@/lib/db/schema';
import { eq, and, gte, lt, or } from 'drizzle-orm';

type PerPlatform = {
  platform: string;
  followers: number;
  engagementRate: number;
  reach: number;
  wowChange: number;
};

type TimeSeriesEntry = {
  date: string;
  reach: number;
  engagements: number;
  instagram: number;
  tiktok: number;
  linkedin: number;
  facebook: number;
  youtube: number;
};

function pctChange(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const daysParam = searchParams.get('days');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const days = daysParam === '7' ? 7 : daysParam === '90' ? 90 : 30;

    // Find workspace by slug or id
    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(or(eq(workspaces.slug, workspaceId), eq(workspaces.id, workspaceId)));

    const workspace = workspaceRows[0];
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const priorStartDate = new Date(now);
    priorStartDate.setDate(priorStartDate.getDate() - days * 2);
    priorStartDate.setHours(0, 0, 0, 0);

    // Query current period metrics
    const currentMetrics = await db
      .select()
      .from(dailyMetrics)
      .where(
        and(
          eq(dailyMetrics.workspaceId, workspace.id),
          gte(dailyMetrics.date, startDate)
        )
      );

    // Query prior period metrics
    const priorMetrics = await db
      .select()
      .from(dailyMetrics)
      .where(
        and(
          eq(dailyMetrics.workspaceId, workspace.id),
          gte(dailyMetrics.date, priorStartDate),
          lt(dailyMetrics.date, startDate)
        )
      );

    // --- Totals for current period ---
    const totalReach = currentMetrics.reduce((sum, m) => sum + m.reach, 0);
    const totalImpressions = currentMetrics.reduce((sum, m) => sum + m.impressions, 0);
    const totalEngagements = currentMetrics.reduce((sum, m) => sum + m.engagements, 0);
    const avgEngagementRate = totalReach > 0 ? totalEngagements / totalReach : 0;

    // Latest followers per platform (take max date entry per platform)
    const latestFollowerByPlatform = new Map<string, number>();
    for (const m of currentMetrics) {
      const existing = latestFollowerByPlatform.get(m.platform);
      if (existing === undefined) {
        latestFollowerByPlatform.set(m.platform, m.followers);
      } else {
        // Keep the entry from the most recent date by tracking both date and followers
        // We'll re-derive this below with sorted data
        latestFollowerByPlatform.set(m.platform, existing);
      }
    }

    // Re-derive latest followers properly by sorting
    const sortedCurrent = [...currentMetrics].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latestFollowerMapCurrent = new Map<string, number>();
    for (const m of sortedCurrent) {
      if (!latestFollowerMapCurrent.has(m.platform)) {
        latestFollowerMapCurrent.set(m.platform, m.followers);
      }
    }
    const followerTotal = Array.from(latestFollowerMapCurrent.values()).reduce(
      (sum, f) => sum + f,
      0
    );

    // --- Totals for prior period ---
    const priorTotalReach = priorMetrics.reduce((sum, m) => sum + m.reach, 0);
    const priorTotalEngagements = priorMetrics.reduce((sum, m) => sum + m.engagements, 0);
    const priorAvgEngagementRate =
      priorTotalReach > 0 ? priorTotalEngagements / priorTotalReach : 0;

    const sortedPrior = [...priorMetrics].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latestFollowerMapPrior = new Map<string, number>();
    for (const m of sortedPrior) {
      if (!latestFollowerMapPrior.has(m.platform)) {
        latestFollowerMapPrior.set(m.platform, m.followers);
      }
    }
    const priorFollowerTotal = Array.from(latestFollowerMapPrior.values()).reduce(
      (sum, f) => sum + f,
      0
    );

    const followerGrowthPct = pctChange(followerTotal, priorFollowerTotal);
    const reachChangePct = pctChange(totalReach, priorTotalReach);
    const engagementsChangePct = pctChange(totalEngagements, priorTotalEngagements);
    const engRateChangePct = pctChange(avgEngagementRate, priorAvgEngagementRate);

    // --- Per platform ---
    const platforms = Array.from(new Set(currentMetrics.map((m) => m.platform)));

    // For wowChange: last 7 days reach vs prior 7 days reach
    const wow7Start = new Date(now);
    wow7Start.setDate(wow7Start.getDate() - 7);
    wow7Start.setHours(0, 0, 0, 0);

    const wow14Start = new Date(now);
    wow14Start.setDate(wow14Start.getDate() - 14);
    wow14Start.setHours(0, 0, 0, 0);

    const perPlatform: PerPlatform[] = platforms.map((platform) => {
      const platformMetrics = currentMetrics.filter((m) => m.platform === platform);

      const sortedPlatformMetrics = [...platformMetrics].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const followers = sortedPlatformMetrics[0]?.followers ?? 0;

      const platformReach = platformMetrics.reduce((sum, m) => sum + m.reach, 0);
      const platformEngagements = platformMetrics.reduce((sum, m) => sum + m.engagements, 0);
      const engagementRate = platformReach > 0 ? platformEngagements / platformReach : 0;

      // WoW: last 7 days vs prior 7 days within the full currentMetrics window
      // Use all available metrics (not filtered to current period) for WoW calculation
      const allPlatformMetrics = [...currentMetrics, ...priorMetrics].filter(
        (m) => m.platform === platform
      );
      const last7Reach = allPlatformMetrics
        .filter((m) => new Date(m.date) >= wow7Start)
        .reduce((sum, m) => sum + m.reach, 0);
      const prior7Reach = allPlatformMetrics
        .filter((m) => new Date(m.date) >= wow14Start && new Date(m.date) < wow7Start)
        .reduce((sum, m) => sum + m.reach, 0);
      const wowChange = pctChange(last7Reach, prior7Reach);

      return {
        platform,
        followers,
        engagementRate,
        reach: platformReach,
        wowChange,
      };
    });

    // --- Time series: group by date, sum reach and engagements, break out by platform ---
    const knownPlatforms = ['instagram', 'tiktok', 'linkedin', 'facebook', 'youtube'];
    const dateMap = new Map<
      string,
      {
        reach: number;
        engagements: number;
        instagram: number;
        tiktok: number;
        linkedin: number;
        facebook: number;
        youtube: number;
      }
    >();

    for (const m of currentMetrics) {
      const dateKey = new Date(m.date).toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          reach: 0,
          engagements: 0,
          instagram: 0,
          tiktok: 0,
          linkedin: 0,
          facebook: 0,
          youtube: 0,
        });
      }
      const entry = dateMap.get(dateKey)!;
      entry.reach += m.reach;
      entry.engagements += m.engagements;
      const pl = m.platform.toLowerCase();
      if (knownPlatforms.includes(pl)) {
        (entry as Record<string, number>)[pl] += m.reach;
      }
    }

    const timeSeries: TimeSeriesEntry[] = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));

    return NextResponse.json({
      totalReach,
      totalImpressions,
      totalEngagements,
      avgEngagementRate,
      followerTotal,
      followerGrowthPct,
      reachChangePct,
      engagementsChangePct,
      engRateChangePct,
      perPlatform,
      timeSeries,
    });
  } catch (error) {
    console.error('Overview route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
