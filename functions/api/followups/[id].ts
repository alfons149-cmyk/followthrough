import type { PagesFunction } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { getDb, type Env } from "../../_db";
import { followups } from "../../db/schema";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");
  if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

  const body = (await request.json()) as any;
  const patch: Record<string, any> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.dueAt === "string") patch.dueAt = body.dueAt;
  if (typeof body.nextStep === "string") patch.nextStep = body.nextStep;

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  await db.update(followups).set(patch).where(eq(followups.id, id));

  const rows = await db.select().from(followups).where(eq(followups.id, id)).limit(1);
  const item = rows[0];
  if (!item) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const origin = request.headers.get("Origin") ?? "*";
  return Response.json({ ok: true, item }, { headers: cors(origin) });
};

import { getDb, type Env } from "../../_db";
import { followups } from "../../db/schema";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");
  if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

  const body = (await request.json()) as any;
  const patch: Record<string, any> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.dueAt === "string") patch.dueAt = body.dueAt;
  if (typeof body.nextStep === "string") patch.nextStep = body.nextStep;

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  await db.update(followups).set(patch).where(eq(followups.id, id));

  const rows = await db.select().from(followups).where(eq(followups.id, id)).limit(1);
  const item = rows[0];
  if (!item) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const origin = request.headers.get("Origin") ?? "*";
  return Response.json({ ok: true, item }, { headers: cors(origin) });
};
