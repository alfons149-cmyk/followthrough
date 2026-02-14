import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { apiKeys } from "../db/schema";
import { sha256Hex } from "../../_auth";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-dev-guard",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const origin = request.headers.get("Origin") ?? "*";

  try {
    // ✅ dev guard via .dev.vars
    const guard = request.headers.get("x-dev-guard") || "";
    if (!env.DEV_GUARD || guard !== env.DEV_GUARD) {
      return new Response("Not found", { status: 404, headers: cors(origin) });
    }

    const db = getDb(env);
    const body = await request.json().catch(() => ({} as any));

    const workspaceId = body.workspaceId ?? "ws_1";
    const ownerId = body.ownerId ?? "u_1";
    const label = body.label ?? "dev";

    const apiKeyPlain = `vd_${crypto.randomUUID().replaceAll("-", "")}`;
    const keyHash = await sha256Hex(apiKeyPlain);

    const id = `k_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    await db.insert(apiKeys).values({
      id,
      workspaceId,
      ownerId,
      label,
      keyHash,
      createdAt,
      revokedAt: null,
    });

    return Response.json(
      { ok: true, apiKey: apiKeyPlain, id, workspaceId, ownerId, label },
      { headers: cors(origin) }
    );
  } catch (e: any) {
    // ✅ zo zien we de echte fout in wrangler console
    console.error("DEV create key failed:", e);
    return Response.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500, headers: cors(origin) }
    );
  }
};
