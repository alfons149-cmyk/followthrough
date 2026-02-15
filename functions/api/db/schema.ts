import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/* ================================
   FOLLOWUPS TABLE (CORE APP)
================================ */
export const followups = sqliteTable("followups", {
  id: text("id").primaryKey(),

  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),

  contactName: text("contact_name"),
  companyName: text("company_name"),
  nextStep: text("next_step"),

  dueAt: text("due_at"),
  status: text("status").notNull().default("open"),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/* ================================
   API KEYS
================================ */
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),

  label: text("label"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  revokedAt: text("revoked_at"),
});

/* ================================
   WORKSPACES
================================ */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
