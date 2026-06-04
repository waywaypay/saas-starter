export type Recommendation = {
  priority: "high" | "medium" | "low";
  platform: string;
  title: string;
  insight: string;
  action: string;
};

export function generateRecommendations(data: {
  avgDiscoveryScore: number;
  formatBreakdown: Array<{
    contentType: string;
    avgDiscoveryScore: number;
    postCount: number;
    totalPosts: number;
  }>;
  timeBuckets: Array<{
    bucket: string;
    avgDiscoveryScore: number;
    postCount: number;
  }>;
  captionPatterns: Array<{
    pattern: string;
    avgDiscoveryScore: number;
    liftVsBaseline: number;
    postCount: number;
  }>;
  platformInsights: Array<{
    platform: string;
    avgDiscoveryScore: number;
    bestContentType: string;
    bestTimeWindow: string;
    weeklyVelocityTrend: number;
  }>;
}): Recommendation[] {
  const recs: Recommendation[] = [];
  const avg = data.avgDiscoveryScore;

  for (const format of data.formatBreakdown) {
    const shareOfPosts = format.postCount / format.totalPosts;
    if (format.avgDiscoveryScore > 1.5 && shareOfPosts < 0.3) {
      recs.push({
        priority: "high",
        platform: "all",
        title: `Post more ${format.contentType}s`,
        insight: `${format.contentType} posts have an avg discovery score of ${format.avgDiscoveryScore.toFixed(2)}x but make up only ${Math.round(shareOfPosts * 100)}% of your content.`,
        action: `→ Increase ${format.contentType} frequency to at least 40% of your posting mix.`,
      });
    }
    if (format.avgDiscoveryScore < avg * 0.6 && shareOfPosts > 0.3) {
      recs.push({
        priority: "medium",
        platform: "all",
        title: `Reduce ${format.contentType} volume`,
        insight: `${format.contentType} posts have a ${format.avgDiscoveryScore.toFixed(2)}x discovery score — ${Math.round((1 - format.avgDiscoveryScore / avg) * 100)}% below your average.`,
        action: `→ Use ${format.contentType} for engagement retention, not discovery.`,
      });
    }
  }

  const sortedBuckets = [...data.timeBuckets].sort(
    (a, b) => b.avgDiscoveryScore - a.avgDiscoveryScore
  );
  const bestBucket = sortedBuckets[0];
  const worstBucket = sortedBuckets[sortedBuckets.length - 1];
  if (
    bestBucket &&
    worstBucket &&
    bestBucket.avgDiscoveryScore > avg * 1.2 &&
    bestBucket.postCount >= 3
  ) {
    recs.push({
      priority: "medium",
      platform: "all",
      title: `Post more in the ${bestBucket.bucket} window`,
      insight: `Posts published ${bestBucket.bucket} average a ${bestBucket.avgDiscoveryScore.toFixed(2)}x discovery score — ${Math.round((bestBucket.avgDiscoveryScore / avg - 1) * 100)}% above your overall average.`,
      action: `→ Shift at least 50% of your posts to the ${bestBucket.bucket} time window.`,
    });
  }
  if (
    worstBucket &&
    worstBucket.avgDiscoveryScore < avg * 0.7 &&
    worstBucket.postCount >= 3
  ) {
    recs.push({
      priority: "low",
      platform: "all",
      title: `Avoid posting in the ${worstBucket.bucket} window`,
      insight: `Posts at ${worstBucket.bucket} average only ${worstBucket.avgDiscoveryScore.toFixed(2)}x discovery — your lowest performing time slot.`,
      action: `→ Move any scheduled posts from this window to ${bestBucket?.bucket ?? "a higher-performing slot"}.`,
    });
  }

  for (const pattern of data.captionPatterns) {
    if (pattern.liftVsBaseline > 0.15 && pattern.postCount >= 5) {
      recs.push({
        priority: "medium",
        platform: "all",
        title: `Use "${pattern.pattern}" in more captions`,
        insight: `Captions with "${pattern.pattern}" get ${Math.round(pattern.liftVsBaseline * 100)}% higher discovery scores than your baseline.`,
        action: `→ Apply this pattern to all future captions where it fits naturally.`,
      });
    }
  }

  for (const platform of data.platformInsights) {
    if (platform.weeklyVelocityTrend < -0.1) {
      recs.push({
        priority: "high",
        platform: platform.platform,
        title: `${getPlatformLabelSimple(platform.platform)} discovery is declining`,
        insight: `Your discovery score on ${getPlatformLabelSimple(platform.platform)} has dropped ${Math.abs(Math.round(platform.weeklyVelocityTrend * 100))}% over the last 4 weeks.`,
        action: `→ Review posting cadence and switch to ${platform.bestContentType} format which performs best on this platform.`,
      });
    }
    if (platform.avgDiscoveryScore < 0.5) {
      recs.push({
        priority: "low",
        platform: platform.platform,
        title: `${getPlatformLabelSimple(platform.platform)} reach is mostly follower-bound`,
        insight: `Your avg discovery score on ${getPlatformLabelSimple(platform.platform)} is ${platform.avgDiscoveryScore.toFixed(2)}x — content rarely reaches beyond your existing audience.`,
        action: `→ Consider boosting top-performing posts on ${getPlatformLabelSimple(platform.platform)} to accelerate discovery.`,
      });
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recs
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 8);
}

function getPlatformLabelSimple(platform: string): string {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    youtube: "YouTube",
  };
  return labels[platform] ?? platform;
}
