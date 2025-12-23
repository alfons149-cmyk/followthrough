import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
  size: text("size"),
  website: text("website"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  companyId: text("company_id").notNull(),
  fullName: text("full_name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const followups = sqliteTable(
  "followups",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    contactId: text("contact_id").notNull(),
    companyId: text("company_id").notNull(),
    ownerId: text("owner_id").notNull(),

    title: text("title").notNull(),
    summary: text("summary"),

    status: text("status").notNull(),
    dueAt: text("due_at").notNull(),

    lastTouchAt: text("last_touch_at"),
    lastTouchChannel: text("last_touch_channel"),

    nextStep: text("next_step").notNull(),
    segment: text("segment"),

    dealLabel: text("deal_label"),
    dealValueEur: integer("deal_value_eur"),
    isKeyAccount: integer("is_key_account").notNull(),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byWorkspaceDue: index("idx_followups_workspace_due").on(t.workspaceId, t.dueAt),
    byWorkspaceStatus: index("idx_followups_workspace_status").on(t.workspaceId, t.status),
    byOwner: index("idx_followups_owner").on(t.workspaceId, t.ownerId),
  })
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    followupId: text("followup_id").notNull(),

    occurredAt: text("occurred_at").notNull(),
    type: text("type").notNull(),
    channel: text("channel"),
    title: text("title").notNull(),
    detail: text("detail"),
    metaJson: text("meta_json"),

    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byFollowup: index("idx_events_followup").on(
      t.workspaceId,
      t.followupId,
      t.occurredAt
    ),
  })
);

// --- workspaces ---
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),

  // Matches: TEXT NOT NULL DEFAULT (datetime('now'))
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;

// --- users ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),

  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),

  email: text("email").notNull(),
  displayName: text("display_name").notNull(),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// --- followups ---
export const followups = sqliteTable(
  "followups",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    contactName: text("contact_name").notNull(),
    companyName: text("company_name").notNull(),
    nextStep: text("next_step").notNull(),

    // Stored as TEXT in your SQL migration (e.g. ISO string)
    dueAt: text("due_at").notNull(),

    // Keep as TEXT to match migration; you can enforce allowed values in app code
    status: text("status").notNull(),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    idxFollowupsDue: index("idx_followups_due").on(t.workspaceId, t.dueAt),
    idxFollowupsStatus: index("idx_followups_status").on(
      t.workspaceId,
      t.status
    ),
  })
);

export type Followup = InferSelectModel<typeof followups>;
export type NewFollowup = InferInsertModel<typeof followups>;
