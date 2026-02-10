import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// Followups table
export const followups = sqliteTable("followups", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull(),
  nextStep: text("next_step").notNull(),
  dueAt: text("due_at").notNull(),     // "YYYY-MM-DD"
  status: text("status").notNull(),    // open/sent/waiting/followup/done
  createdAt: text("created_at").notNull(), // "YYYY-MM-DD HH:MM:SS"
});

// Workspaces table (als je die endpoint gebruikt)
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

// API Keys table
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),
  label: text("label"),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});
