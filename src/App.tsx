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
const OWNER_ID = "u_1";

// In productie (Cloudflare Pages) is same-origin correct.
const API_BASE = "";

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [items, setItems] = useState<Followup[]>([]);

  // Form state
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [dueAt, setDueAt] = useState(todayYMD());

  const needsTodayCount = useMemo(() => {
    const today = todayYMD();
    return items.filter((f) => f.dueAt === today && f.status !== "done").length;
  }, [items]);

  const overdueCount = useMemo(() => {
    const today = todayYMD();
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
        status: "open",
      };

      // minimale checks (client-side)
      if (!payload.contactName) throw new Error("Please enter a contact name.");
      if (!payload.nextStep) throw new Error("Please enter a next step.");
      if (!payload.dueAt) throw new Error("Please enter a due date (YYYY-MM-DD).");

      const res = await fetch(apiUrl("/api/followups"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create failed (${res.status}) ${text ? "— " + text : ""}`);
      }

      // server returns { ok:true, id }
      await res.json().catch(() => null);

      // Clear form (hou datum staan, vaak handig)
      setContactName("");
      setCompanyName("");
      setNextStep("");

      // Refresh list
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
      setLoading(false); // refreshAll zet hem ook, maar bij error willen we zeker uit loading
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

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <p className="tagline">Step 5 — GET + POST (create)</p>
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
        <h3 style={{ marginTop: 0 }}>Follow-ups ({items.length})</h3>

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
