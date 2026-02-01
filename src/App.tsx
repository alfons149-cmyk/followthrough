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
  status: string;
  createdAt?: string;
};

type Workspace = {
  id: string;
  name: string;
  createdAt?: string;
};

const WORKSPACE_ID = "ws_1";

// In productie (Cloudflare Pages) is same-origin correct.
// (API_BASE leeg laten)
const API_BASE = "";

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [items, setItems] = useState<Followup[]>([]);

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
      // 1) workspaces
      const wsRes = await fetch(apiUrl("/api/workspaces"), {
        headers: { Accept: "application/json" },
      });
      if (!wsRes.ok) throw new Error(`Workspaces failed (${wsRes.status})`);
      const wsData = await wsRes.json();
      setWorkspaces(wsData.items || []);

      // 2) followups
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

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <p className="tagline">Step 4 — Read-only API (GET workspaces + followups)</p>
      </header>

      {err ? (
        <div className="error">
          Error: {err}{" "}
          <button className="btn" onClick={refreshAll} disabled={loading} style={{ marginLeft: 8 }}>
            Retry
          </button>
        </div>
      ) : null}

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
        <h3 style={{ marginTop: 0 }}>Follow-ups ({items.length})</h3>

        {loading && items.length === 0 ? (
          <div className="empty">
            <p>Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p>No follow-ups yet.</p>
          </div>
        ) : (
          <div className="list">
            {items.map((f) => (
              <div key={f.id} className="card">
                <div style={{ fontWeight: 700 }}>{f.contactName || "—"}</div>
                <div style={{ opacity: 0.8 }}>{f.companyName || "—"}</div>

                <div style={{ marginTop: 8 }}>
                  <b>Next:</b> {f.nextStep || "—"}
                </div>

                <div className="cardMeta" style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span className="chip chipOpen">{f.status}</span>
                  <span className="chip chipDue">Due: {f.dueAt || "—"}</span>
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
