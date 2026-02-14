import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// ✅ API keys table
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),

  // snake_case kolommen in DB
  keyHash: text("key_hash").notNull(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),

  label: text("label"),
  createdAt: text("created_at").notNull(), // DB heeft default, maar notNull is ok
  revokedAt: text("revoked_at"),
});

// ✅ Workspaces (alleen laten staan als je ze echt gebruikt)
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

// ✅ Followups (alleen als je followups ook in deze schema file wil hebben)
export const followups = sqliteTable("followups", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull(),
  nextStep: text("next_step").notNull(),
  dueAt: text("due_at").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});
