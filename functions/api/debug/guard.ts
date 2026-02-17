import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const expected = String(env.DEV_GUARD ?? "").trim();
  const provided = (request.headers.get("x-dev-guard") ?? "").trim();

  return Response.json({
    hasEnv: !!expected,
    envLen: expected.length,
    providedLen: provided.length,
    match: expected === provided,
  });
};

