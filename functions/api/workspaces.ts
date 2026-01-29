import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { workspaces } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  // optioneel: ?ownerId=u_1
  const ownerId = url.searchParams.get("ownerId");

  const rows = ownerId
    ? await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId))
    : await db.select().from(workspaces);

  return Response.json({ items: rows });
};
