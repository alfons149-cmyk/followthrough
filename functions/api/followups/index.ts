// functions/api/followups/index.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * CORS
 * UI: https://followthrough-ui.pages.dev
 * API: https://followthrough.pages.dev
 *
 * Voor nu: allow origin = UI domein (strakker dan '*')
 */
const UI_ORIGIN = "https://followthrough-ui.pages.dev";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = origin === UI_ORIGIN ? origin : UI_ORIGIN;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

/**
 * GET /api/followups?workspaceId=ws_1&status=open|sent|waiting|followup|done|all
 * -> { items: Followup[] }
 */
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";
  const status = url.searchParams.get("status"); // optional

  const where =
    status && status !== "all"
      ? and(eq(followups.workspaceId, workspaceId), eq(followups.status as any, status))
      : eq(followups.workspaceId, workspaceId);

  const rows = await db
    .select()
    .from(followups)
    .where(where)
    .orderBy(desc(followups.dueAt))
    .limit(100);

  return Response.json(
    { items: rows },
    {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    }
  );
};

/**
 * POST /api/followups
 * body: { workspaceId, ownerId, contactName, companyName, nextStep, dueAt, status? }
 * -> { ok: true, id }
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  let body: {
    workspaceId: string;
    ownerId: string;
    contactName: string;
    companyName: string;
    nextStep: string;
    dueAt: string; // YYYY-MM-DD
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  // minimale validatie
  if (!body.workspaceId || !body.ownerId) {
    return Response.json(
      { ok: false, error: "Missing workspaceId/ownerId" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  if (!body.contactName || !body.companyName || !body.nextStep || !body.dueAt) {
    return Response.json(
      { ok: false, error: "Missing required fields" },
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }

  // SQLite-friendly timestamp: "YYYY-MM-DD HH:MM:SS"
  const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const id = `f_${crypto.randomUUID()}`;

  await db.insert(followups).values({
    id,
    workspaceId: body.workspaceId,
    ownerId: body.ownerId,
    contactName: body.contactName,
    companyName: body.companyName,
    nextStep: body.nextStep,
    dueAt: body.dueAt,
    status: body.status ?? "open",
    createdAt,
  });

  return Response.json(
    { ok: true, id },
    {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    }
  );
};
