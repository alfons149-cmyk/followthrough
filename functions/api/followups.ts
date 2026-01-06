import type { PagesFunction } from "@cloudflare/workers-types";
import { getDb, type Env } from "./_db";
import { followups } from "../../src/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const onRequest: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);

  // Default workspace
  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";

  if (request.method === "GET") {
    const status = url.searchParams.get("status"); // optional

    const where = status
      ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
      : eq(followups.workspaceId, workspaceId);

    const rows = await db
      .select()
      .from(followups)
      .where(where)
      .orderBy(desc(followups.dueAt))
      .limit(100);

    return Response.json({ items: rows });
  }

  if (request.method === "POST") {
    const body = await request.json<any>();

    // Simpele validatie
    const required = ["ownerId", "contactName", "companyName", "nextStep", "dueAt", "status"];
    for (const key of required) {
      if (!body?.[key]) {
        return new Response(`Missing field: ${key}`, { status: 400 });
      }
    }

    const id = `f_${crypto.randomUUID()}`;

    await db.insert(followups).values({
      id,
      workspaceId: body.workspaceId ?? workspaceId,
      ownerId: body.ownerId,
      contactName: body.contactName,
      companyName: body.companyName,
      nextStep: body.nextStep,
      dueAt: body.dueAt,
      status: body.status,
      // createdAt heeft DB default; hoeft niet mee
    });

    return Response.json({ ok: true, id });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
