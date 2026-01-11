import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

type PatchBody = Partial<{
  status: string;
  dueAt: string;
  nextStep: string;
}>;

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders() });

// Handig: GET /api/followups/f_1 → JSON (zodat je dit in de browser kunt zien)
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");
  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: corsHeaders() });
  }
  return Response.json({ ok: true, item: row }, { headers: corsHeaders() });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");
  if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400, headers: corsHeaders() });

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const toSet: Record<string, unknown> = {};
  if (typeof body.status === "string") toSet.status = body.status;
  if (typeof body.dueAt === "string") toSet.dueAt = body.dueAt;
  if (typeof body.nextStep === "string") toSet.nextStep = body.nextStep;

  if (Object.keys(toSet).length === 0) {
    return Response.json(
      { ok: false, error: "No valid fields to update (status, dueAt, nextStep)" },
      { status: 400, headers: corsHeaders() }
    );
  }

  await db.update(followups).set(toSet).where(eq(followups.id, id));

  const row = await db.select().from(followups).where(eq(followups.id, id)).get();
  return Response.json({ ok: true, item: row }, { headers: corsHeaders() });
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
