import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { followups } from "../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

// GET /api/followups?workspaceId=ws_1&status=open
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";
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

// POST /api/followups
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  const body = await request.json<{
    workspaceId: string;
    ownerId: string;
    contactName: string;
    companyName: string;
    nextStep: string;
    dueAt: string;
    status: string;
  }>();

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
    // createdAt laat je weg → DB default vult dit
  });

  return Response.json({ ok: true, id });
};
