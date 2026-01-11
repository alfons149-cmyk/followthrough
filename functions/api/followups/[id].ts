export const onRequestGet: PagesFunction<Env> = async ({ params }) => {
  return Response.json({ route: "followups/[id]", id: params.id });
};

import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

type PatchBody = Partial<{
  status: string;
  dueAt: string;
  nextStep: string;
}>;

export const onRequest: PagesFunction<Env> = async ({ env, request, params }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "PATCH") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: corsHeaders() }
    );
  }

  const id = String(params.id || "");
  if (!id) {
    return Response.json(
      { ok: false, error: "Missing id" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  // Alleen deze velden mogen worden geüpdatet
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

  const db = getDb(env);

  // Update
  await db.update(followups).set(toSet).where(eq(followups.id, id));

  // Teruglezen (zodat je ziet wat er nu in DB staat)
  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  return Response.json({ ok: true, item: row }, { headers: corsHeaders() });
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
