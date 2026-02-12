import { eq, and, isNull } from "drizzle-orm";
import { getDb, type Env } from "./_db.ts";
import { apiKeys } from "./api/db/schema/index.ts";

export type AuthContext = {
  workspaceId: string;
  ownerId: string;
  apiKeyId: string;
};

function unauthorized(msg = "Unauthorized") {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function forbidden(msg = "Forbidden") {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getAuthContext(env: Env, request: Request): Promise<AuthContext | Response> {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return unauthorized("Missing Authorization: Bearer <apiKey>");

  const apiKey = m[1].trim();
  if (apiKey.length < 16) return forbidden("Invalid API key");

  const keyHash = await sha256Hex(apiKey);

  const db = getDb(env);
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return forbidden("Invalid or revoked API key");

  return {
    workspaceId: row.workspaceId,
    ownerId: row.ownerId,
    apiKeyId: row.id,
  };
}
