import type { PagesFunction } from "@cloudflare/workers-types";
import { and, desc, eq } from "drizzle-orm";
import { followups } from "../db/schema";
import { getDb, type Env } from "../_db";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";
  const status = url.searchParams.get("status");

  const where =
    status && status !== "all"
      ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
      : eq(followups.workspaceId, workspaceId);

  const rows = await db
    .select()
    .from(followups)
    .where(where)
    .orderBy(desc(followups.dueAt))
    .limit(200);

  const origin = request.headers.get("Origin") ?? "*";
return Response.json(
  { ok: false, error: "Missing workspaceId/ownerId" },
  { status: 400, headers: cors(origin) }
);

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const body = (await request.json().catch(() => ({}))) as any;
  );

  if (!body?.workspaceId || !body?.ownerId) {
    return Response.json({ ok: false, error: "Missing workspaceId/ownerId" }, { status: 400 });
  }

  const id = `f_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  await db.insert(followups).values({
    id,
    workspaceId: body.workspaceId,
    ownerId: body.ownerId,
    contactName: body.contactName ?? "",
    companyName: body.companyName ?? "",
    nextStep: body.nextStep ?? "",
    dueAt: body.dueAt ?? "",
    status: body.status ?? "open",
    createdAt,
  });

  const origin = request.headers.get("Origin") ?? "*";
  return Response.json({ ok: true, id }, { headers: cors(origin) });
};
