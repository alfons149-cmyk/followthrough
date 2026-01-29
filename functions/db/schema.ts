import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const followups = sqliteTable("followups", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  ownerId: text("owner_id").notNull(),
  contactName: text("contact_name").notNull(),
  companyName: text("company_name").notNull(),
  nextStep: text("next_step").notNull(),
  dueAt: text("due_at").notNull(),     // "YYYY-MM-DD"
  status: text("status").notNull(),    // "open" | "sent" | "waiting" | "followup" | "done"
  createdAt: text("created_at").notNull(),
});

// Als je seed/workspaces/users gebruikt, voeg je ze later toe.
// Voor nu: alleen followups zodat build weer groen wordt.
