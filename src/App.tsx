import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

// ==============================
// Workflow (single source of truth)
// ==============================
const STATUS_ORDER = ["open", "sent", "waiting", "followup", "done"] as const;
type Status = typeof STATUS_ORDER[number];

function nextStatus(s: Status): Status {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

function statusLabel(s: Status) {
  if (s === "open") return "Open";
  if (s === "sent") return "Sent";
  if (s === "waiting") return "Waiting";
  if (s === "followup") return "Follow-up";
  return "Done";
}

// ==============================
// Types
// ==============================
type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string; // "YYYY-MM-DD" or ISO-ish
  status: Status;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS"
};

function formatDate(s: string) {
  return s?.slice(0, 10) || "";
}

// ==============================
// Date helpers (single source of truth)
// ==============================
function parseYMD(ymd: string) {
  const s = (ymd || "").slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d); // local time
}

function todayYMD() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(ymd: string, days: number) {
  const dt = parseYMD(ymd) ?? new Date();
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isOverdue(dueAt: string) {
  const dt = parseYMD(dueAt);
  if (!dt) return false;
  const today = parseYMD(todayYMD())!;
  dt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return dt.getTime() < today.getTime();
}

function isToday(ymd: string) {
  const dt = parseYMD(ymd);
  if (!dt) return false;
  const today = parseYMD(todayYMD())!;
  dt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return dt.getTime() === today.getTime();
}

function dueBadge(dueAt: string) {
  const dt = parseYMD(dueAt);
  if (!dt) return { kind: "due" as const, label: "No date" };

  const today = parseYMD(todayYMD())!;
  dt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dt.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { kind: "overdue" as const, label: `Overdue (${Math.abs(diffDays)}d)` };
  if (diffDays === 0) return { kind: "soon" as const, label: "Due today" };
  if (diffDays === 1) return { kind: "soon" as const, label: "Due tomorrow" };
  if (diffDays <= 7) return { kind: "soon" as const, label: `Due in ${diffDays}d` };
  return { kind: "due" as const, label: `Due in ${diffDays}d` };
}

function needsFollowupToday(f: Followup) {
  if (f.status === "done") return false;
  if (f.status === "followup") return true;
  const due = dueBadge(f.dueAt);
  return due.kind === "overdue" || isToday(f.dueAt);
}

// Overdue auto-advance: sent/waiting overdue -> followup
function autoAdvanceIfOverdue(f: Followup) {
  if (!isOverdue(f.dueAt)) return null;
  if (f.status === "sent" || f.status === "waiting") {
    return { status: "followup" as const };
  }
  return null;
}

// ==============================
// Workflow planner for Move button
// ==============================
function transitionPlan(f: Followup) {
  const current = f.status;
  const ns = nextStatus(current);

  const today = todayYMD();
  const base = formatDate(f.dueAt) || today;

  const baseDt = parseYMD(base);
  const todayDt = parseYMD(today)!;
  const baseSafe = baseDt && baseDt.getTime() < todayDt.getTime() ? today : base;

  if (current === "open" && ns === "sent") return { status: ns, dueAt: addDays(today, 3) };
  if (current === "sent" && ns === "waiting") return { status: ns, dueAt: addDays(today, 7) };
  if (current === "waiting" && ns === "followup") return { status: ns, dueAt: today };
  if (current === "followup" && ns === "done") return { status: ns };
  if (current === "done") return { status: "done" as const };

  return { status: ns, dueAt: baseSafe };
}

// ==============================
// Component
// ==============================

function isOverdueAndNotDone(f: Followup) {
  if (f.status === "done") return false;
  return isOverdue(f.dueAt);
}

export default function App() {
  const workspaceId = "ws_1";
  const API_BASE = ""; // same-origin

  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // create form
  const [contactName, setContactName] = useState("Alice Example");
  const [companyName, setCompanyName] = useState("Example GmbH");
  const [nextStep, setNextStep] = useState("Send intro email");
  const [dueAt, setDueAt] = useState("2026-01-10");

  // filter/sort UI state
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [sortBy, setSortBy] = useState<"dueAt" | "createdAt" | "company">("dueAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const firstOverdueRef = useRef<HTMLDivElement | null>(null);

  // inline edit
  const [editNextId, setEditNextId] = useState<string | null>(null);
  const [editDueId, setEditDueId] = useState<string | null>(null);
  const [draftNext, setDraftNext] = useState("");
  const [draftDue, setDraftDue] = useState("");

  const api = useMemo(() => {
    const base = API_BASE.replace(/\/+$/, "");
    
    return {
      async list() {
        const url = `${base}/api/followups?workspaceId=${encodeURIComponent(workspaceId)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`List failed (${res.status})`);
        const data = await res.json();
        return (data.items || []) as Followup[];
      },

      async create() {
        const url = `${base}/api/followups`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ownerId: "u_1",
            contactName,
            companyName,
            nextStep,
            dueAt,
            status: "open",
          }),
        });
        if (!res.ok) throw new Error(`Create failed (${res.status})`);
        return res.json() as Promise<{ ok: boolean; id: string }>;
      },

      async patch(id: string, body: Partial<Pick<Followup, "status" | "dueAt" | "nextStep">>) {
        const url = `${base}/api/followups/${encodeURIComponent(id)}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Patch failed (${res.status})`);
        const data = await res.json();
        return data.item as Followup;
      },
    };
  }, [API_BASE, workspaceId, contactName, companyName, nextStep, dueAt]);

  // ✅ visible list (ONLY ONCE)
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const filtered = items.filter((f) => {
      const matchesStatus = statusFilter === "all" ? true : f.status === statusFilter;
      const matchesQuery =
        !needle ||
        `${f.contactName} ${f.companyName} ${f.nextStep}`.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });

    const getTime = (s: string) => {
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : 0;
    };

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "dueAt") cmp = getTime(a.dueAt) - getTime(b.dueAt);
      if (sortBy === "createdAt") cmp = getTime(a.createdAt) - getTime(b.createdAt);
      if (sortBy === "company") cmp = a.companyName.localeCompare(b.companyName);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [items, q, statusFilter, sortBy, sortDir]);

  // ✅ counter across ALL items (not filtered)
const needsTodayCount = useMemo(() => {
  return items.filter(needsFollowupToday).length;
}, [items]);

// ✅ overdue counter across ALL items (not filtered)
const overdueCount = useMemo(() => {
  return items.filter(isOverdueAndNotDone).length;
}, [items]);


  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const list = await api.list();

      // 🔁 auto-advance overdue items
      for (const f of list) {
        const patch = autoAdvanceIfOverdue(f);
        if (patch) {
          await api.patch(f.id, patch);
        }
      }

      // opnieuw ophalen zodat UI & DB synchroon zijn
      const updated = await api.list();
      setItems(updated);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  if (overdueCount === 0) return;
  const el = firstOverdueRef.current;
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });
}, [visible, overdueCount]);

  async function onCreate() {
    setLoading(true);
    setError("");
    try {
      await api.create();
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function advanceStatus(f: Followup) {
    const plan = transitionPlan(f);

    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(f.id, plan);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function snooze(f: Followup, days: number) {
    const nextDue = addDays(formatDate(f.dueAt) || todayYMD(), days);

    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(f.id, { dueAt: nextDue });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function markDone(f: Followup) {
    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(f.id, { status: "done" });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function reopen(f: Followup) {
    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(f.id, { status: "open" });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function saveNextStep(id: string) {
    const value = draftNext.trim();
    setEditNextId(null);
    if (!value) return;

    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(id, { nextStep: value });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function saveDueAt(id: string) {
    const value = draftDue.trim();
    setEditDueId(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;

    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(id, { dueAt: value });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }
  let firstAssigned = false;
  return (
    <div className="page">
      <header className="header">
  <h1 className="title">FollowThrough</h1>

  <div className="sub">
    Workspace: <b>{workspaceId}</b> · API: <code>/api/followups</code>
    <span style={{ marginLeft: 10, opacity: 0.6 }}>build: 2026-01-19 18:00</span>
  </div>

  {overdueCount > 0 && (
  <div
    className="sub"
    style={{
      marginTop: 6,
      color: "#c62828", // rood
      fontWeight: 600,
    }}
  >
    ⏰ Overdue: {overdueCount}
  </div>
)}

  {needsTodayCount > 0 && (
    <div className="alert" style={{ marginTop: 12 }}>
      📌 Follow-ups that need your attention today: <b>{needsTodayCount}</b>
    </div>
  )}
</header>
      
      {error && (
        <div className="alert">
          <b>Error:</b> {error}
        </div>
      )}

      <section className="panel">
        <div className="grid">
          <div className="field">
            <label>Contact name</label>
            <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>

          <div className="field">
            <label>Company</label>
            <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>

          <div className="field">
            <label>Next step</label>
            <input className="input" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
          </div>

          <div className="field">
            <label>Due at (YYYY-MM-DD)</label>
            <input className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbarLeft">
            <button className="btn btnPrimary" onClick={onCreate} disabled={loading}>
              + Add followup
            </button>
            <button className="btn" onClick={refresh} disabled={loading}>
              Refresh
            </button>
            {loading && <span className="loading">Loading…</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="toolbarLeft">
            <div className="field" style={{ minWidth: 260 }}>
              <label>Search</label>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Alice, Example GmbH, intro…"
              />
            </div>

            <div className="field" style={{ minWidth: 160 }}>
              <label>Status</label>
              <select
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="sent">Sent</option>
                <option value="waiting">Waiting</option>
                <option value="followup">Follow-up</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="toolbarRight">
            <div className="field" style={{ minWidth: 170 }}>
              <label>Sort</label>
              <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="dueAt">Due date</option>
                <option value="createdAt">Created</option>
                <option value="company">Company</option>
              </select>
            </div>

            <div className="field" style={{ minWidth: 140 }}>
              <label>Direction</label>
              <select className="select" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>

            <button
              className="btn"
              onClick={() => {
                setQ("");
                setStatusFilter("all");
                setSortBy("dueAt");
                setSortDir("asc");
              }}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </div>
      </section>

<div className="list">
  {visible.map((f) => {
    const due = dueBadge(f.dueAt);

    const dueClass =
      due.kind === "overdue"
        ? "chip chipOverdue"
        : due.kind === "soon"
        ? "chip chipSoon"
        : "chip chipDue";

    const chipClass =
      f.status === "done"
        ? "chip chipDone"
        : f.status === "followup"
        ? "chip chipOverdue"
        : f.status === "waiting"
        ? "chip chipSoon"
        : f.status === "sent"
        ? "chip chipDue"
        : "chip chipOpen";

    const cardClass =
      due.kind === "overdue" && f.status !== "done"
        ? "card cardOverdue"
        : "card";

    const isFirstOverdue =
      !firstAssigned && f.status !== "done" && due.kind === "overdue";

    if (isFirstOverdue) firstAssigned = true;

    return (
      <div
        key={f.id}
        ref={isFirstOverdue ? firstOverdueRef : null}
        className={cardClass}
      >
        {/* ===== JOUW CARD INHOUD ===== */}

        <div>
          <div className="cardTitle">
            {f.contactName} <span>({f.companyName})</span>
          </div>

          <div className="cardLine">
            <b>Next:</b>{" "}
            {editNextId === f.id ? (
              <input
                className="inlineInput"
                value={draftNext}
                autoFocus
                onChange={(e) => setDraftNext(e.target.value)}
                onBlur={() => saveNextStep(f.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNextStep(f.id);
                  if (e.key === "Escape") setEditNextId(null);
                }}
              />
            ) : (
              <span
                className="inlineValue"
                title="Click to edit"
                onClick={() => {
                  setEditNextId(f.id);
                  setDraftNext(f.nextStep || "");
                }}
              >
                {f.nextStep}
              </span>
            )}
          </div>

          <div className="cardMeta">
            <span className="metaItem">
              Due:{" "}
              {editDueId === f.id ? (
                <input
                  className="inlineInput inlineDate"
                  value={draftDue}
                  autoFocus
                  onChange={(e) => setDraftDue(e.target.value)}
                  onBlur={() => saveDueAt(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDueAt(f.id);
                    if (e.key === "Escape") setEditDueId(null);
                  }}
                />
              ) : (
                <span
                  className="inlineValue"
                  title="Click to edit"
                  onClick={() => {
                    setEditDueId(f.id);
                    setDraftDue(formatDate(f.dueAt));
                  }}
                >
                  <b>{formatDate(f.dueAt)}</b>
                </span>
              )}
            </span>

            <span className={dueClass}>{due.label}</span>
            <span className={chipClass}>{statusLabel(f.status)}</span>

            <span className="metaItem">
              Id: <code>{f.id}</code>
            </span>
          </div>
        </div>

        {/* ===== EINDE CARD INHOUD ===== */}
      </div>
   );
  })}

   {!loading && visible.length === 0 && (
    <div className="empty">No followups match your filters.</div>
  )}
</div> {/* einde .list */}

</div> {/* einde .page */}
  );
}
