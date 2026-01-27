import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

// ==============================
// Workflow (single source of truth)
// ==============================
const STATUS_ORDER = ["open", "sent", "waiting", "followup", "done"] as const;
type Status = (typeof STATUS_ORDER)[number];

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

function isOverdueAndNotDone(f: Followup) {
  if (f.status === "done") return false;
  return isOverdue(f.dueAt);
}

export default function App() {
  const workspaceId = "ws_1";
  const url = `/api/followups?workspaceId=${workspaceId}`;

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
  const [sortBy] = useState<"dueAt" | "createdAt" | "company">("dueAt");
  const [sortDir] = useState<"asc" | "desc">("asc");

  // inline edit state (draft-variant)
  const [editNextId, setEditNextId] = useState<string | null>(null);
  const [editDueId, setEditDueId] = useState<string | null>(null);
  const [draftNext, setDraftNext] = useState("");
  const [draftDue, setDraftDue] = useState("");

  // scroll target
  const firstOverdueRef = useRef<HTMLDivElement | null>(null);

  function seedDemoData() {
    const t = todayYMD();
    setItems([
      {
        id: "demo_1",
        workspaceId,
        ownerId: "u_1",
        contactName: "Laura Smith",
        companyName: "Bright Consulting",
        nextStep: "Send proposal",
        dueAt: t,
        status: "followup",
        createdAt: t,
      },
      {
        id: "demo_2",
        workspaceId,
        ownerId: "u_1",
        contactName: "Mark Johnson",
        companyName: "TechNova",
        nextStep: "Call about pricing",
        dueAt: addDays(t, 3),
        status: "waiting",
        createdAt: t,
      },
      {
        id: "demo_3",
        workspaceId,
        ownerId: "u_1",
        contactName: "Ana López",
        companyName: "Soluciones SL",
        nextStep: "Follow up after meeting",
        dueAt: addDays(t, -2),
        status: "sent",
        createdAt: t,
      },
    ]);
  }

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

  // visible list (filter + sort)
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const filtered = items.filter((f) => {
      const matchesStatus = statusFilter === "all" ? true : f.status === statusFilter;
      const matchesQuery =
        !needle || `${f.contactName} ${f.companyName} ${f.nextStep}`.toLowerCase().includes(needle);
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

  // counters across ALL items
  const needsTodayCount = useMemo(() => items.filter(needsFollowupToday).length, [items]);
  const overdueCount = useMemo(() => items.filter(isOverdueAndNotDone).length, [items]);

  // first overdue item in visible list
  const firstOverdueId = useMemo(() => {
    const first = visible.find((f) => f.status !== "done" && dueBadge(f.dueAt).kind === "overdue");
    return first?.id ?? null;
  }, [visible]);

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const list = await api.list();

      // auto-advance overdue items
      for (const f of list) {
        const patch = autoAdvanceIfOverdue(f);
        if (patch) {
          await api.patch(f.id, patch);
        }
      }

      const updated = await api.list();
      setItems(updated);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // auto-load on first mount
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // scroll to first overdue in visible list
  useEffect(() => {
    if (!firstOverdueId) return;
    const el = firstOverdueRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [firstOverdueId]);

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
    const v = draftNext.trim();
    setEditNextId(null);
    if (!v) return;

    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(id, { nextStep: v });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function saveDueAt(id: string) {
    const v = draftDue.trim();
    setEditDueId(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;

    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(id, { dueAt: v });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <p className="tagline">Never forget a business follow-up again.</p>

        {import.meta.env.DEV && (
          <div className="sub">
            Workspace: <b>{workspaceId}</b> · API: <code>/api/followups</code>
            <span style={{ marginLeft: 10, opacity: 0.6 }}>build: 2026-01-19 18:00</span>
          </div>
        )}
      </header>

      {/* Errors / counters */}
      {error && (
        <div className="errorBanner">
          <b>Error:</b> {error}
        </div>
      )}

            <div
        className="kpis"
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}
      >
        <span className="chip chipSoon">Need today: {needsTodayCount}</span>
        <span className="chip chipOverdue">Overdue: {overdueCount}</span>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="empty">
          <h2>Welcome to FollowThrough 👋</h2>
          <p>Your personal system for never forgetting business follow-ups.</p>

          <ul style={{ textAlign: "left", marginTop: 12 }}>
            <li>📌 Track who to follow up with</li>
            <li>⏰ Get reminded at the right moment</li>
            <li>✅ Build a professional follow-up routine</li>
          </ul>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={seedDemoData} disabled={loading}>
              Try with example data
            </button>
            <button
              className="btn btnPrimary"
              onClick={() => document.getElementById("contactName")?.focus()}
              disabled={loading}
            >
              Add your first follow-up
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h3>No matches</h3>
          <p>Try clearing search or changing the status filter.</p>
          <button
            className="btn"
            onClick={() => {
              setQ("");
              setStatusFilter("all");
            }}
            disabled={loading}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="list">
          {visible.map((f) => {
            const { id, contactName, companyName, nextStep: ns, dueAt: da, status } = f;

            const due = dueBadge(da);
            const dueClass =
              due.kind === "overdue"
                ? "chip chipOverdue"
                : due.kind === "soon"
                ? "chip chipSoon"
                : "chip chipDue";

            const chipClass =
              status === "done"
                ? "chip chipDone"
                : status === "followup"
                ? "chip chipOverdue"
                : status === "waiting"
                ? "chip chipSoon"
                : status === "sent"
                ? "chip chipDue"
                : "chip chipOpen";

            const cardClass = due.kind === "overdue" && status !== "done" ? "card cardOverdue" : "card";
            const attachRef = firstOverdueId === id;

            return (
              <div key={id} className={cardClass} ref={attachRef ? firstOverdueRef : undefined}>
                {/* Next step inline edit */}
                <div className="cardLine">
                  <b>Next:</b>{" "}
                  {editNextId === id ? (
                    <input
                      className="input"
                      value={draftNext}
                      autoFocus
                      disabled={loading}
                      onChange={(e) => setDraftNext(e.target.value)}
                      onBlur={() => saveNextStep(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveNextStep(id);
                        if (e.key === "Escape") setEditNextId(null);
                      }}
                      style={{ maxWidth: 520 }}
                    />
                  ) : (
                    <>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setEditNextId(id);
                          setDraftNext(ns || "");
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {ns || "—"}
                      </span>

                      <button
                        className="btn"
                        title="Edit next step"
                        disabled={loading}
                        style={{ marginLeft: 6, padding: "2px 6px", fontSize: 12 }}
                        onClick={() => {
                          setEditNextId(id);
                          setDraftNext(ns || "");
                        }}
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>

                <div style={{ fontWeight: 600, marginTop: 8 }}>{contactName}</div>
                <div style={{ opacity: 0.8 }}>{companyName}</div>

                <div className="cardMeta" style={{ marginTop: 10 }}>
                  <span className="metaItem">
                    Due:{" "}
                    {editDueId === id ? (
                      <input
                        className="input"
                        value={draftDue}
                        autoFocus
                        disabled={loading}
                        onChange={(e) => setDraftDue(e.target.value)}
                        onBlur={() => saveDueAt(id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDueAt(id);
                          if (e.key === "Escape") setEditDueId(null);
                        }}
                        style={{ width: 140 }}
                        placeholder="YYYY-MM-DD"
                      />
                    ) : (
                      <>
                        <b
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setEditDueId(id);
                            setDraftDue(formatDate(da) || "");
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {formatDate(da)}
                        </b>

                        <button
                          className="btn"
                          title="Edit due date"
                          disabled={loading}
                          style={{ marginLeft: 6, padding: "2px 6px", fontSize: 12 }}
                          onClick={() => {
                            setEditDueId(id);
                            setDraftDue(formatDate(da) || "");
                          }}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </span>

                  <span className={dueClass}>{due.label}</span>
                  <span className={chipClass}>{statusLabel(status)}</span>

                  <span className="metaItem">
                    Id: <code>{id}</code>
                  </span>
                </div>

                <div className="cardActions" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => advanceStatus(f)} disabled={loading}>
                    Move
                  </button>
                  <button className="btn" onClick={() => snooze(f, 1)} disabled={loading}>
                    +1d
                  </button>
                  <button className="btn" onClick={() => snooze(f, 3)} disabled={loading}>
                    +3d
                  </button>
                  <button className="btn" onClick={() => snooze(f, 7)} disabled={loading}>
                    +7d
                  </button>

                  {status !== "done" ? (
                    <button className="btn" onClick={() => markDone(f)} disabled={loading}>
                      Done
                    </button>
                  ) : (
                    <button className="btn" onClick={() => reopen(f)} disabled={loading}>
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create / Refresh */}
      <section className="panel">
        <div className="grid">
          <div className="field">
            <label>Contact name</label>
            <input
              id="contactName"
              className="input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Company</label>
            <input
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Next step</label>
            <input
              className="input"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Due at (YYYY-MM-DD)</label>
            <input
              className="input"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <button className="btn" onClick={onCreate} disabled={loading}>
            Add follow-up
          </button>

          <button
            className="btn"
            onClick={refresh}
            disabled={loading}
            style={{ marginLeft: 8 }}
          >
            Refresh
          </button>
        </div>
      </section>
    </div>
  );
}
