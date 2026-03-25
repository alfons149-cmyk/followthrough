import type { PagesFunction } from "@cloudflare/workers-types";
import { and, eq } from "drizzle-orm";
import { getApiKeyContext } from "../../_auth";
import { getDb, type Env } from "../../_db";
import { followups, emailEvents } from "../db/schema";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin") ?? "*";

  const auth = await getApiKeyContext(request, env);
  if (!auth.ok) {
    return new Response(auth.message, {
      status: auth.status,
      headers: cors(origin),
    });
  }

  try {
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    const id = (body?.id || "").trim();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing follow-up id" }), {
        status: 400,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }

    const db = getDb(env);

    const rows = await db
      .select()
      .from(followups)
      .where(
        and(
          eq(followups.id, id),
          eq(followups.workspaceId, auth.workspaceId),
          eq(followups.ownerId, auth.ownerId)
        )
      )
      .limit(1);

    const row = rows[0];

    if (!row) {
      return new Response(JSON.stringify({ error: "Follow-up not found" }), {
        status: 404,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }

    if (!row.contactEmail) {
      return new Response(JSON.stringify({ error: "Geen e-mailadres ingesteld" }), {
        status: 400,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }

    const nextStepNumber = (row.emailSequenceStep ?? 1) + 1;

    const subject = `Korte follow-up over ${row.companyName || "jullie aanvraag"}`;
    const message = [
      `Hoi ${row.contactName || "daar"},`,
      "",
      "Ik wilde nog even kort opvolgen.",
      "",
      `Vorige stap: ${row.nextStep || "de volgende stap"}`,
      "",
      "Laat gerust weten of dit nog actueel is of wat voor jullie handig is.",
      "",
      "Groet,",
      "VolgDraad",
    ].join("\n");

    await db.insert(emailEvents).values({
      id: `em_${crypto.randomUUID()}`,
      followupId: row.id,
      workspaceId: auth.workspaceId,
      ownerId: auth.ownerId,
      kind: "followup",
      sequenceStep: nextStepNumber,
      toEmail: row.contactEmail,
      subject,
      bodyText: message,
      status: "sent",
      provider: "simulated",
    });

    await db
      .update(followups)
      .set({
        emailStatus: "sent",
        emailSequenceStep: nextStepNumber,
        lastEmailSentAt: new Date().toISOString(),
        nextEmailAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastEmailSubject: subject,
        lastEmailPreview: message,
        status: "followup",
      })
      .where(
        and(
          eq(followups.id, id),
          eq(followups.workspaceId, auth.workspaceId),
          eq(followups.ownerId, auth.ownerId)
        )
      );

    return new Response(
      JSON.stringify({
        ok: true,
        simulated: true,
        preview: {
          to: row.contactEmail,
          subject,
          body: message,
        },
      }),
      {
        status: 200,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Follow-up versturen mislukt",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      }
    );
  }
};
