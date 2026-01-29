import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestGet: PagesFunction = async () => {
  return Response.json({ ok: true, items: [] });
};



export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const db = getDb(env);

  const rows = await db.select().from(workspaces);

  return Response.json({ workspaces: rows });
};
