import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// API Keys table
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),
  label: text("label"),
  createdAt: text("created_at").notNull(), // heeft default in DB
  revokedAt: text("revoked_at"),
});

// Workspaces table (alleen nodig als je die endpoint gebruikt)
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});
