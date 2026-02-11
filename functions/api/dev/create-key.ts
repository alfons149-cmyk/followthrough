import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../../_db";
import { apiKeys } from "../db/schema";
import { sha256Hex } from "../../_auth";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  // heel basic "dev guard": alleen toestaan als header klopt
  const guard = request.headers.get("x-dev-guard");
  if (guard !== "yes") return new Response("Not found", { status: 404 });

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
    keyHash,
    workspaceId,
    ownerId,
    label,
    createdAt,
    revokedAt: null,
  });

  return Response.json({ ok: true, apiKey: apiKeyPlain, workspaceId, ownerId });
};
