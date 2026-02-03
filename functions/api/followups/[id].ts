import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../db/schema";
import { eq } from "drizzle-orm";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, { status: 204, headers: cors(request.headers.get("Origin") || undefined) });
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");

  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400, headers: cors(request.headers.get("Origin") || undefined) });
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    dueAt?: string;    // "YYYY-MM-DD"
    nextStep?: string;
  };

  const update: Record<string, any> = {};
  if (typeof body.status === "string") update.status = body.status;
  if (typeof body.dueAt === "string") update.dueAt = body.dueAt;
  if (typeof body.nextStep === "string") update.nextStep = body.nextStep;

  if (Object.keys(update).length === 0) {
    return Response.json(
      { ok: false, error: "Nothing to update" },
      { status: 400, headers: cors(request.headers.get("Origin") || undefined) }
    );
  }

  await db.update(followups).set(update).where(eq(followups.id, id));

  return Response.json({ ok: true }, { headers: cors(request.headers.get("Origin") || undefined) });
};
