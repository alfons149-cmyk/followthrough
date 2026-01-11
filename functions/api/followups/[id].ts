import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

type PatchBody = Partial<{
  status: string;
  dueAt: string;
  nextStep: string;
}>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: cors });
};

// Handig om te testen of /api/followups/:id écht gematcht wordt
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id || "");
  const db = getDb(env);

  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: cors });
  }

  return Response.json({ ok: true, item: row }, { headers: cors });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const id = String(params.id || "");
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400, headers: cors });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const toSet: Record<string, unknown> = {};
  if (typeof body.status === "string") toSet.status = body.status;
  if (typeof body.dueAt === "string") toSet.dueAt = body.dueAt;
  if (typeof body.nextStep === "string") toSet.nextStep = body.nextStep;

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
