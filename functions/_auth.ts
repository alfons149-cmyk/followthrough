// functions/_auth.ts
import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Env } from "./_db";
import { apiKeys } from "./db/schema";

export type DevGuardContext =
  | { ok: true }
  | { ok: false; status: number; message: string };

export type ApiKeyContext =
  | { ok: true; apiKeyId: string; workspaceId: string; ownerId: string }
  | { ok: false; status: number; message: string };

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * DEV GUARD (admin/dev only) — use this ONLY for /api/dev (key creation etc.)
 */
export async function getDevGuardContext(
  request: Request,
  env: Record<string, unknown>
): Promise<DevGuardContext> {
  const expected = String(env.DEV_GUARD ?? "").trim();
  if (!expected) {
    return { ok: false, status: 500, message: "Missing DEV_GUARD secret in env." };
  }

  const provided = (request.headers.get("x-dev-guard") ?? "").trim();
  if (provided !== expected) {
    return { ok: false, status: 401, message: "Unauthorized: bad x-dev-guard." };
  }

  return { ok: true };
}

/**
 * API KEY (real auth) — used by your app routes like /api/followups
 * Accepts:
 *  - Authorization: Bearer <apiKey>
 *  - x-api-key: <apiKey>
 */
export async function getApiKeyContext(
  const auth = await getApiKeyContext(request, env);
if (!auth.ok) {
  return new Response(auth.message, { status: auth.status, headers: cors(origin) });
}
  request: Request,
  env: Env
): Promise<ApiKeyContext> {
  const auth = request.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerKey = (request.headers.get("x-api-key") ?? "").trim();
  const apiKey = bearer || headerKey;

  if (!apiKey) {
    return { ok: false, status: 401, message: "Missing API key (Authorization: Bearer ... or x-api-key)." };
  }

  // Optional: basic sanity check (keeps junk out)
  if (!apiKey.startsWith("vd_") || apiKey.length < 10) {
    return { ok: false, status: 401, message: "Invalid API key format." };
  }

  const keyHash = await sha256Hex(apiKey);

  try {
    const db = getDb(env);

    // NOTE: assumes drizzle schema uses camelCase fields: keyHash, revokedAt, workspaceId, ownerId
    const rows = await db
      .select({
        id: apiKeys.id,
        workspaceId: apiKeys.workspaceId,
        ownerId: apiKeys.ownerId,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { ok: false, status: 401, message: "Unauthorized: API key not found or revoked." };
    }

    return { ok: true, apiKeyId: row.id, workspaceId: row.workspaceId, ownerId: row.ownerId };
  } catch (e: any) {
    return { ok: false, status: 500, message: e?.message || String(e) };
  }
}
