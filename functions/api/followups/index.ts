export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const db = getDb(env);

    // Body veilig parsen
    const body = await request.json().catch(() => null) as any;
    if (!body) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers: cors });
    }

    const required = ["workspaceId", "ownerId", "contactName", "companyName", "nextStep", "dueAt", "status"];
    for (const k of required) {
      if (typeof body[k] !== "string" || !body[k].trim()) {
        return Response.json({ ok: false, error: `Missing/invalid field: ${k}` }, { status: 400, headers: cors });
      }
    }

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
      // Zet deze tijdelijk expliciet om elke NOT NULL / default mismatch uit te sluiten
      createdAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, id }, { headers: cors });
  } catch (err: any) {
    // Log voor Cloudflare logs
    console.error("POST /api/followups failed:", err);
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500, headers: cors }
    );
  }
};
