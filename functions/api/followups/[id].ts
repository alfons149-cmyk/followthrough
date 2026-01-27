// functions/api/followups/[id].ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../../_db";
import { followups } from "../../../../src/db/schema";
import { eq } from "drizzle-orm";

/**
 * CORS
 * UI: https://followthrough-ui.pages.dev
 * API: https://followthrough.pages.dev
 */
const UI_ORIGIN = "https://followthrough-ui.pages.dev";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = origin === UI_ORIGIN ? origin : UI_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

// (optioneel, maar handig) GET /api/followups/:id -> { item }
export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");

  if (!id) {
    return Response.json(
      { ok: false, error: "Missing id" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  const rows = await db.select().from(followups).where(eq(followups.id, id)).limit(1);
  const item = rows[0];

  if (!item) {
    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  return Response.json(
    { item },
    { headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
  );
};

/**
 * PATCH /api/followups/:id
 * body: { status?: "open"|"sent"|"waiting"|"followup"|"done", dueAt?: "YYYY-MM-DD", nextStep?: string }
 * -> { item }
 */
export const onRequestPatch: PagesFunction<Env> = async ({ env, request, params }) => {
  const db = getDb(env);
  const id = String(params.id || "");

  if (!id) {
    return Response.json(
      { ok: false, error: "Missing id" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  let body: { status?: string; dueAt?: string; nextStep?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  // Alleen deze velden toelaten
  const patch: Record<string, any> = {};

  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.dueAt === "string") patch.dueAt = body.dueAt;
  if (typeof body.nextStep === "string") patch.nextStep = body.nextStep;

  if (Object.keys(patch).length === 0) {
    return Response.json(
      { ok: false, error: "No fields to update" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  // Update + teruglezen (D1/SQLite: returning is niet altijd consistent, dus veilig opnieuw select)
  await db.update(followups).set(patch).where(eq(followups.id, id));

  const rows = await db.select().from(followups).where(eq(followups.id, id)).limit(1);
  const item = rows[0];

  if (!item) {
    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  return Response.json(
    { item },
    { headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
  );
};
