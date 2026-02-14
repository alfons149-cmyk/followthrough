import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { apiKeys } from "../db/schema";
import { sha256Hex } from "../../_auth";

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-dev-guard",
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const guard = request.headers.get("x-dev-guard") || "";
  if (!env.DEV_GUARD || guard !== env.DEV_GUARD) {
    return new Response("Not found", { status: 404 });
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

  return Response.json({ ok: true, id, apiKey: apiKeyPlain });
};
