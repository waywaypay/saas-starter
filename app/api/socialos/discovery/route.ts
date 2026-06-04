import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { workspaces, posts } from '@/lib/db/schema';
import { eq, and, gte, or } from 'drizzle-orm';
import { generateRecommendations } from '@/lib/socialos/recommendations';
import type { Post } from '@/lib/db/schema';

function hasEmoji(text: string): boolean {
  return /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/u.test(text);
}

type TimeBucket = {
  label: string;
  hours: number[];
};

const TIME_BUCKETS: TimeBucket[] = [
  { label: '6–9am',    hours: [6, 7, 8] },
  { label: '9am–12pm', hours: [9, 10, 11] },
  { label: '12–3pm',   hours: [12, 13, 14] },
  { label: '3–6pm',    hours: [15, 16, 17] },
  { label: '6–9pm',    hours: [18, 19, 20] },
  { label: '9pm–12am', hours: [21, 22, 23] },
];

function getBucket(date: Date): string {
  const hour = date.getHours();
  for (const bucket of TIME_BUCKETS) {
    if (bucket.hours.includes(hour)) return bucket.label;
  }
  return 'Other';
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const daysParam = searchParams.get('days');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const days =
      daysParam === '60' ? 60 : daysParam === '90' ? 90 : 30;

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
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const priorStartDate = new Date(now);
    priorStartDate.setDate(priorStartDate.getDate() - days * 2);
    priorStartDate.setHours(0, 0, 0, 0);

    // Get all posts for the period
    const currentPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, workspace.id),
          gte(posts.postedAt, startDate)
        )
      );

    // Get prior period posts for discoveryTrend
    const priorPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, workspace.id),
          gte(posts.postedAt, priorStartDate),
          // drizzle lt needs the imported lt — we use a manual filter instead
        )
      );

    // Filter prior to exclude current period
    const priorOnlyPosts = priorPosts.filter(
      (p) => new Date(p.postedAt) < startDate
    );

    // 1. avgDiscoveryScore
    const avgDiscoveryScore = avg(currentPosts.map((p) => p.discoveryScore));

    // 2. discoveryTrend
    const priorAvgDiscovery = avg(priorOnlyPosts.map((p) => p.discoveryScore));
    const discoveryTrend =
      priorAvgDiscovery === 0
        ? 0
        : safeDiv(avgDiscoveryScore - priorAvgDiscovery, priorAvgDiscovery) * 100;

    // 3. postsAbove1x
    const postsAbove1x = currentPosts.filter((p) => p.discoveryScore >= 1.0).length;

    // 4. topDiscoveryPlatform
    const platformDiscoveryMap = new Map<string, number[]>();
    for (const p of currentPosts) {
      if (!platformDiscoveryMap.has(p.platform)) {
        platformDiscoveryMap.set(p.platform, []);
      }
      platformDiscoveryMap.get(p.platform)!.push(p.discoveryScore);
    }
    let topDiscoveryPlatform = '';
    let topDiscoveryPlatformScore = -1;
    for (const [platform, scores] of platformDiscoveryMap.entries()) {
      const a = avg(scores);
      if (a > topDiscoveryPlatformScore) {
        topDiscoveryPlatformScore = a;
        topDiscoveryPlatform = platform;
      }
    }

    // 5. formatBreakdown
    const totalPosts = currentPosts.length;
    const contentTypeMap = new Map<string, Post[]>();
    for (const p of currentPosts) {
      if (!contentTypeMap.has(p.contentType)) {
        contentTypeMap.set(p.contentType, []);
      }
      contentTypeMap.get(p.contentType)!.push(p);
    }

    const formatBreakdown = Array.from(contentTypeMap.entries()).map(
      ([contentType, group]) => {
        const avgDs = avg(group.map((p) => p.discoveryScore));
        const avgEr = avg(group.map((p) => p.engagementRate));
        const topPost = group.reduce((best, p) =>
          p.discoveryScore > best.discoveryScore ? p : best
        );
        return {
          contentType,
          avgDiscoveryScore: avgDs,
          avgEngagementRate: avgEr,
          postCount: group.length,
          totalPosts,
          topPost,
        };
      }
    );

    // 6. timeBuckets
    const bucketMap = new Map<
      string,
      { discoveryScores: number[]; engagementRates: number[] }
    >();
    for (const bucket of TIME_BUCKETS) {
      bucketMap.set(bucket.label, { discoveryScores: [], engagementRates: [] });
    }
    for (const p of currentPosts) {
      const bucketLabel = getBucket(new Date(p.postedAt));
      const entry = bucketMap.get(bucketLabel);
      if (entry) {
        entry.discoveryScores.push(p.discoveryScore);
        entry.engagementRates.push(p.engagementRate);
      }
    }

    const timeBuckets = TIME_BUCKETS.map((bucket) => {
      const entry = bucketMap.get(bucket.label)!;
      return {
        bucket: bucket.label,
        avgDiscoveryScore: avg(entry.discoveryScores),
        avgEngagementRate: avg(entry.engagementRates),
        postCount: entry.discoveryScores.length,
      };
    });

    // 7. captionPatterns
    type PatternDef = {
      pattern: string;
      matches: (caption: string) => boolean;
    };
    const patternDefs: PatternDef[] = [
      { pattern: 'Has emoji',          matches: (c) => hasEmoji(c) },
      { pattern: 'Contains question',  matches: (c) => c.includes('?') },
      { pattern: 'Short caption',      matches: (c) => c.length < 50 },
      { pattern: 'Medium caption',     matches: (c) => c.length >= 50 && c.length <= 150 },
      { pattern: 'Long caption',       matches: (c) => c.length > 150 },
      { pattern: 'Has hashtags',       matches: (c) => c.includes('#') },
    ];

    const captionPosts = currentPosts.filter((p) => p.caption !== null && p.caption !== '');

    const captionPatterns = patternDefs.map(({ pattern, matches }) => {
      const matched = captionPosts.filter((p) => matches(p.caption!));
      const patternAvg = avg(matched.map((p) => p.discoveryScore));
      const liftVsBaseline =
        avgDiscoveryScore === 0 ? 0 : safeDiv(patternAvg, avgDiscoveryScore) - 1;
      return {
        pattern,
        avgDiscoveryScore: patternAvg,
        liftVsBaseline,
        postCount: matched.length,
      };
    });

    // 8. platformInsights
    const platformPosts = new Map<string, Post[]>();
    for (const p of currentPosts) {
      if (!platformPosts.has(p.platform)) {
        platformPosts.set(p.platform, []);
      }
      platformPosts.get(p.platform)!.push(p);
    }

    const platformInsights = Array.from(platformPosts.entries()).map(
      ([platform, pPosts]) => {
        const platformAvgDs = avg(pPosts.map((p) => p.discoveryScore));

        // bestContentType
        const ctMap = new Map<string, number[]>();
        for (const p of pPosts) {
          if (!ctMap.has(p.contentType)) ctMap.set(p.contentType, []);
          ctMap.get(p.contentType)!.push(p.discoveryScore);
        }
        let bestContentType = '';
        let bestCtScore = -1;
        for (const [ct, scores] of ctMap.entries()) {
          const a = avg(scores);
          if (a > bestCtScore) { bestCtScore = a; bestContentType = ct; }
        }

        // bestTimeWindow
        const twMap = new Map<string, number[]>();
        for (const p of pPosts) {
          const b = getBucket(new Date(p.postedAt));
          if (!twMap.has(b)) twMap.set(b, []);
          twMap.get(b)!.push(p.discoveryScore);
        }
        let bestTimeWindow = '';
        let bestTwScore = -1;
        for (const [tw, scores] of twMap.entries()) {
          const a = avg(scores);
          if (a > bestTwScore) { bestTwScore = a; bestTimeWindow = tw; }
        }

        // weeklyScores: 4 weekly avg discovery scores, oldest first (weeks 4,3,2,1 ago)
        const weeklyScores: number[] = [];
        for (let weekIdx = 4; weekIdx >= 1; weekIdx--) {
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() - (weekIdx - 1) * 7);
          weekEnd.setHours(23, 59, 59, 999);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() - 7);
          weekStart.setHours(0, 0, 0, 0);

          const weekPosts = pPosts.filter((p) => {
            const postedAt = new Date(p.postedAt);
            return postedAt >= weekStart && postedAt <= weekEnd;
          });
          weeklyScores.push(avg(weekPosts.map((p) => p.discoveryScore)));
        }

        // weeklyVelocityTrend: (w4 avg - w1 avg) / w1 avg
        const w1 = weeklyScores[0] ?? 0; // oldest (4 weeks ago)
        const w4 = weeklyScores[3] ?? 0; // most recent (last week)
        const weeklyVelocityTrend = w1 === 0 ? 0 : safeDiv(w4 - w1, w1);

        return {
          platform,
          avgDiscoveryScore: platformAvgDs,
          bestContentType,
          bestTimeWindow,
          weeklyVelocityTrend,
          weeklyScores,
        };
      }
    );

    // 9. topDiscoveryPosts: top 10 by discoveryScore desc
    const topDiscoveryPosts = [...currentPosts]
      .sort((a, b) => b.discoveryScore - a.discoveryScore)
      .slice(0, 10);

    // 10. recommendations
    const recommendations = generateRecommendations({
      avgDiscoveryScore,
      formatBreakdown: formatBreakdown.map(({ contentType, avgDiscoveryScore: ads, postCount }) => ({
        contentType,
        avgDiscoveryScore: ads,
        postCount,
        totalPosts,
      })),
      timeBuckets,
      captionPatterns,
      platformInsights,
    });

    return NextResponse.json({
      avgDiscoveryScore,
      discoveryTrend,
      postsAbove1x,
      topDiscoveryPlatform,
      formatBreakdown,
      timeBuckets,
      captionPatterns,
      platformInsights,
      topDiscoveryPosts,
      recommendations,
    });
  } catch (error) {
    console.error('Discovery route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
