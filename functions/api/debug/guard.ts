import { sha256Hex } from "../../_auth";

export const onRequestGet = async ({ request, env }: any) => {
  const expected = String(env.DEV_GUARD ?? "");
  const provided = request.headers.get("x-dev-guard") ?? "";

  // Return only metadata + hashes (safe)
  return Response.json({
    hasEnv: Boolean(expected),
    envLen: expected.length,
    envHash: expected ? await sha256Hex(expected) : null,

    providedLen: provided.length,
    providedHash: provided ? await sha256Hex(provided) : null,

    match: expected === provided,
  });
};
