const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: cors });
};

import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";
  const status = url.searchParams.get("status");

  const where = status
    ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
    : eq(followups.workspaceId, workspaceId);

  const rows = await db.select().from(followups).where(where).orderBy(desc(followups.dueAt)).limit(100);

  return Response.json({ items: rows }, { headers: cors });
};

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

  // SQLite-friendly timestamp: "YYYY-MM-DD HH:MM:SS"
  const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  await db.insert(followups).values({
    id,
    workspaceId: body.workspaceId,
    ownerId: body.ownerId,
    contactName: body.contactName,
    companyName: body.companyName,
    nextStep: body.nextStep,
    dueAt: body.dueAt,
    status: body.status,
    createdAt, // ✅ ADD THIS
  });

  return Response.json({ ok: true, id }, { headers: cors });
};
