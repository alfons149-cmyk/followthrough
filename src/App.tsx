import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Status = "open" | "sent" | "waiting" | "done";

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;
  status: Status;
  createdAt: string;
};

function formatDate(s: string) {
  return s?.slice(0, 10) || "";
}

export default function App() {
  const workspaceId = "ws_1";

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

  // Pages Functions: same-origin API
  const API_BASE = ""; // leeg = dezelfde origin als de frontend

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

      async patch(
        id: string,
        body: Partial<Pick<Followup, "status" | "dueAt" | "nextStep">>
      ) {
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

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const list = await api.list();
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleStatus(f: Followup) {
    const nextStatus = f.status === "done" ? "open" : "done";
    setLoading(true);
    setError("");
    try {
      const updated = await api.patch(f.id, { status: nextStatus });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

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
  const ns = nextStatus(f.status as Status);
  setLoading(true);
  setError("");
  try {
    const updated = await api.patch(f.id, { status: ns });
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  } catch (e: any) {
    setError(e?.message || "Unknown error");
  } finally {
    setLoading(false);
  }
}

async function snooze(f: Followup, days: number) {
  const nextDue = addDays(formatDate(f.dueAt) || "1970-01-01", days);
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

    // --- A) Due-date helpers (overdue / soon / later) ---
  function dayStart(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function daysFromToday(dateStr: string) {
    const t = Date.parse(dateStr);
    if (!Number.isFinite(t)) return null;
    const today = dayStart(new Date()).getTime();
    const target = dayStart(new Date(t)).getTime();
    return Math.round((target - today) / 86400000); // days
  }

  function dueBadge(dueAt: string) {
    const d = daysFromToday(dueAt);
    if (d === null) return { label: "No date", kind: "due" as const };

    if (d < 0) return { label: `Overdue (${Math.abs(d)}d)`, kind: "overdue" as const };
    if (d === 0) return { label: "Due today", kind: "soon" as const };
    if (d === 1) return { label: "Due tomorrow", kind: "soon" as const };
    if (d <= 7) return { label: `Due in ${d}d`, kind: "soon" as const };
    return { label: `Due in ${d}d`, kind: "due" as const };
  }

  function nextStatus(s: Status): Status {
  if (s === "open") return "sent";
  if (s === "sent") return "waiting";
  if (s === "waiting") return "done";
  return "open"; // done -> open (als je terug wil)
}

function addDays(yyyyMmDd: string, days: number) {
  const t = Date.parse(yyyyMmDd);
  const base = Number.isFinite(t) ? new Date(t) : new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

  // --- B) Inline editing state ---
  const [editNextId, setEditNextId] = useState<string | null>(null);
  const [editDueId, setEditDueId] = useState<string | null>(null);
  const [draftNext, setDraftNext] = useState("");
  const [draftDue, setDraftDue] = useState("");

  async function saveNextStep(id: string) {
    const value = draftNext.trim();
    setEditNextId(null);

    // niets aanpassen als leeg
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

    // verwacht YYYY-MM-DD
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

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <div className="sub">
          Workspace: <b>{workspaceId}</b> · API: <code>/api/followups</code>
        </div>
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
            <input
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
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="toolbarRight">
            <div className="field" style={{ minWidth: 170 }}>
              <label>Sort</label>
              <select
                className="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="dueAt">Due date</option>
                <option value="createdAt">Created</option>
                <option value="company">Company</option>
              </select>
            </div>

            <div className="field" style={{ minWidth: 140 }}>
              <label>Direction</label>
              <select
                className="select"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as any)}
              >
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

      <h2 className="sectionTitle">Your followups</h2>

           <div className="list">
        {visible.map((f) => {
          const chipClass = f.status === "done" ? "chip chipDone" : "chip chipOpen";
          const due = dueBadge(f.dueAt);
          const dueClass =
            due.kind === "overdue" ? "chip chipOverdue" :
            due.kind === "soon" ? "chip chipSoon" :
            "chip chipDue";

          const cardClass =
            due.kind === "overdue" && f.status !== "done"
              ? "card cardOverdue"
              : "card";

          return (
            <div key={f.id} className={cardClass}>
              <div className="cardTop">
                <div>
                  <div className="cardTitle">
                    {f.contactName} <span>({f.companyName})</span>
                  </div>

                  {/* Next step: inline edit */}
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
                    {/* Due date: inline edit */}
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

                    <span className={chipClass}>{f.status}</span>

                    <span className="metaItem">
                      Id: <code>{f.id}</code>
                    </span>
                  </div>
                </div>

                <div className="cardActions">
  <button className="btn btnPrimary" onClick={() => advanceStatus(f)} disabled={loading}>
    Move → {nextStatus(f.status as any)}
  </button>

  <div className="miniRow">
    <button className="btn btnMini" onClick={() => snooze(f, 1)} disabled={loading}>Tomorrow</button>
    <button className="btn btnMini" onClick={() => snooze(f, 3)} disabled={loading}>+3 days</button>
    <button className="btn btnMini" onClick={() => snooze(f, 7)} disabled={loading}>+1 week</button>
  </div>

  <button className="btn" onClick={() => toggleStatus(f)} disabled={loading}>
    Toggle → {f.status === "done" ? "open" : "done"}
  </button>
</div>
              </div>
            </div>
          );
        })}

        {!loading && visible.length === 0 && (
          <div className="empty">No followups match your filters.</div>
        )}
      </div>
    </div>
  );
}
