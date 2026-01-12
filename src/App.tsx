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
  status: string; // "open" | "done"
  createdAt: string;
};

type ListResponse = { items: Followup[] };
type CreateResponse = { ok: boolean; id?: string; error?: string };
type PatchResponse = { ok: boolean; item?: Followup; error?: string };

const DEFAULT_WORKSPACE = "ws_1";
const DEFAULT_OWNER = "u_1";

function pillStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid #ddd",
  };
  if (status === "done") return { ...base, background: "#eef9ee" };
  if (status === "open") return { ...base, background: "#fff7e6" };
  return { ...base, background: "#f3f3f3" };
}

async function expectJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Geen JSON terug (Content-Type=${ct}). Dit betekent meestal: route niet gematcht → SPA (Vite) HTML.\n\nEerste stuk:\n${text.slice(
        0,
        250
      )}`
    );
  }
  return res.json();
}

export default function App() {
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE);
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [contactName, setContactName] = useState("Bob Example");
  const [companyName, setCompanyName] = useState("ACME BV");
  const [nextStep, setNextStep] = useState("Call back");
  const [dueAt, setDueAt] = useState("2026-01-10");

  const counts = useMemo(() => {
    const open = items.filter((x) => x.status === "open").length;
    const done = items.filter((x) => x.status === "done").length;
    return { open, done, total: items.length };
  }, [items]);

  const sorted = useMemo(() => {
    // sort by dueAt (desc)
    return [...items].sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1));
  }, [items]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/followups?workspaceId=${encodeURIComponent(workspaceId)}`,
        { headers: { Accept: "application/json" } }
      );
      const data = (await expectJson(res)) as ListResponse;
      if (!res.ok) throw new Error(`GET failed: ${res.status}`);
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function create() {
    setErr(null);
    try {
      const payload = {
        workspaceId,
        ownerId: DEFAULT_OWNER,
        contactName,
        companyName,
        nextStep,
        dueAt,
        status: "open",
      };

      const res = await fetch("/api/followups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await expectJson(res)) as CreateResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `POST failed: ${res.status}`);
      }

      // Reload list (simple + reliable)
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function toggleStatus(id: string, current: string) {
    setErr(null);
    const next = current === "done" ? "open" : "done";

    // optimistic update
    setBusyId(id);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: next } : x)));

    try {
      const res = await fetch(`/api/followups/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ status: next }),
      });

      const data = (await expectJson(res)) as PatchResponse;
      if (!res.ok || !data.ok || !data.item) {
        throw new Error(data.error || `PATCH failed: ${res.status}`);
      }

      // sync with DB
      setItems((prev) => prev.map((x) => (x.id === id ? data.item! : x)));
    } catch (e: any) {
      // rollback
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: current } : x)));
      setErr(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.4 }}>FollowThrough</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Never let an important follow-up slip through again.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.75 }}>Workspace</span>
            <input
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value.trim())}
              style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          <a href="/api/health" target="_blank" rel="noreferrer" style={{ opacity: 0.8 }}>
            /api/health
          </a>
        </div>
      </div>

      {/* Error */}
      {err && (
        <pre
          style={{
            marginTop: 14,
            padding: 12,
            background: "#fff0f0",
            border: "1px solid #ffd2d2",
            borderRadius: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </pre>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 700 }}>Open</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{counts.open}</div>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 700 }}>Done</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{counts.done}</div>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 700 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{counts.total}</div>
        </div>
      </div>

      {/* Create */}
      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 18, padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Add follow-up</div>
        <div style={{ opacity: 0.75, marginTop: 4 }}>Create a new follow-up for workspace {workspaceId}.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Contact</div>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Company</div>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Next step</div>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Due date (YYYY-MM-DD)</div>
            <input
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </label>
        </div>

        <button
          onClick={create}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid #ddd",
            background: "black",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Create follow-up
        </button>
      </div>

      {/* List */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Follow-ups</div>

        {loading ? (
          <p>Loading…</p>
        ) : sorted.length === 0 ? (
          <div style={{ border: "1px dashed #ddd", borderRadius: 18, padding: 16, opacity: 0.8 }}>
            No followups yet. Create one above.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sorted.map((f) => (
              <div
                key={f.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 18,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>
                      {f.contactName} <span style={{ opacity: 0.5 }}>·</span> {f.companyName}
                    </div>
                    <span style={pillStyle(f.status)}>{f.status}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>due: {f.dueAt}</span>
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.nextStep}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                    id: {f.id} · owner: {f.ownerId}
                  </div>
                </div>

                <button
                  onClick={() => toggleStatus(f.id, f.status)}
                  disabled={busyId === f.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid #ddd",
                    background: "white",
                    fontWeight: 800,
                    cursor: busyId === f.id ? "not-allowed" : "pointer",
                    opacity: busyId === f.id ? 0.6 : 1,
                    whiteSpace: "nowrap",
                    height: 44,
                  }}
                >
                  {busyId === f.id ? "Saving…" : f.status === "done" ? "Mark open" : "Mark done"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, opacity: 0.6, fontSize: 12 }}>
        Demo workspace populated with sample data.
      </div>
    </div>
  );
}
