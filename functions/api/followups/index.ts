import { getAuthContext } from "../../_auth";
import { getDb } from "../../_db";
import { followups } from "../../db/schema";

/* ---------------- CORS ---------------- */

const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-dev-guard",
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

  // 🔐 Guard
  const auth = await getAuthContext(request, env);
