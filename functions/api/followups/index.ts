import { getApiKeyContext } from "../../_auth";
import { getDb } from "../../_db";
import { followups } from "../db/schema";

/* ---------------- CORS ---------------- */

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-dev-guard",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

/* ---------------- Risk Logic ---------------- */

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
    return { score: 0, level: "low", reasons: [], suggestion: "No action needed." };
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

  const level =
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

/* ---------------- OPTIONS ---------------- */

export const onRequestOptions = async ({ request }: any) => {
  const origin = request.headers.get("Origin") ?? "*";
  return new Response(null, { status: 204, headers: cors(origin) });
};

/* ---------------- GET ---------------- */

export const onRequestGet = async (context: any) => {
  const { env, request } = context;
  const origin = request.headers.get("Origin") ?? "*";

  const auth = await getApiKeyContext(request, env);
if (!auth.ok) {
  return new Response(auth.message, { status: auth.status, headers: cors(origin) });
}

  try {
    const db = getDb(env);
    const rows = await db.select().from(followups).limit(20);

    const items = rows.map((r: any) => ({
      ...r,
      risk: riskForFollowup(r),
    }));

    return Response.json({ ok: true, items }, { headers: cors(origin) });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || String(e), stack: e?.stack || null },
      { status: 500, headers: cors(origin) }
    );
  }
};

/* ---------------- POST ---------------- */

export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const origin = request.headers.get("Origin") ?? "*";

  const auth = await getApiKeyContext(request, env);
if (!auth.ok) {
  return new Response(auth.message, { status: auth.status, headers: cors(origin) });
}

  try {
    const db = getDb(env);
    const body = (await request.json().catch(() => ({}))) as any;

    const id = `f_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    await db.insert(followups).values({
      id,
      workspaceId: body.workspaceId ?? "ws_1",
      ownerId: body.ownerId ?? "u_1",
      contactName: body.contactName ?? "",
      companyName: body.companyName ?? "",
      nextStep: body.nextStep ?? "",
      dueAt: body.dueAt ?? "",
      status: body.status ?? "open",
      createdAt,
    });

    return Response.json({ ok: true, id }, { headers: cors(origin) });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || String(e), stack: e?.stack || null },
      { status: 500, headers: cors(origin) }
    );
  }
};
