import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

type PatchBody = Partial<{
  status: string;
  dueAt: string;
  nextStep: string;
}>;

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: cors });
};

// GET /api/followups/:id (handig voor debug)
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id || "");
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400, headers: cors });
  }

  const db = getDb(env);
  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: cors });
  }

  return Response.json({ ok: true, item: row }, { headers: cors });
};

// PATCH /api/followups/:id
export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const id = String(params.id || "");
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400, headers: cors });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const toSet: Record<string, unknown> = {};
  if (typeof body.status === "string" && body.status.trim()) toSet.status = body.status.trim();
  if (typeof body.dueAt === "string" && body.dueAt.trim()) toSet.dueAt = body.dueAt.trim();
  if (typeof body.nextStep === "string" && body.nextStep.trim()) toSet.nextStep = body.nextStep.trim();

  if (Object.keys(toSet).length === 0) {
    return Response.json(
      { ok: false, error: "No valid fields to update (status, dueAt, nextStep)" },
      { status: 400, headers: cors }
    );
  }

  const db = getDb(env);

  await db.update(followups).set(toSet).where(eq(followups.id, id));
  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: cors });
  }

  return Response.json({ ok: true, item: row }, { headers: cors });
};
