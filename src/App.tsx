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
  status: string;  // "open" | "done"
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

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"open"|"done">("all");
  const [sortBy, setSortBy] = useState<"dueAt"|"createdAt"|"company">("dueAt");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");


  // Pages Functions: same-origin API
  const API_BASE = ""; // leeg = dezelfde origin als de frontend

  const api = useMemo(() => {
    const base = API_BASE.replace(/\/+$/, ""); // veiligheid: geen trailing slash

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
          <input
            className="input"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
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
  {(visible ?? items).map((f) => {
    const chipClass =
      f.status === "done" ? "chip chipDone" : "chip chipOpen";

    return (
      <div key={f.id} className="card">
        <div className="cardTop">
          <div>
            <div className="cardTitle">
              {f.contactName} <span>({f.companyName})</span>
            </div>

            <div className="cardLine">
              <b>Next:</b> {f.nextStep}
            </div>

            <div className="cardMeta">
              Due: <b>{formatDate(f.dueAt)}</b> ·{" "}
              <span className={chipClass}>{f.status}</span> · Id:{" "}
              <code>{f.id}</code>
            </div>
          </div>

          <div className="cardActions">
            <button
              className="btn"
              onClick={() => toggleStatus(f)}
              disabled={loading}
            >
              Toggle → {f.status === "done" ? "open" : "done"}
            </button>
          </div>
        </div>
      </div>
    );
  })}

  {!loading && (visible ?? items).length === 0 && (
    <div className="empty">No followups yet. Add one above.</div>
  )}
</div>
  </div>
);
}

export default App;
