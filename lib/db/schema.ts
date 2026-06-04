import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

// SocialOS tables
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  teamId: integer('team_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const platformConnections = pgTable('platform_connections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  platform: varchar('platform', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  lastSyncAt: timestamp('last_sync_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

export const dailyMetrics = pgTable('daily_metrics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => platformConnections.id),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  date: timestamp('date').notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  followers: integer('followers').notNull(),
  impressions: integer('impressions').notNull(),
  reach: integer('reach').notNull(),
  engagements: integer('engagements').notNull(),
  profileViews: integer('profile_views').notNull().default(0),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => platformConnections.id),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  platform: varchar('platform', { length: 50 }).notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  caption: text('caption'),
  contentType: varchar('content_type', { length: 50 }).notNull(),
  postedAt: timestamp('posted_at').notNull(),
  reach: integer('reach').notNull().default(0),
  impressions: integer('impressions').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  saves: integer('saves').notNull().default(0),
  linkClicks: integer('link_clicks').notNull().default(0),
  engagementRate: doublePrecision('engagement_rate').notNull().default(0),
  thumbnailUrl: text('thumbnail_url'),
  followerCountAtPostTime: integer('follower_count_at_post_time').notNull().default(0),
  discoveryScore: doublePrecision('discovery_score').notNull().default(0),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  connections: many(platformConnections),
  dailyMetrics: many(dailyMetrics),
  posts: many(posts),
}));

export const platformConnectionsRelations = relations(platformConnections, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [platformConnections.workspaceId],
    references: [workspaces.id],
  }),
  dailyMetrics: many(dailyMetrics),
  posts: many(posts),
}));

export const dailyMetricsRelations = relations(dailyMetrics, ({ one }) => ({
  connection: one(platformConnections, {
    fields: [dailyMetrics.connectionId],
    references: [platformConnections.id],
  }),
  workspace: one(workspaces, {
    fields: [dailyMetrics.workspaceId],
    references: [workspaces.id],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  connection: one(platformConnections, {
    fields: [posts.connectionId],
    references: [platformConnections.id],
  }),
  workspace: one(workspaces, {
    fields: [posts.workspaceId],
    references: [workspaces.id],
  }),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type PlatformConnection = typeof platformConnections.$inferSelect;
export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type Post = typeof posts.$inferSelect;

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
