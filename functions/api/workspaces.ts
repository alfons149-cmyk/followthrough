import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { workspaces } from "./db/schema";
import { eq } from "drizzle-orm";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const db = getDb(env);

  // voorbeeld: alle workspaces (pas aan aan je schema)
  const rows = await db.select().from(workspaces).limit(200);

  return Response.json({ ok: true, items: rows });
};
