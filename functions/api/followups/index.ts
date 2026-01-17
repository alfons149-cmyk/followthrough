export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);

  const body = await request.json<{
    workspaceId: string;
    ownerId: string;
    contactName: string;
    companyName: string;
    nextStep: string;
    dueAt: string;
    status: string;
  }>();

  const id = `f_${crypto.randomUUID()}`;

  // SQLite-friendly timestamp: "YYYY-MM-DD HH:MM:SS"
  const createdAt = new Date()
  .toISOString()
  .slice(0, 19)
  .replace("T", " ");

await db.insert(followups).values({
  id,
  workspaceId: body.workspaceId,
  ownerId: body.ownerId,
  contactName: body.contactName,
  companyName: body.companyName,
  nextStep: body.nextStep,
  dueAt: body.dueAt,
  status: body.status,
  createdAt, // 👈 cruciaal
});
