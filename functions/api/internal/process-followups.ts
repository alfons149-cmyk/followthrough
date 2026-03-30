import type { PagesFunction } from "@cloudflare/workers-types";
import { and, eq, lte, ne, isNotNull } from "drizzle-orm";
import { getDb, type Env } from "../../_db";
import { followups, emailEvents } from "../db/schema";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

function nextFollowupSubject(companyName?: string | null) {
  return `Korte follow-up over ${companyName || "jullie aanvraag"}`;
}

function nextFollowupMessage(contactName?: string | null, nextStep?: string | null) {
  return [
    `Hoi ${contactName || "daar"},`,
    "",
    "Ik wilde nog even kort opvolgen.",
    "",
    `Vorige stap: ${nextStep || "de volgende stap"}`,
    "",
    "Laat gerust weten of dit nog actueel is of wat voor jullie handig is.",
    "",
    "Groet,",
    "VolgDraad",
  ].join("\n");
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin") ?? "*";

  try {
    const db = getDb(env);
    const nowIso = new Date().toISOString();

    const rows = await db
      .select()
      .from(followups)
      .where(
        and(
          eq(followups.emailEnabled, true),
          isNotNull(followups.contactEmail),
          lte(followups.nextEmailAt, nowIso),
          ne(followups.status, "done")
        )
      );

    let processed = 0;
    const results: Array<{
      id: string;
      contactEmail: string | null;
      sequenceStep: number;
      ok: boolean;
      reason?: string;
    }> = [];

    for (const row of rows) {
      try {
        if (!row.contactEmail) {
          results.push({
            id: row.id,
            contactEmail: null,
            sequenceStep: row.emailSequenceStep ?? 0,
            ok: false,
            reason: "No contact email",
          });
          continue;
        }

        const nextStepNumber = (row.emailSequenceStep ?? 0) + 1;
        const subject = nextFollowupSubject(row.companyName);
        const message = nextFollowupMessage(row.contactName, row.nextStep);

        // Voor nu: simulatie
        console.log("=== AUTO FOLLOW-UP PREVIEW ===");
        console.log("TO:", row.contactEmail);
        console.log("SUBJECT:", subject);
        console.log("BODY:", message);

        await db.insert(emailEvents).values({
          id: `em_${crypto.randomUUID()}`,
          followupId: row.id,
          workspaceId: row.workspaceId,
          ownerId: row.ownerId,
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
          .where(eq(followups.id, row.id));

        processed++;
        results.push({
          id: row.id,
          contactEmail: row.contactEmail,
          sequenceStep: nextStepNumber,
          ok: true,
        });
      } catch (error) {
        results.push({
          id: row.id,
          contactEmail: row.contactEmail ?? null,
          sequenceStep: row.emailSequenceStep ?? 0,
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        found: rows.length,
        simulated: true,
        results,
      }),
      {
        status: 200,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Process follow-ups failed",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...cors(origin), "Content-Type": "application/json" },
      }
    );
  }
};
