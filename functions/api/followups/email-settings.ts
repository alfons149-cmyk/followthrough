import type { PagesFunction } from "@cloudflare/workers-types";
import { and, eq } from "drizzle-orm";
import { getApiKeyContext } from "../../_auth";
import { getDb, type Env } from "../../_db";
import { followups } from "../db/schema";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin") ?? "*";

  const auth = await getApiKeyContext(request, env);
  if (!auth.ok) {
    return new Response(auth.message, {
      status: auth.status,
      headers: cors(origin),
    });
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | { id?: string; emailEnabled?: boolean }
      | null;

    const id = (body?.id || "").trim();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing follow-up id" }), {
        status: 400,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }

    if (typeof body?.emailEnabled !== "boolean") {
      return new Response(JSON.stringify({ error: "Missing or invalid emailEnabled" }), {
        status: 400,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }

    const db = getDb(env);

    await db
      .update(followups)
      .set({
        emailEnabled: body.emailEnabled,
      })
      .where(
        and(
          eq(followups.id, id),
          eq(followups.workspaceId, auth.workspaceId),
          eq(followups.ownerId, auth.ownerId)
        )
      );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors(origin), "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Email settings bijwerken mislukt",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      }
    );
  }
};
