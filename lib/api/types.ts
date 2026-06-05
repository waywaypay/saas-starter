import type { Platform } from "@/lib/db/schema";

/**
 * Shared API response contracts. These types are the single source of truth for
 * the wire shape and are imported by BOTH the route handlers (server) and the
 * client query hooks, so the two can never drift.
 */

export interface HealthResponse {
  ok: boolean;
  db: "up" | "down";
  ts: string;
}

export type RangeDays = 7 | 30 | 90;
export const RANGE_DAYS: readonly RangeDays[] = [7, 30, 90] as const;

/** /api/overview */
export interface OverviewTotals {
  reach: number;
  impressions: number;
  engagements: number;
  engagementRate: number;
  followers: number;
}

export interface OverviewDeltas {
  reachPct: number | null;
  engagementsPct: number | null;
  engagementRatePct: number | null;
  followersPct: number | null;
}

export interface PerPlatformStat {
  platform: Platform;
  followers: number;
  reach: number;
  engagementRate: number;
  wowChangePct: number | null;
}

export interface TimeSeriesPoint {
  date: string;
  reach: number;
  engagements: number;
  instagram: number;
  tiktok: number;
  linkedin: number;
  facebook: number;
  youtube: number;
}

export interface OverviewResponse {
  totals: OverviewTotals;
  deltas: OverviewDeltas;
  perPlatform: PerPlatformStat[];
  timeSeries: TimeSeriesPoint[];
}

/** /api/posts */
export interface PostRow {
  id: string;
  platform: Platform;
  caption: string | null;
  contentType: string;
  postedAt: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  linkClicks: number;
  engagementRate: number;
  thumbnailUrl: string | null;
  discoveryScore: number;
}

export interface PostsResponse {
  posts: PostRow[];
  topPerformers: PostRow[];
}

/** /api/discovery */
export interface BestTimeSlot {
  dayOfWeek: number; // 0=Sun … 6=Sat
  hour: number; // 0–23
  avgEngagementRate: number;
  sampleSize: number;
}

export interface ContentTypeStat {
  contentType: string;
  avgEngagementRate: number;
  avgReach: number;
  postCount: number;
}

export interface DiscoveryResponse {
  bestTimes: BestTimeSlot[];
  bestDays: { dayOfWeek: number; avgEngagementRate: number; postCount: number }[];
  bestContentTypes: ContentTypeStat[];
}

/** /api/reports */
export interface ReportResponse {
  rangeDays: number;
  generatedAt: string;
  totals: OverviewTotals;
  deltas: OverviewDeltas;
  perPlatform: PerPlatformStat[];
  topPosts: PostRow[];
}

/** POST /api/connections */
export interface ConnectionRow {
  id: string;
  platform: Platform;
  accountName: string;
  avatarUrl: string | null;
  isActive: boolean;
  connectedAt: string;
  lastSyncAt: string | null;
}

export interface ConnectionsResponse {
  connections: ConnectionRow[];
}

/** POST /api/cron/sync */
export interface SyncResponse {
  ok: boolean;
  syncedConnections: number;
  metricsWritten: number;
  postsWritten: number;
  ranAt: string;
}
