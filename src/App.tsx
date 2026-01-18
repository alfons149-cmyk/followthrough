import { useEffect, useMemo, useState } from "react";
import "./App.css";

// ---- Workflow definition (single source of truth) ----
const STATUS_ORDER = ["open", "sent", "waiting", "followup", "done"] as const;
type Status = typeof STATUS_ORDER[number];

function nextStatus(s: Status): Status {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

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

// ---- Date helpers (single source of truth) ----
function parseYMD(ymd: string) {
  const s = (ymd || "").slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
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

function dueBadge(dueAt: string) {
  const dt = parseYMD(dueAt);
  if (!dt) return { kind: "due" as const, label: "No date" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dt.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { kind: "overdue" as const, label: `Overdue (${Math.abs(diffDays)}d)` };
  if (diffDays <= 1) return { kind: "soon" as const, label: diffDays === 0 ? "Due today" : "Due tomorrow" };
  if (diffDays <= 7) return { kind: "soon" as const, label: `Due in ${diffDays}d` };
  return { kind: "due" as const, label: `Due in ${diffDays}d` };
}

function transitionPlan(f: Followup) {
  const current = f.status;
  const ns = nextStatus(current);

  const todayStr = addDays(formatDate(new Date().toISOString()), 0);
  const base = formatDate(f.dueAt) || todayStr;

  if (current === "open" && ns === "sent") return { status: ns, dueAt: addDays(base, 3) };
  if (current === "sent" && ns === "waiting") return { status: ns, dueAt: addDays(base, 7) };
  if (current === "waiting" && ns === "followup") return { status: ns, dueAt: addDays(base, 2) };
  if (current === "followup" && ns === "done") return { status: ns };
  return { status: ns };
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
            <button className="btn btnPrimary" onClick={() => advanceStatus(f)} disabled={loading}>
           Move → {nextStatus(f.status as Status)}
           </button>
            <button className="btn" onClick={() => api.patch(f.id, { status: f.status === "done" ? "open" : "done" }).then(refresh)} disabled={loading}>
  {f.status === "done" ? "Reopen" : "Mark done"}
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
                <option value="open">Open</option>
                <option value="open">Open</option>
                <option value="sent">Sent</option>
                <option value="waiting">Waiting</option>
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
                    <span className="metaItem" style={{ opacity: 0.6, fontSize: 12 }}>
  debug → dueAt: {String(f.dueAt)} · kind: {due.kind} · status: {f.status}
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
