import type { PagesFunction } from "@cloudflare/workers-types";
import { followups } from "../../db/schema";
import { getDb, type Env } from "../../_db";
import { eq } from "drizzle-orm";

export const onRequestPost: PagesFunction = async ({ env }) => {
  const db = getDb(env as any);

  const workspaceId = "ws_demo";
  const userId = "u_demo";

  // Create workspace if missing
  const ws = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (ws.length === 0) {
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Demo Workspace",
    });
  }

  // Create user if missing
  const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (u.length === 0) {
    await db.insert(users).values({
      id: userId,
      workspaceId,
      email: "alex@followthrough.demo",
      displayName: "Alex",
    });
  }

  // Insert a few followups (idempotent-ish: always new IDs)
  const now = new Date();
  const isoInDays = (d: number) =>
    new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

  const items = [
    {
      contactName: "Sarah Lim",
      companyName: "Brightline Retail",
      nextStep: "Send pricing summary",
      dueAt: isoInDays(-2),
      status: "Overdue",
    },
    {
      contactName: "Miguel Ortiz",
      companyName: "AltoSoft",
      nextStep: "Schedule demo",
      dueAt: isoInDays(0),
      status: "Due today",
    },
    {
      contactName: "Priya Nair",
      companyName: "Northwind Logistics",
      nextStep: "Confirm stakeholders",
      dueAt: isoInDays(3),
      status: "Scheduled",
    },
  ] as const;

  const inserted = [];
  for (const it of items) {
    const id = crypto.randomUUID();
    await db.insert(followups).values({
      id,
      workspaceId,
      ownerId: userId,
      ...it,
    });
    inserted.push(id);
  }

  return Response.json({ seeded: true, inserted });
};
