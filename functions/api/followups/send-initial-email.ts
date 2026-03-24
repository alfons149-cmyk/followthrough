type Env = {
  DB: D1Database;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    const id = (body?.id || "").trim();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing follow-up id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const row = await env.DB
      .prepare(
        `
        SELECT
          id,
          contact_name,
          company_name,
          next_step,
          status,
          contact_email
        FROM followups
        WHERE id = ?
        `
      )
      .bind(id)
      .first<{
        id: string;
        contact_name: string;
        company_name: string;
        next_step: string;
        status: string;
        contact_email: string | null;
      }>();

    if (!row) {
      return new Response(JSON.stringify({ error: "Follow-up not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!row.contact_email) {
      return new Response(JSON.stringify({ error: "Geen e-mailadres ingesteld" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subject = `Even opvolgen over ${row.company_name || "jullie aanvraag"}`;
    const message = [
      `Hoi ${row.contact_name || "daar"},`,
      "",
      `Leuk dat we contact hadden over ${row.company_name || "jullie organisatie"}.`,
      "",
      "Ik wilde even opvolgen rondom:",
      `${row.next_step || "de volgende stap"}`,
      "",
      "Laat gerust weten wat voor jullie handig is.",
      "",
      "Groet,",
      "VolgDraad",
    ].join("\n");

    console.log("=== EMAIL PREVIEW ===");
    console.log("TO:", row.contact_email);
    console.log("SUBJECT:", subject);
    console.log("BODY:", message);

    await env.DB
      .prepare(
        `
        UPDATE followups
        SET
          email_status = 'sent',
          email_sequence_step = 1,
          last_email_sent_at = datetime('now'),
          next_email_at = datetime('now', '+3 days'),
          last_email_subject = ?,
          last_email_preview = ?,
          status = 'sent'
        WHERE id = ?
        `
      )
      .bind(subject, message, id)
      .run();

    return new Response(
      JSON.stringify({
        ok: true,
        simulated: true,
        preview: {
          to: row.contact_email,
          subject,
          body: message,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-initial-email error", error);

    return new Response(
      JSON.stringify({
        error: "Versturen mislukt",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
