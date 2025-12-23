import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { workspaces } from "../../src/db/schema";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const db = getDb(env);

  const rows = await db.select().from(workspaces);

  return Response.json({ workspaces: rows });
};
