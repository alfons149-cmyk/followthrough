
import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestGet: PagesFunction = async () => {
  return Response.json({ ok: true, method: "GET", route: "/api/_debug" });
};

export const onRequestPost: PagesFunction = async ({ request }) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {}
  return Response.json({ ok: true, method: "POST", route: "/api/_debug", body });
};
