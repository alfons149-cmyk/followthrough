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

export const onRequestOptions: PagesFunction<Env & { DEV_GUARD?: string }> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPost: PagesFunction<Env & { DEV_GUARD?: string }> = async ({ env, request }) => {
  const origin = request.headers.get("Origin") ?? "*";

  // ✅ Dev guard via env var
  const guard = request.headers.get("x-dev-guard") || "";
  if (!env.DEV_GUARD || guard !== env.DEV_GUARD) {
    return new Response("Not found", { status: 404, headers: cors(origin) });
  }

  try {
    const db = getDb(env);
    const body = (await request.json().catch(() => ({}))) as any;

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

    return Response.json({ ok: true, apiKey: apiKeyPlain, id }, { headers: cors(origin) });
  } catch (e: any) {
    // ✅ Geef echte fout terug i.p.v. “restart”
    return Response.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500, headers: { ...cors(origin), "Content-Type": "application/json" } }
    );
  }
};
