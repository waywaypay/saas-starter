import {
  pgTable,
  pgEnum,
  text,
  integer,
  doublePrecision,
  timestamp,
  date,
  boolean,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* -------------------------------------------------------------------------- */
/* Enums + named constants (no magic strings scattered through the codebase)  */
/* -------------------------------------------------------------------------- */

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "linkedin",
  "facebook",
  "youtube",
] as const;
export type Platform = (typeof PLATFORMS)[number];
export const platformEnum = pgEnum("platform", PLATFORMS);

export const TEAM_ROLES = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);

export const CONTENT_TYPES = [
  "image",
  "video",
  "carousel",
  "reel",
  "story",
  "short",
  "text",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Auth.js (Drizzle adapter) tables — text ids per the adapter's contract.     */
/* Sessions table exists for adapter compatibility but is UNUSED at runtime:   */
/* Credentials auth forces the JWT session strategy (see lib/auth).            */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // Domain extensions (nullable / defaulted so the adapter's inserts still work)
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* -------------------------------------------------------------------------- */
/* Tenancy: User -> Team -> Workspace -> Connection                            */
/* -------------------------------------------------------------------------- */

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  planName: text("plan_name").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (tm) => [
    uniqueIndex("team_members_user_team_unq").on(tm.userId, tm.teamId),
    index("team_members_team_idx").on(tm.teamId),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (ws) => [uniqueIndex("workspaces_team_slug_unq").on(ws.teamId, ws.slug)],
);

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    accountName: text("account_name").notNull(),
    avatarUrl: text("avatar_url"),
    // Encrypted at rest; nullable because the mock provider holds no token.
    accessToken: text("access_token"),
    isActive: boolean("is_active").notNull().default(true),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    lastSyncAt: timestamp("last_sync_at"),
  },
  (pc) => [index("platform_connections_workspace_idx").on(pc.workspaceId)],
);

/* -------------------------------------------------------------------------- */
/* Metrics + posts — every write is an UPSERT on the unique key (idempotent).  */
/* -------------------------------------------------------------------------- */

export const dailyMetrics = pgTable(
  "daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => platformConnections.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    followers: integer("followers").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    engagements: integer("engagements").notNull().default(0),
    profileViews: integer("profile_views").notNull().default(0),
  },
  (dm) => [
    uniqueIndex("daily_metrics_connection_date_unq").on(
      dm.connectionId,
      dm.date,
    ),
    index("daily_metrics_workspace_date_idx").on(dm.workspaceId, dm.date),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => platformConnections.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    caption: text("caption"),
    contentType: text("content_type").$type<ContentType>().notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    reach: integer("reach").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    linkClicks: integer("link_clicks").notNull().default(0),
    engagementRate: doublePrecision("engagement_rate").notNull().default(0),
    thumbnailUrl: text("thumbnail_url"),
    followerCountAtPostTime: integer("follower_count_at_post_time")
      .notNull()
      .default(0),
    discoveryScore: doublePrecision("discovery_score").notNull().default(0),
  },
  (p) => [
    uniqueIndex("posts_connection_external_unq").on(p.connectionId, p.externalId),
    index("posts_workspace_posted_idx").on(p.workspaceId, p.postedAt),
  ],
);

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Inferred row types (single source of truth for select/insert shapes)        */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type PlatformConnection = typeof platformConnections.$inferSelect;
export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type NewDailyMetric = typeof dailyMetrics.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
