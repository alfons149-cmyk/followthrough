import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Status = "open" | "sent" | "waiting" | "followup" | "done";

type FollowupRisk = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
  suggestion: string;
};

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;
  status: Status;
  createdAt?: string;
  risk?: FollowupRisk;
};

const WORKSPACE_ID = "ws_1";
const OWNER_ID = "u_1";

const STATUS_ORDER: Status[] = ["open", "sent", "waiting", "followup", "done"];

const API_BASE = ""; // same-origin on Cloudflare Pages

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

function parseYMD(s: string) {
  const v = (s || "").slice(0, 10);
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(ymd: string, days: number) {
  const dt = parseYMD(ymd) ?? new Date();
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function statusLabel(s: Status) {
  if (s === "open") return "Open";
  if (s === "sent") return "Sent";
  if (s === "waiting") return "Waiting";
  if (s === "followup") return "Follow-up";
  return "Done";
}

function nextStatus(s: Status): Status {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

function isValidYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function errorMessage(e: unknown, fallback: string): string {
  console.error("App error:", e);

  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;

  return fallback;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<Followup[]>([]);
const [q, setQ] = useState("");
const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("all");
const [sortMode, setSortMode] = useState<"risk" | "due" | "created">("risk");

const dashboardList = useMemo(() => {
  let list = [...items];

  // status
  if (statusFilter !== "all") {
    list = list.filter((f) => f.status === statusFilter);
  }

  // search
  const needle = q.trim().toLowerCase();
  if (needle) {
    list = list.filter((f) => {
      const hay = `${f.contactName ?? ""} ${f.companyName ?? ""} ${f.nextStep ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }

  // risk
  if (riskFilter !== "all") {
    list = list.filter((f) => f.risk?.level === riskFilter);
  }
  
  // risk-group: high(0) → medium(1) → low(2) → none(3)
const riskGroup = (f: Followup) => {
  const lvl = f.risk?.level;
  if (lvl === "high") return 0;
  if (lvl === "medium") return 1;
  if (lvl === "low") return 2;
  return 3;
};

const riskScore = (f: Followup) => (typeof f.risk?.score === "number" ? f.risk.score : -1);
const dueKey = (f: Followup) => (f.dueAt || "").slice(0, 10) || "9999-99-99";
const createdKey = (f: Followup) => f.createdAt || "";

// ✅ “Intelligent” sort: risk-groep eerst, daarna jouw gekozen sortMode
list.sort((a, b) => {
  const g = riskGroup(a) - riskGroup(b);
  if (g !== 0) return g;

  if (sortMode === "risk") return riskScore(b) - riskScore(a);        // hoog→laag binnen groep
  if (sortMode === "due") return dueKey(a).localeCompare(dueKey(b));  // vroeg→laat
  return createdKey(b).localeCompare(createdKey(a));                  // nieuw→oud
});

  return list;
}, [items, q, statusFilter, riskFilter, sortMode]);


  // Form state (create)
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [dueAt, setDueAt] = useState(todayYMD());

  // =========================
  // Step 7: inline edit state (draft per item-id)
  // =========================
 // Inline edit state
const [editNextId, setEditNextId] = useState<string | null>(null);
const [editDueId, setEditDueId] = useState<string | null>(null);
const [draftNextById, setDraftNextById] = useState<Record<string, string>>({});
const [draftDueById, setDraftDueById] = useState<Record<string, string>>({});

  const draftNext = (id: string) => draftNextById[id] ?? "";
  const draftDue = (id: string) => draftDueById[id] ?? "";

  // ---- KPIs
  const needsTodayCount = useMemo(() => {
  const today = todayYMD();
  return items.filter((f) => f.status !== "done" && (f.dueAt || "").slice(0, 10) === today).length;
}, [items]);

  const overdueCount = useMemo(() => {
    const today = todayYMD();
    return items.filter((f) => f.status !== "done" && (f.dueAt || "").slice(0, 10) < today).length;
  }, [items]);

  // ---- API

  async function safeFetch<T>(promise: Promise<T>, fallbackError: string): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    throw new Error(errorMessage(e, fallbackError));
  }
}
  
async function refreshAll() {
  setLoading(true);
  setErr(null);

  try {
    const fuRes = await fetch(
      apiUrl(`/api/followups?workspaceId=${encodeURIComponent(WORKSPACE_ID)}&includeRisk=1`),
      { headers: { Accept: "application/json" } }
    );

    if (!fuRes.ok) throw new Error(`Followups failed (${fuRes.status})`);
    const fuData = await fuRes.json();
    setItems(fuData.items || []);
  } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : "Failed to fetch";
  setErr(msg);
} finally {
  setLoading(false);
}
}
async function onCreate() {
  setLoading(true);
  setErr(null);

  try {
    const payload = {
      workspaceId: WORKSPACE_ID,
      ownerId: OWNER_ID,
      contactName: contactName.trim(),
      companyName: companyName.trim(),
      nextStep: nextStep.trim(),
      dueAt: (dueAt || "").trim(),
      status: "open" as Status,
    };

    if (!payload.contactName) throw new Error("Please enter a contact name.");
    if (!payload.nextStep) throw new Error("Please enter a next step.");
    if (!payload.dueAt) throw new Error("Please enter a due date (YYYY-MM-DD).");
    if (!isValidYMD(payload.dueAt)) throw new Error("Due date must be YYYY-MM-DD.");

    const res = await fetch(apiUrl("/api/followups"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Create failed (${res.status}) ${text ? "— " + text : ""}`);
    }

    await res.json().catch(() => null);

    setContactName("");
    setCompanyName("");
    setNextStep("");

    await refreshAll();
  } catch (e: unknown) {
    setErr(e instanceof Error ? e.message : "Create failed");
  } finally {
    setLoading(false);
  }
}

  async function patchFollowup(id: string, body: Partial<Pick<Followup, "status" | "dueAt" | "nextStep">>) {
    const res = await fetch(apiUrl(`/api/followups/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Patch failed (${res.status}) ${text ? "— " + text : ""}`);
    }

    await res.json().catch(() => null);
  }

  // ---- Actions (Move/Done/Reopen/Snooze)
  function transitionPlan(f: Followup) {
    const ns = nextStatus(f.status);
    const today = todayYMD();

    if (f.status === "open" && ns === "sent") return { status: ns, dueAt: addDays(today, 3) };
    if (f.status === "sent" && ns === "waiting") return { status: ns, dueAt: addDays(today, 7) };
    if (f.status === "waiting" && ns === "followup") return { status: ns, dueAt: today };
    if (f.status === "followup" && ns === "done") return { status: ns };
    return { status: ns };
  }

  async function onMove(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      const plan = transitionPlan(f);
      await patchFollowup(f.id, plan);
      await refreshAll();
    } catch (e: unknown) {
      setErr(errorMessage(e) || "Move failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDone(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(f.id, { status: "done" });
      await refreshAll();
    } catch (e: unknown) {
      setErr(e?.message || "Done failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReopen(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(f.id, { status: "open" });
      await refreshAll();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Reopen failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSnooze(f: Followup, days: number) {
    setLoading(true);
    setErr(null);
    try {
      const base = ((f.dueAt || todayYMD()).slice(0, 10) || todayYMD()).trim();
      await patchFollowup(f.id, { dueAt: addDays(base, days) });
      await refreshAll();
    } catch (e: unknown) {
      setErr(e?.message || "Snooze failed");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Step 7: inline edit handlers
  // =========================
  function startEditNext(f: Followup) {
    setEditDueId(null);
    setEditNextId(f.id);
    setDraftNextById((prev) => ({ ...prev, [f.id]: f.nextStep || "" }));
  }

  function cancelEditNext(id: string) {
    setEditNextId((cur) => (cur === id ? null : cur));
    // draft laten we staan, is ok voor "draft-variant"
  }

  async function saveEditNext(id: string) {
    const v = (draftNext(id) || "").trim();
    setEditNextId(null);
    if (!v) return;

    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(id, { nextStep: v });
      await refreshAll();
    } catch (e: unknown) {
      setErr(e?.message || "Save next step failed");
    } finally {
      setLoading(false);
    }
  }

  function startEditDue(f: Followup) {
    setEditNextId(null);
    setEditDueId(f.id);
    setDraftDueById((prev) => ({ ...prev, [f.id]: (f.dueAt || "").slice(0, 10) }));
  }

  function cancelEditDue(id: string) {
    setEditDueId((cur) => (cur === id ? null : cur));
  }

  async function saveEditDue(id: string) {
    const v = (draftDue(id) || "").trim();
    setEditDueId(null);
    if (!isValidYMD(v)) return;

    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(id, { dueAt: v });
      await refreshAll();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save due date failed");
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setContactName("");
    setCompanyName("");
    setNextStep("");
    setDueAt(todayYMD());
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riskCounts = useMemo(() => {
  const counts = { high: 0, medium: 0, low: 0, none: 0 };
  for (const f of items) {
    const level = f.risk?.level;
    if (level === "high") counts.high++;
    else if (level === "medium") counts.medium++;
    else if (level === "low") counts.low++;
    else counts.none++;
  }
  return counts;
}, [items]);

  return (
  <div className="page">
    <header className="appTopbar">
      <div className="appTopbarLeft">
        <h1 className="appTitle">FollowThrough</h1>
        <div className="appSubtitle">Risk Dashboard · Inline edit Next + Due</div>
      </div>

      <div className="appTopbarRight">
        <div className="appMeta">
          WS: <b>{WORKSPACE_ID}</b> · Items: <b>{items.length}</b>
        </div>
        <button className="iconBtn" onClick={refreshAll} disabled={loading} title="Refresh">
          {loading ? "…" : "↻"}
        </button>
      </div>
    </header>

{err ? (
      <div className="error">
        Error: {err}{" "}
        <button className="btn" onClick={refreshAll} disabled={loading} style={{ marginLeft: 8 }}>
          Retry
        </button>
      </div>
    ) : null}

    <div className="kpiBar">
      <span className="kpiChip kpiSoon">Need today: {needsTodayCount}</span>
      <span className="kpiChip kpiOverdue">Overdue: {overdueCount}</span>

      <span className="kpiChip kpiRiskHigh">High: {riskCounts.high}</span>
      <span className="kpiChip kpiRiskMed">Med: {riskCounts.medium}</span>
      <span className="kpiChip kpiRiskLow">Low: {riskCounts.low}</span>
    </div>

    {/* Create */}
    <section className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Create follow-up</h3>
        <div className="grid">
          <div className="field">
            <label>Contact name</label>
            <input
              id="contactName"
              className="input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={loading}
              placeholder="Alice Example"
            />
          </div>

          <div className="field">
            <label>Company</label>
            <input
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              placeholder="Example GmbH"
            />
          </div>

          <div className="field">
            <label>Next step</label>
            <input
              className="input"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              disabled={loading}
              placeholder="Send intro email"
            />
          </div>

          <div className="field">
            <label>Due at (YYYY-MM-DD)</label>
            <input
              className="input"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={loading}
              placeholder="2026-01-31"
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btnPrimary" onClick={onCreate} disabled={loading}>
            Add follow-up
          </button>

          <button className="btn" onClick={clearForm} disabled={loading}>
            Clear
          </button>
        </div>
      </section>

     {/* List */}
<section className="panel">
  <h3 style={{ marginTop: 0 }}>Follow-ups ({dashboardList.length})</h3>

  {/* Risk KPI chips (1x) */}
  <div className="kpis" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
    <span className="chip chipRisk chipRisk-high">High: {riskCounts.high}</span>
    <span className="chip chipRisk chipRisk-medium">Medium: {riskCounts.medium}</span>
    <span className="chip chipRisk chipRisk-low">Low: {riskCounts.low}</span>
  </div>

  {/* Filters (1x) */}
  <div className="toolbarRow">
    <div className="field" style={{ minWidth: 240 }}>
      <label>Search</label>
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={loading}
        placeholder="Search…"
      />
    </div>

    <div className="field" style={{ minWidth: 170 }}>
      <label>Status</label>
      <select
        className="select"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as any)}
        disabled={loading}
      >
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="sent">Sent</option>
        <option value="waiting">Waiting</option>
        <option value="followup">Follow-up</option>
        <option value="done">Done</option>
      </select>
    </div>

    <div className="field" style={{ minWidth: 140 }}>
      <label>Risk</label>
      <select
        className="select"
        value={riskFilter}
        onChange={(e) => setRiskFilter(e.target.value as any)}
        disabled={loading}
      >
        <option value="all">All</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>

    <div className="field" style={{ minWidth: 140 }}>
      <label>Sort</label>
      <select
        className="select"
        value={sortMode}
        onChange={(e) => setSortMode(e.target.value as any)}
        disabled={loading}
      >
        <option value="risk">Risk</option>
        <option value="due">Due</option>
        <option value="created">Created</option>
      </select>
    </div>

    <div className="toolbarRight">
      <button
        className="btn"
        onClick={() => {
          setQ("");
          setStatusFilter("all");
          setRiskFilter("all");
          setSortMode("risk");
        }}
        disabled={loading}
      >
        Clear filters
      </button>
    </div>
  </div>

  {/* 🔥 High-risk banner */}
  {riskCounts.high > 0 && riskFilter !== "high" ? (
    <div className="highRiskBanner">
      <span className="chip chipRisk chipRisk-high">High risk: {riskCounts.high}</span>
      <span style={{ opacity: 0.8 }}>Needs attention first</span>
      <button
        className="btn"
        onClick={() => {
          setRiskFilter("high");
          setSortMode("risk");
        }}
        disabled={loading}
        style={{ marginLeft: "auto" }}
      >
        Show high risk
      </button>
    </div>
  ) : null}

  {/* Empty / list states */}
  {loading && items.length === 0 ? (
    <div className="empty">
      <p>Loading…</p>
    </div>
  ) : items.length === 0 ? (
    <div className="empty">
      <p>No follow-ups yet.</p>
      <button
        className="btn"
        onClick={() => document.getElementById("contactName")?.focus()}
        disabled={loading}
      >
        Add your first follow-up
      </button>
    </div>
  ) : dashboardList.length === 0 ? (
    <div className="empty">
      <p>No results for these filters.</p>
      <button
        className="btn"
        onClick={() => {
          setQ("");
          setStatusFilter("all");
          setRiskFilter("all");
          setSortMode("risk");
        }}
        disabled={loading}
      >
        Clear filters
      </button>
    </div>
  ) : (
    <div className="list">
      {dashboardList.map((f) => {
        const today = todayYMD();
        const due = (f.dueAt || "").slice(0, 10);
        const overdue = f.status !== "done" && due && due < today;
        const cardClass = overdue ? "card cardOverdue" : "card";

        return (
          <div key={f.id} className={cardClass}>
            <div style={{ fontWeight: 700 }}>{f.contactName || "—"}</div>
            <div style={{ opacity: 0.8 }}>{f.companyName || "—"}</div>

            {/* NEXT step inline edit */}
            <div style={{ marginTop: 10 }}>
              <b>Next:</b>{" "}
              {editNextId === f.id ? (
                <input
                  className="input"
                  value={draftNext(f.id)}
                  autoFocus
                  disabled={loading}
                  onChange={(e) =>
                    setDraftNextById((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  onBlur={() => saveEditNext(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEditNext(f.id);
                    if (e.key === "Escape") cancelEditNext(f.id);
                  }}
                  style={{ maxWidth: 520 }}
                />
              ) : (
                <>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => startEditNext(f)}
                    style={{ cursor: "pointer" }}
                  >
                    {f.nextStep || "—"}
                  </span>
                  <button
                    className="btn"
                    title="Edit next step"
                    disabled={loading}
                    style={{ marginLeft: 6, padding: "2px 6px", fontSize: 12 }}
                    onClick={() => startEditNext(f)}
                  >
                    ✎
                  </button>
                </>
              )}
            </div>

            {/* META + DUE inline edit */}
            <div className="cardMeta" style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="chip chipOpen">{statusLabel(f.status)}</span>

              <span className="chip chipDue">
                Due:{" "}
                {editDueId === f.id ? (
                  <input
                    className="input"
                    value={draftDue(f.id)}
                    autoFocus
                    disabled={loading}
                    onChange={(e) =>
                      setDraftDueById((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                    onBlur={() => saveEditDue(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditDue(f.id);
                      if (e.key === "Escape") cancelEditDue(f.id);
                    }}
                    style={{ width: 140 }}
                    placeholder="YYYY-MM-DD"
                  />
                ) : (
                  <>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => startEditDue(f)}
                      style={{ cursor: "pointer", fontWeight: 700 }}
                      title="Click to edit due date"
                    >
                      {due || "—"}
                    </span>
                    <button
                      className="btn"
                      title="Edit due date"
                      disabled={loading}
                      style={{ marginLeft: 6, padding: "2px 6px", fontSize: 12 }}
                      onClick={() => startEditDue(f)}
                    >
                      ✎
                    </button>
                  </>
                )}
              </span>

              {overdue ? <span className="chip chipOverdue">Overdue</span> : null}
            </div>

            {f.risk ? (
              <>
                <span className={`chip chipRisk chipRisk-${f.risk.level}`}>
                  Risk: {f.risk.level} ({f.risk.score})
                </span>

                <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
                  <div><b>Why:</b> {f.risk.reasons.join(" · ")}</div>
                  <div><b>Next:</b> {f.risk.suggestion}</div>
                </div>
              </>
            ) : null}

            {/* ACTIONS */}
            <div className="cardActions" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => onMove(f)} disabled={loading}>Move</button>
              <button className="btn" onClick={() => onSnooze(f, 1)} disabled={loading}>+1d</button>
              <button className="btn" onClick={() => onSnooze(f, 3)} disabled={loading}>+3d</button>
              <button className="btn" onClick={() => onSnooze(f, 7)} disabled={loading}>+7d</button>

              {f.status !== "done" ? (
                <button className="btn" onClick={() => onDone(f)} disabled={loading}>Done</button>
              ) : (
                <button className="btn" onClick={() => onReopen(f)} disabled={loading}>Reopen</button>
              )}
            </div>

            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
              Id: <code>{f.id}</code>
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>
    </div>
  );
}
