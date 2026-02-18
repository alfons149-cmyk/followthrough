import type { PagesFunction } from "@cloudflare/workers-types";

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const expected = String(env.DEV_GUARD ?? "").trim();
  const provided = (request.headers.get("x-dev-guard") ?? "").trim();

  const expectedHash = expected ? (await sha256Hex(expected)).slice(0, 12) : null;
  const providedHash = provided ? (await sha256Hex(provided)).slice(0, 12) : null;

  return Response.json({
    hasEnv: !!expected,
    envLen: expected.length,
    providedLen: provided.length,
    expectedHash12: expectedHash,
    providedHash12: providedHash,
    match: expected === provided,
  });
};
