import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

type PatchBody = Partial<{
  status: string;
  dueAt: string;     // "YYYY-MM-DD" of ISO string
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

/**
 * GET /api/followups/:id
 * Handig voor debug: check of route matcht + item bestaat
 */
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

/**
 * PATCH /api/followups/:id
 * Body (JSON): { status?, dueAt?, nextStep? }
 * -> { ok: true, item }
 */
export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const id = String(params.id || "");
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400, headers: cors });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  // Bouw een update-object op met alleen toegestane velden
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

  // Update uitvoeren
  await db.update(followups).set(toSet).where(eq(followups.id, id));

  // Updated row teruggeven (handig voor je UI)
  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    // (zeldzaam) als id niet bestond
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: cors });
  }

  return Response.json({ ok: true, item: row }, { headers: cors });
};
