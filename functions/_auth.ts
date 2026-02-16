import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Env } from "./_db";
import { apiKeys } from "./api/db/schema";

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
 * REAL API KEY AUTH
 */
export async function getApiKeyContext(
  request: Request,
  env: Env
): Promise<ApiKeyContext> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const headerKey = (request.headers.get("x-api-key") ?? "").trim();
  const apiKey = bearer || headerKey;

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      message: "Missing API key (Authorization: Bearer ... or x-api-key).",
    };
  }

  if (!apiKey.startsWith("vd_")) {
    return {
      ok: false,
      status: 401,
      message: "Invalid API key format.",
    };
  }

  const keyHash = await sha256Hex(apiKey);
  const db = getDb(env);

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
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: API key not found or revoked.",
    };
  }

  return {
    ok: true,
    apiKeyId: row.id,
    workspaceId: row.workspaceId,
    ownerId: row.ownerId,
  };
}
/* -------------------------------------------------- */
/* DEV GUARD (used only for /api/dev) */
/* -------------------------------------------------- */

export type DevGuardContext =
  | { ok: true }
  | { ok: false; status: number; message: string };

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
