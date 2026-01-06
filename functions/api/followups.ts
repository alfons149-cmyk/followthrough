import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { followups } from "../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  const body = await request.json();

  const id = `f_${crypto.randomUUID()}`;

  await db.insert(followups).values({
    id,
    workspaceId: body.workspaceId,
    ownerId: body.ownerId,
    contactName: body.contactName,
    companyName: body.companyName,
    nextStep: body.nextStep,
    dueAt: body.dueAt,
    status: body.status,
  });

  return Response.json({ ok: true, id });
};

{
  "workspaceId": "ws_1",
  "ownerId": "u_1",
  "contactName": "Bob Example",
  "companyName": "ACME BV",
  "nextStep": "Call back",
  "dueAt": "2026-01-10",
  "status": "open"
}
