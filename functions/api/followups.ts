import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { followups } from "../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  const url = new URL(request.url);

  // Use ?workspaceId=... if provided, default to ws_1
  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";

  // Optional: ?status=open
  const status = url.searchParams.get("status");

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

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  const body = await request.json();

  const id = `f_${crypto.randomUUID()}`;

  await db.insert(followups).values({
    id,
    workspaceId: body.workspaceId,
    ownerId: body.ownerId,
    contactName: body.contactName,
    companyName: body.companyName,
    nextStep: body.nextStep,
    dueAt: body.dueAt,
    status: body.status,
    // createdAt: let DB default handle it (recommended)
  });

  return Response.json({ ok: true, id });
};
