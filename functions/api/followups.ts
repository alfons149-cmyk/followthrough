import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb } from "./_db";
import { followups } from "../../src/db/schema";
import { and, eq, desc } from "drizzle-orm";

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const db = getDb(env as any);

  // For now: single demo workspace
  const workspaceId = "ws_demo";

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // optional

  const where = status
    ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
    : eq(followups.workspaceId, workspaceId);

  const rows = await db
    .select()
    .from(followups)
    .where(where)
    .orderBy(desc(followups.dueAt))
    .limit(100);

  return Response.json({ items: rows });
};
