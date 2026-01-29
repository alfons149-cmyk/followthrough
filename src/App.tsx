import { useMemo, useState } from "react";
import "./App.css";
import { useEffect } from "react";

type Status = "open" | "sent" | "waiting" | "followup" | "done";

type Followup = {
  id: string;
  workspaceId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string; // YYYY-MM-DD
  status: Status;
};

function formatDate(s: string) {
  return s || "—";
}

export default function App() {
  const workspaceId = "ws_1";

  // Local-only demo state (compile-clean baseline)
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [dueAt, setDueAt] = useState("");

  const needsTodayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((x) => x.status !== "done" && x.dueAt === today).length;
  }, [items]);

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((x) => x.status !== "done" && x.dueAt < today).length;
  }, [items]);

  function seedDemoData() {
    setError(null);
    setItems([
      {
        id: "f_demo_1",
        workspaceId,
        contactName: "Alice Example",
        companyName: "Example GmbH",
        nextStep: "Send intro email",
        dueAt: "2026-01-10",
        status: "open",
      },
      {
        id: "f_demo_2",
        workspaceId,
        contactName: "Bob Client",
        companyName: "Client BV",
        nextStep: "Call to confirm budget",
        dueAt: "2026-01-05",
        status: "waiting",
      },
    ]);
  }

  function clearAll() {
    setItems([]);
    setError(null);
  }

  async function onCreate() {
    setError(null);

    // mini-validatie, zodat je UI niet “stil” faalt
    if (!contactName.trim() || !companyName.trim() || !nextStep.trim() || !dueAt.trim()) {
      setError("Please fill in: contact name, company, next step, due date.");
      return;
    }

    // loading blijft alvast staan voor later (API)
    setLoading(true);
    try {
      const id = `f_${crypto.randomUUID()}`;
      const newItem: Followup = {
        id,
        workspaceId,
        contactName: contactName.trim(),
        companyName: companyName.trim(),
        nextStep: nextStep.trim(),
        dueAt: dueAt.trim(),
        status: "open",
      };
      setItems((prev) => [newItem, ...prev]);

      // reset form
      setContactName("");
      setCompanyName("");
      setNextStep("");
      setDueAt("");
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleDone(id: string) {
    setItems((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, status: x.status === "done" ? "open" : "done" } : x
      )
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <p className="tagline">Compile-clean baseline — no API yet</p>

        <div className="sub" style={{ opacity: 0.8 }}>
          Workspace: <b>{workspaceId}</b> · API: <code>/api/followups</code>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="errorBanner">
          <b>Error:</b> {error}
        </div>
      )}

      {/* KPIs */}
      <div className="kpis" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span className="chip chipSoon">Need today: {needsTodayCount}</span>
        <span className="chip chipOverdue">Overdue: {overdueCount}</span>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="empty">
          <h2>Welcome to FollowThrough 👋</h2>
          <p>This is the compile-clean version. Next step: re-add API safely.</p>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={seedDemoData} disabled={loading}>
              Try with example data
            </button>
            <button className="btn" onClick={clearAll} disabled={loading}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {items.length > 0 && (
        <div className="list">
          {items.map((f) => (
            <div key={f.id} className={f.status === "done" ? "card" : "card"}>
              <div className="cardLine">
                <b>Next:</b> <span>{f.nextStep || "—"}</span>
              </div>

              <div style={{ fontWeight: 600, marginTop: 8 }}>{f.contactName}</div>
              <div style={{ opacity: 0.8 }}>{f.companyName}</div>

              <div className="cardMeta" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="metaItem">
                  Due: <b>{formatDate(f.dueAt)}</b>
                </span>
                <span className="metaItem">
                  Status: <code>{f.status}</code>
                </span>
                <span className="metaItem">
                  Id: <code>{f.id}</code>
                </span>
              </div>

              <div className="cardActions" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => toggleDone(f.id)} disabled={loading}>
                  {f.status === "done" ? "Reopen" : "Done"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Refresh */}
      <section className="panel">
        <div className="grid">
          <div className="field">
            <label>Contact name</label>
            <input
              id="contactName"
              className="input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Company</label>
            <input
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Next step</label>
            <input
              className="input"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              disabled={loading}
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

          <button className="btn btnPrimary" onClick={onCreate} disabled={loading}>
            Add follow-up
          </button>

          <button className="btn" onClick={seedDemoData} disabled={loading} style={{ marginLeft: 8 }}>
            Seed demo
          </button>
        </div>
      </section>
    </div>
  );
}
