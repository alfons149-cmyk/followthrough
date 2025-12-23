// src/db/schema.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";


/**
 * WORKSPACES
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * USERS
 */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    workspaceIdx: index("users_workspace_idx").on(t.workspaceId),
  })
);

/**
 * FOLLOWUPS (example — keep only if you actually have this table)
 */
export const followups = sqliteTable(
  "followups",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    dueAt: integer("due_at").notNull(), // choose integer or text; match your migration!
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    workspaceDueIdx: index("followups_workspace_due_idx").on(t.workspaceId, t.dueAt),
    workspaceStatusIdx: index("followups_workspace_status_idx").on(t.workspaceId, t.status),
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
