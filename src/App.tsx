import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;   // TEXT
  status: string;  // "open" | "done" (of wat jij gebruikt)
  createdAt: string;
};

function formatDate(s: string) {
  // verwacht: "YYYY-MM-DD" of ISO string; toon gewoon leesbaar
  return s?.slice(0, 10) || "";
}

function App() {
  const workspaceId = "ws_1";

  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // simpele create form
  const [contactName, setContactName] = useState("Alice Example");
  const [companyName, setCompanyName] = useState("Example GmbH");
  const [nextStep, setNextStep] = useState("Send intro email");
  const [dueAt, setDueAt] = useState("2026-01-10");

  // Belangrijk:
  // - In productie: "/api/..." werkt op dezelfde domain (followthrough.pages.dev)
  // - In lokaal dev: we zetten zo meteen een proxy in vite.config.ts zodat "/api" ook werkt.
  fetch("/api/followups?workspaceId=...")


  const api = useMemo(() => ({
    async list() {
      const res = await fetch(`${API_BASE}/api/followups?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) throw new Error(`List failed (${res.status})`);
      const data = await res.json();
      return (data.items || []) as Followup[];
    },

    async create() {
            fetch("/api/followups", { method: "POST", ... })
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
      const res = await fetch(`${API_BASE}/api/followups/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Patch failed (${res.status})`);
      const data = await res.json();
      return data.item as Followup;
    },
  }), [API_BASE, workspaceId, contactName, companyName, nextStep, dueAt]);

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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, textAlign: "left" }}>
      <h1 style={{ marginBottom: 6 }}>FollowThrough</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Workspace: <b>{workspaceId}</b> · API: <code>/api/followups</code>
      </div>

      {error && (
        <div style={{ background: "#ffe9e9", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <b>Error:</b> {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label>Contact name</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label>Company</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label>Next step</label>
          <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <label>Due at (YYYY-MM-DD)</label>
          <input value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button onClick={onCreate} disabled={loading}>+ Add followup</button>
        <button onClick={refresh} disabled={loading}>Refresh</button>
        {loading && <span style={{ opacity: 0.7 }}>Loading…</span>}
      </div>

      <h2 style={{ marginBottom: 10 }}>Your followups</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((f) => (
          <div key={f.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {f.contactName} <span style={{ fontWeight: 400, opacity: 0.7 }}>({f.companyName})</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <b>Next:</b> {f.nextStep}
                </div>
                <div style={{ marginTop: 6, opacity: 0.8 }}>
                  Due: <b>{formatDate(f.dueAt)}</b> · Status: <b>{f.status}</b> · Id: <code>{f.id}</code>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
                <button onClick={() => toggleStatus(f)} disabled={loading}>
                  Toggle → {f.status === "done" ? "open" : "done"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div style={{ opacity: 0.7 }}>
            No followups yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
