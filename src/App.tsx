import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;
  status: string; // "open" | "done" (jij gebruikt strings)
  createdAt: string;
};

type ListResponse = { items: Followup[] };
type CreateResponse = { ok: boolean; id?: string; error?: string };
type PatchResponse = { ok: boolean; item?: Followup; error?: string };

const DEFAULT_WORKSPACE = "ws_1";
const DEFAULT_OWNER = "u_1";

function App() {
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE);
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [contactName, setContactName] = useState("Bob Example");
  const [companyName, setCompanyName] = useState("ACME BV");
  const [nextStep, setNextStep] = useState("Call back");
  const [dueAt, setDueAt] = useState("2026-01-10");

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1));
  }, [items]);

  async function loadFollowups() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/followups?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      // Als je per ongeluk HTML terugkrijgt, zie je dat hier meteen:
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Geen JSON terug. Content-Type=${ct}. Eerste stuk:\n${text.slice(0, 200)}`);
      }

      if (!res.ok) throw new Error(`GET failed: ${res.status}`);

      const data = (await res.json()) as ListResponse;
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollowups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function createFollowup() {
    setErr(null);

    const payload = {
      workspaceId,
      ownerId: DEFAULT_OWNER,
      contactName,
      companyName,
      nextStep,
      dueAt,
      status: "open",
    };

    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`POST: geen JSON terug. Content-Type=${ct}. Eerste stuk:\n${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as CreateResponse;
      if (!res.ok || !data.ok) throw new Error(data.error || `POST failed: ${res.status}`);

      await loadFollowups();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function toggleDone(id: string, currentStatus: string) {
    setErr(null);

    const nextStatus = currentStatus === "done" ? "open" : "done";

    // Optimistic update (UI meteen aanpassen)
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: nextStatus } : x)));

    try {
      const res = await fetch(`/api/followups/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`PATCH: geen JSON terug. Content-Type=${ct}. Eerste stuk:\n${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as PatchResponse;
      if (!res.ok || !data.ok) throw new Error(data.error || `PATCH failed: ${res.status}`);

      // Sync met DB-resultaat
      if (data.item) {
        setItems((prev) => prev.map((x) => (x.id === id ? data.item! : x)));
      }
    } catch (e: any) {
      // rollback als het faalt
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: currentStatus } : x)));
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1>FollowThrough</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Workspace:{" "}
          <input
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value.trim())}
            style={{ padding: 6 }}
          />
        </label>

        <button onClick={loadFollowups} disabled={loading} style={{ padding: "6px 10px" }}>
          Refresh
        </button>

        <a href="/api/health" target="_blank" rel="noreferrer">
          /api/health
        </a>
      </div>

      {err && (
        <pre style={{ marginTop: 12, padding: 12, background: "#ffecec", whiteSpace: "pre-wrap" }}>
          {err}
        </pre>
      )}

      <hr style={{ margin: "16px 0" }} />

      <h2>Nieuwe followup</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          Contact
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Company
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Next step
          <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Due date (YYYY-MM-DD)
          <input value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
      </div>

      <button onClick={createFollowup} style={{ marginTop: 12, padding: "8px 12px" }}>
        Create
      </button>

      <hr style={{ margin: "16px 0" }} />

      <h2>Followups ({sorted.length})</h2>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {sorted.map((f) => (
            <li
              key={f.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {f.contactName} — {f.companyName}
                </div>
                <div style={{ opacity: 0.85 }}>{f.nextStep}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  due: {f.dueAt} • status: {f.status} • id: {f.id}
                </div>
              </div>

              <button onClick={() => toggleDone(f.id, f.status)} style={{ padding: "8px 12px", height: 40 }}>
                {f.status === "done" ? "Mark open" : "Mark done"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
