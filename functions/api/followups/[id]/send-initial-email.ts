export const onRequestPost: PagesFunction = async (context) => {
  const { params, env } = context;
  const id = params.id as string;

  const db = env.DB;

  try {
    // 1. Haal follow-up op
    const row = await db
      .prepare(`SELECT * FROM followups WHERE id = ?`)
      .bind(id)
      .first();

    if (!row) {
      return new Response(JSON.stringify({ error: "Follow-up not found" }), {
        status: 404,
      });
    }

    if (!row.contact_email) {
      return new Response(JSON.stringify({ error: "Geen e-mailadres ingesteld" }), {
        status: 400,
      });
    }

    // 2. Bouw simpele mail
    const subject = `Even opvolgen over ${row.company_name}`;
    const body = `
Hoi ${row.contact_name},

Leuk dat we contact hadden over ${row.company_name}.

Ik wilde even opvolgen rondom:
${row.next_step}

Laat gerust weten wat voor jullie handig is.

Groet,
VolgDraad
    `.trim();

    // 3. (Voor nu) loggen i.p.v. versturen
    console.log("EMAIL PREVIEW:");
    console.log("To:", row.contact_email);
    console.log("Subject:", subject);
    console.log("Body:", body);

    // 4. Update follow-up
    await db
      .prepare(`
        UPDATE followups
        SET 
          email_status = 'sent',
          email_sequence_step = 1,
          last_email_sent_at = datetime('now'),
          next_email_at = datetime('now', '+3 days'),
          status = 'sent'
        WHERE id = ?
      `)
      .bind(id)
      .run();

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Mail (simulatie) verstuurd",
        preview: {
          to: row.contact_email,
          subject,
          body,
        },
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
    });
  }
};
