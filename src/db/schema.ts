// src/db/schema.ts
import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * WORKSPACES (matches 0001_init.sql)
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`) // DB default: datetime('now')
  import { sql } from "drizzle-orm";
});

/**
 * USERS (matches 0001_init.sql)
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(), // DB default: datetime('now')
});

/**
 * FOLLOWUPS (matches 0001_init.sql)
 */
export const followups = sqliteTable(
  "followups",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ownerId: text("owner_id").notNull(),
    contactName: text("contact_name").notNull(),
    companyName: text("company_name").notNull(),
    nextStep: text("next_step").notNull(),
    dueAt: text("due_at").notNull(), // TEXT in migration
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(), // DB default: datetime('now')
  },
  (t) => ({
    idxFollowupsDue: index("idx_followups_due").on(t.workspaceId, t.dueAt),
    idxFollowupsStatus: index("idx_followups_status").on(t.workspaceId, t.status),
  })
);

/**
 * TYPES
 */
export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Followup = InferSelectModel<typeof followups>;
export type NewFollowup = InferInsertModel<typeof followups>;
