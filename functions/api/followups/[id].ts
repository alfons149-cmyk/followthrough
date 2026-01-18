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
const db = getDb(env);

const result = await db
  .update(followups)
  .set(toSet)
  .where(eq(followups.id, id))
  .run();

if (!result.changes) {
  return Response.json(
    { ok: false, error: "Not found" },
    { status: 404, headers: cors }
  );
}

// daarna nog wél even de bijgewerkte row ophalen
const row = await db
  .select()
  .from(followups)
  .where(eq(followups.id, id))
  .get();

return Response.json({ ok: true, item: row }, { headers: cors });

  }

  const db = getDb(env);

  await db.update(followups).set(toSet).where(eq(followups.id, id));
  const row = await db.select().from(followups).where(eq(followups.id, id)).get();

  if (!row) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: cors });
  }

  return Response.json({ ok: true, item: row }, { headers: cors });
};
