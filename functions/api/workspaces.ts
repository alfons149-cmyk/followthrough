import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const db = getDb(env); // bind DB (en voorkomt "unused import")
  // eventueel: await db.select()... later

  return Response.json({ ok: true, items: [] });
};
