import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * CORS (handig als je ooit vanaf een ander domein test,
 * maar het werkt ook prima same-origin)
 */
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: cors });
};

/**
 * GET /api/followups?workspaceId=ws_1&status=open
 * -> { items: Followup[] }
 */
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";
  const status = url.searchParams.get("status"); // optional

  const where =
    status && status !== "all"
      ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
      : eq(followups.workspaceId, workspaceId);

  const rows = await db
    .select()
    .from(followups)
    .where(where)
    .orderBy(desc(followups.dueAt))
    .limit(100);

  return Response.json({ items: rows }, { headers: cors });
};

/**
 * POST /api/followups
 * body: { workspaceId, ownerId, contactName, companyName, nextStep, dueAt, status? }
 * -> { ok: true, id }
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  const body = await request.json<{
    workspaceId: string;
    ownerId: string;
    contactName: string;
    companyName: string;
    nextStep: string;
    dueAt: string; // "YYYY-MM-DD"
    status?: string;
  }>();

  // (optioneel) minimale validatie zodat errors duidelijker worden
  if (!body.workspaceId || !body.ownerId) {
    return Response.json(
      { ok: false, error: "Missing workspaceId/ownerId" },
      { status: 400, headers: cors }
    );
  }
  if (!body.contactName || !body.companyName || !body.nextStep || !body.dueAt) {
    return Response.json(
      { ok: false, error: "Missing required fields" },
      { status: 400, headers: cors }
    );
  }

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
    status: body.status ?? "open",
    createdAt, // belangrijk als created_at NOT NULL is in je schema
  });

  return Response.json({ ok: true, id }, { headers: cors });
};
