import { and, eq, isNull } from "drizzle-orm";
import { apiKeys } from "./api/db/schema"; // pas pad aan als nodig

export async function getAuthContext(env: Env, request: Request) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return new Response(JSON.stringify({ error: "Missing bearer token" }), { status: 401 });

  const apiKeyPlain = m[1].trim();
  const keyHash = await sha256Hex(apiKeyPlain);

  const db = getDb(env);

  // ✅ BELANGRIJK: gebruik .get() i.p.v. .limit(1)
  const row = await db
    .select({
      workspaceId: apiKeys.workspaceId,
      ownerId: apiKeys.ownerId,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .get();

  if (!row) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401 });
  }

  return { workspaceId: row.workspaceId, ownerId: row.ownerId };
}
