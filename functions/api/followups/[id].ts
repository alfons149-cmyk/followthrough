import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "../_db";
import { followups } from "../../../src/db/schema";
import { eq } from "drizzle-orm";

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) => {
  const db = getDb(env);

  const id = params.id as string;
  if (!id) {
    return new Response("Missing followup id", { status: 400 });
  }

  const body = await request.json<{
    status?: string;
    dueAt?: string;
    nextStep?: string;
  }>();

  if (!body.status && !body.dueAt && !body.nextStep) {
    return new Response("Nothing to update", { status: 400 });
  }

  await db
    .update(followups)
    .set({
      ...(body.status && { status: body.status }),
      ...(body.dueAt && { dueAt: body.dueAt }),
      ...(body.nextStep && { nextStep: body.nextStep }),
    })
    .where(eq(followups.id, id));

  return Response.json({ ok: true, id });
};
