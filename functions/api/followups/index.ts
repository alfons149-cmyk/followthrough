import type { PagesFunction } from "@cloudflare/workers-types";
import { and, desc, eq } from "drizzle-orm";
import { followups } from "../db/schema/index.ts";
import { getDb, type Env } from "../_db";
import { getAuthContext } from "../../_auth.ts";

/* ---------------- CORS ---------------- */

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

/* ---------------- Risk Logic ---------------- */

type RiskLevel = "low" | "medium" | "high";

function daysOverdue(dueAt?: string) {
  const due = (dueAt || "").slice(0, 10);
  if (!due) return 0;

  const today = new Date().toISOString().slice(0, 10);
  if (due >= today) return 0;

  const dueDate = new Date(due + "T00:00:00Z");
  const todayDate = new Date(today + "T00:00:00Z");

  const diffMs = todayDate.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function riskForFollowup(f: any) {
  if (f?.status === "done") {
    return { score: 0, level: "low" as RiskLevel, reasons: [], suggestion: "No action needed." };
  }

  const overdue = daysOverdue(f?.dueAt);
  let score = 0;
  const reasons: string[] = [];

  if (overdue >= 14) score += 65;
  else if (overdue >= 7) score += 45;
  else if (overdue >= 3) score += 25;
  else if (overdue >= 1) score += 10;

  if (overdue > 0) reasons.push(`Overdue ${overdue} day${overdue === 1 ? "" : "s"}`);

  const s = f?.status;
  if (s === "open") score += 5;
  if (s === "sent") score += 15;
  if (s === "waiting") score += 25;
  if (s === "followup") score += 35;

  if (s) reasons.push(`Status: ${s}`);

  score = Math.max(0, Math.min(100, score));

  const level: RiskLevel =
    score >= 60 ? "high" :
    score >= 25 ? "medium" :
    "low";

  return {
    score,
    level,
    reasons: reasons.slice(0, 3),
    suggestion:
      level === "high"
        ? "Act today"
        : level === "medium"
        ? "Keep warm"
        : "No action needed",
  };
}

/* ---------------- GET ---------------- */

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const origin = request.headers.get("Origin") ?? "*";

  const ctx = await getAuthContext(env, request);
  if (ctx instanceof Response) {
    // zorg dat CORS ook op errors zit
    return new Response(await ctx.text(), { status: ctx.status, headers: { ...cors(origin), "Content-Type": "application/json" } });
  }

  const db = getDb(env);
  const url = new URL(request.url);

  // workspaceId uit query wordt genegeerd (mag later verwijderd)
  const status = url.searchParams.get("status");

  const baseWhere = and(
    eq(followups.workspaceId, ctx.workspaceId),
    eq(followups.ownerId, ctx.ownerId),
  );

  const where =
    status && status !== "all"
      ? and(baseWhere, eq(followups.status, status))
      : baseWhere;

  const rows = await db
    .select()
    .from(followups)
    .where(where)
    .orderBy(desc(followups.dueAt))
    .limit(200);

  const includeRisk = url.searchParams.get("includeRisk") === "1";

  const items = includeRisk
    ? rows.map((r: any) => ({ ...r, risk: riskForFollowup(r) }))
    : rows;

  return Response.json({ items }, { headers: cors(origin) });
};

/* ---------------- POST ---------------- */

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const origin = request.headers.get("Origin") ?? "*";

  const ctx = await getAuthContext(env, request);
  if (ctx instanceof Response) {
    return new Response(await ctx.text(), { status: ctx.status, headers: { ...cors(origin), "Content-Type": "application/json" } });
  }

  const db = getDb(env);
  const body = await request.json().catch(() => ({} as any));

  // geen workspaceId/ownerId meer uit body accepteren
  const id = `f_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  await db.insert(followups).values({
    id,
    workspaceId: ctx.workspaceId,
    ownerId: ctx.ownerId,
    contactName: body.contactName ?? "",
    companyName: body.companyName ?? "",
    nextStep: body.nextStep ?? "",
    dueAt: body.dueAt ?? "",
    status: body.status ?? "open",
    createdAt,
  });

  return Response.json({ ok: true, id }, { headers: cors(origin) });
};
