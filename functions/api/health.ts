import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestGet: PagesFunction = async ({ env }) => {
  const row = await env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
  return Response.json({ ok: row?.ok === 1 });
};
