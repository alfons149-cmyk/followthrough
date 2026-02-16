import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../../_db";
import { apiKeys } from "../db/schema";
import { getApiKeyContext } from "../../_auth";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-dev-guard",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}


export const onRequestOptions: PagesFunction = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPost: PagesFunction<Env & { DEV_GUARD?: string }> = async (context) => {
  const { request, env } = context;
  const origin = request.headers.get("Origin") ?? "*";
  const guard = await getDevGuardContext(request, env);
if (!guard.ok) return new Response(guard.message, { status: guard.status, headers: cors(origin) });

  // 🔐 Guard (use helper)
  const auth = await getAuthContext(request, env as unknown as Record<string, unknown>);
  if (!auth.ok) {
    return new Response(auth.message, { status: auth.status, headers: cors(origin) });
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
    return Response.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500, headers: { ...cors(origin), "Content-Type": "application/json" } }
    );
  }
};
