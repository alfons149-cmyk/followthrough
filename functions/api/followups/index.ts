import type { PagesFunction } from "@cloudflare/workers-types";
import { and, desc, eq } from "drizzle-orm";
import { followups } from "../db/schema";
import { getDb, type Env } from "../_db";

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

type RiskLevel = "low" | "medium" | "high";

function daysOverdue(dueAt?: string) {
  const due = (dueAt || "").slice(0, 10);
  if (!due) return 0;

  // Vergelijk als YYYY-MM-DD strings (werkt goed lexicografisch)
  const today = new Date().toISOString().slice(0, 10);
  if (due >= today) return 0;

  const dueDate = new Date(due + "T00:00:00Z");
  const todayDate = new Date(today + "T00:00:00Z");
  const diffMs = todayDate.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function riskForFollowup(f: any) {
  // done = altijd 0 risico
  if (f?.status === "done") {
    return { score: 0, level: "low" as RiskLevel, reasons: [], suggestion: "No action needed." };
  }

  const overdue = daysOverdue(f?.dueAt);
  let score = 0;
  const reasons: string[] = [];

  // Overdue score
  if (overdue >= 14) score += 65;
  else if (overdue >= 7) score += 45;
  else if (overdue >= 3) score += 25;
  else if (overdue >= 1) score += 10;

  if (overdue > 0) reasons.push(`Overdue ${overdue} day${overdue === 1 ? "" : "s"}`);

  // Status factor
  const s = f?.status as string;
  if (s === "open") score += 5;
  else if (s === "sent") score += 15;
  else if (s === "waiting") score += 25;
  else if (s === "followup") score += 35;

  if (s) reasons.push(`Status: ${s}`);

  // Clamp + level
  score = Math.max(0, Math.min(100, score));

  const level: RiskLevel = score >= 60 ? "high" : score >= 25 ? "medium" : "low";

  // Suggestion (MVP)
  let suggestion = "No action needed.";
  if (level === "high" && s === "waiting") suggestion = "Follow up today: short check-in + 2 options.";
  else if (level === "high" && s === "sent") suggestion = "Ping today: ask one clear question.";
  else if (level === "high") suggestion = "Act today: move it forward with a clear next step.";
  else if (level === "medium" && overdue > 0) suggestion = "Schedule a reminder and send a short nudge.";
  else if (level === "medium") suggestion = "Keep an eye on it; confirm next step.";

  return { score, level, reasons: reasons.slice(0, 3), suggestion };
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const url = new URL(request.url);   // ← deze MOET er staan

  const workspaceId = url.searchParams.get("workspaceId") ?? "ws_1";
  const status = url.searchParams.get("status");

  const where =
    status && status !== "all"
      ? and(eq(followups.workspaceId, workspaceId), eq(followups.status, status))
      : eq(followups.workspaceId, workspaceId);

  const rows = await db
    .select()
    .from(followups)
    .where(where)
    .orderBy(desc(followups.dueAt))
    .limit(200);

  const origin = request.headers.get("Origin") ?? "*";

  const includeRisk = url.searchParams.get("includeRisk") === "1";

  const items = includeRisk
    ? rows.map((r: any) => ({ ...r, risk: riskForFollowup(r) }))
    : rows;

  return Response.json({ items }, { headers: cors(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const db = getDb(env);
  const origin = request.headers.get("Origin") ?? "*";

  const body = (await request.json().catch(() => ({}))) as any;

  if (!body?.workspaceId || !body?.ownerId) {
    return Response.json(
      { ok: false, error: "Missing workspaceId/ownerId" },
      { status: 400, headers: cors(origin) }
    );
  }

  const id = `f_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  await db.insert(followups).values({
    id,
    workspaceId: body.workspaceId,
    ownerId: body.ownerId,
    contactName: body.contactName ?? "",
    companyName: body.companyName ?? "",
    nextStep: body.nextStep ?? "",
    dueAt: body.dueAt ?? "",
    status: body.status ?? "open",
    createdAt,
  });

  return Response.json({ ok: true, id }, { headers: cors(origin) });
};
