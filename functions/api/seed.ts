import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db.ts";
import { followups } from "./db/schema";

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  const db = getDb(env);

  // voorbeeld seed (pas keys aan aan jouw schema)
  await db.insert(followups).values({
    id: `f_${crypto.randomUUID()}`,
    workspaceId: "ws_1",
    ownerId: "u_1",
    contactName: "Alice Example",
    companyName: "Example GmbH",
    nextStep: "Send intro email",
    dueAt: "2026-02-01",
    status: "open",
    createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  });

  return Response.json({ ok: true });
};
