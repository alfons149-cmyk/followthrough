import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;   // TEXT in DB
  status: string;  // "open" | "done" etc
  createdAt: string;
};

type ListResponse = { items: Followup[] };
type OneResponse = { ok: boolean; item?: Followup; error?: string };

function App() {
  // In productie is dit dezelfde origin (""), in dev kun je hem zetten via .env.local (zie stap 4)
  const API_BASE = import.meta.env.VITE_API_BASE ?? "";
  const api = useMemo(() => API_BASE.replace(/\/+$/, ""), [API_BASE]);

  const [workspaceId, setWorkspaceId] = useState("ws_1");
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${api}/api/followups?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      const data = (await res.json()) as ListResponse;
      setItems(data.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(f: Followup) {
    const next = f.status === "done" ? "open" : "done";

    // Optimistic update
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: next } : x)));

    try {
      const res = await fetch(`${api}/api/followups/${encodeURIComponent(f.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);

      const data = (await res.json()) as OneResponse;
      if (!data.ok || !data.item) throw new Error(data.error || "PATCH returned not ok");

      // sync with DB response
      setItems((prev) => prev.map((x) => (x.id === f.id ? data.item! : x)));
    } catch (e: any) {
      // rollback on error
      setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: f.status } : x)));
      alert(e?.message ?? "PATCH error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <h1>Followthrough</h1>

        <div className="controls">
          <label>
            Workspace&nbsp;
            <input
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="ws_1"
            />
          </label>
          <button onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {err && <div className="error">Error: {err}</div>}

      <main className="list">
        {items.length === 0 && !loading ? (
          <div className="empty">Nog geen followups. (Tip: seed of POST er eentje.)</div>
        ) : (
          items.map((f) => (
            <div key={f.id} className={`card ${f.status === "done" ? "done" : ""}`}>
              <div className="row">
                <div>
                  <div className="title">
                    {f.contactName} <span className="muted">— {f.companyName}</span>
                  </div>
                  <div className="meta">
                    <span className="pill">{f.status}</span>
                    <span className="muted">Due: {f.dueAt}</span>
                    <span className="muted">ID: {f.id}</span>
                  </div>
                </div>

                <button className="btn" onClick={() => toggleStatus(f)}>
                  Toggle
                </button>
              </div>

              <div className="nextStep">
                <strong>Next step:</strong> {f.nextStep}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default App;
