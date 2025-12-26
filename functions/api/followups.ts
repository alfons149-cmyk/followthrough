import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { followups } from "../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const db = getDb(env);

    const url = new URL(request.url);

    // Use ?workspaceId=... if provided, otherwise default to the one you created in D1
    const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";

    // Optional filter: ?status=open
    const status = url.searchParams.get("status");

    const where = status
      ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
      : eq(followups.workspaceId, workspaceId);

    const rows = await db
      .select()
      .from(followups)
      .where(where)
      .orderBy(desc(followups.dueAt)) // dueAt MUST be text("due_at") in schema.ts
      .limit(100);

    return Response.json({ items: rows });
  } catch (err) {
    // Useful when you hit Error 1101 and need the real reason in logs
    console.error("GET /api/followups failed:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
