import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string; // YYYY-MM-DD
  status: "open" | "sent" | "waiting" | "followup" | "done" | string;
  createdAt?: string;
};

type Workspace = {
  id: string;
  name: string;
  createdAt?: string;
};

const WORKSPACE_ID = "ws_1";

// Step 3: same-origin API base
const API_BASE = "";

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

const STATUS_ORDER = ["open", "sent", "waiting", "followup", "done"] as const;
type KnownStatus = (typeof STATUS_ORDER)[number];

function isKnownStatus(s: string): s is KnownStatus {
  return (STATUS_ORDER as readonly string[]).includes(s);
}

function nextStatus(current: string): KnownStatus {
  if (!isKnownStatus(current)) return "open";
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
}

function addDays(ymd: string, days: number) {
  // ymd: YYYY-MM-DD
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [items, setItems] = useState<Followup[]>([]);

  // form
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextStepText, setNextStepText] = useState("Send intro email");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  const needsTodayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((f) => f.dueAt === today && f.status !== "done").length;
  }, [items]);

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((f) => f.dueAt < today && f.status !== "done").length;
  }, [items]);

  async function refreshAll() {
    setLoading(true);
    setErr(null);
    try {
      const wsRes = await fetch(apiUrl(`/api/workspaces`), {
        headers: { Accept: "application/json" },
      });
      if (!wsRes.ok) throw new Error(`Workspaces failed (${wsRes.status})`);
      const wsData = await wsRes.json();
      setWorkspaces(wsData.items || []);

      const fuRes = await fetch(
        apiUrl(`/api/followups?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`),
        { headers: { Accept: "application/json" } }
      );
      if (!fuRes.ok) throw new Error(`Followups failed (${fuRes.status})`);
      const fuData = await fuRes.json();
      setItems(fuData.items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/followups`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          ownerId: "u_1",
          contactName,
          companyName,
          nextStep: nextStepText,
          dueAt,
          status: "open",
        }),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      await refreshAll();
      setContactName("");
      setCompanyName("");
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function patchFollowup(id: string, body: Partial<Pick<Followup, "status" | "dueAt" | "nextStep">>) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/followups/${encodeURIComponent(id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Patch failed (${res.status})`);
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Patch failed");
    } finally {
      setLoading(false);
    }
  }

  function advanceStatus(f: Followup) {
    const ns = nextStatus(f.status);
    patchFollowup(f.id, { status: ns });
  }

  function markDone(f: Followup) {
    patchFollowup(f.id, { status: "done" });
  }

  function reopen(f: Followup) {
    patchFollowup(f.id, { status: "open" });
  }

  function snooze(f: Followup, days: number) {
    const base = f.dueAt && /^\d{4}-\d{2}-\d{2}$/.test(f.dueAt) ? f.dueAt : new Date().toISOString().slice(0, 10);
    patchFollowup(f.id, { dueAt: addDays(base, days) });
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <p className="tagline">Step 3 — PATCH actions (move/done/snooze)</p>
      </header>

      {err ? <div className="error">Error: {err}</div> : null}

      <div className="kpis" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span className="chip chipSoon">Need today: {needsTodayCount}</span>
        <span className="chip chipOverdue">Overdue: {overdueCount}</span>
      </div>

      <section className="panel" style={{ marginBottom: 12 }}>
        <div style={{ opacity: 0.8 }}>
          Workspace: <b>{WORKSPACE_ID}</b> · API: <code>/api/followups</code>
        </div>
        <div style={{ marginTop: 8 }}>
          Workspaces loaded: <b>{workspaces.length}</b>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={refreshAll} disabled={loading}>
            Refresh
          </button>
        </div>
      </section>

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
            <input className="input" value={nextStepText} onChange={(e) => setNextStepText(e.target.value)} />
          </div>

          <div className="field">
            <label>Due at (YYYY-MM-DD)</label>
            <input className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btnPrimary" onClick={onCreate} disabled={loading || !contactName.trim()}>
            Add follow-up
          </button>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Follow-ups ({items.length})</h3>

        {items.length === 0 ? (
          <div className="empty">
            <p>No follow-ups yet.</p>
          </div>
        ) : (
          <div className="list">
            {items.map((f) => (
              <div key={f.id} className="card">
                <div style={{ fontWeight: 700 }}>{f.contactName || "—"}</div>
                <div style={{ opacity: 0.8 }}>{f.companyName || "—"}</div>

                <div className="cardMeta" style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span className="chip chipOpen">{f.status}</span>
                  <span className="chip chipDue">Due: {f.dueAt}</span>
                </div>

                <div style={{ marginTop: 8 }}>
                  <b>Next:</b> {f.nextStep || "—"}
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

                  {f.status !== "done" ? (
                    <button className="btn" onClick={() => markDone(f)} disabled={loading}>
                      Done
                    </button>
                  ) : (
                    <button className="btn" onClick={() => reopen(f)} disabled={loading}>
                      Reopen
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                  Id: <code>{f.id}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
