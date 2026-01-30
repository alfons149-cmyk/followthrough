import { useEffect, useState } from "react";
import "./App.css";

type HealthResult =
  | { ok: true; [k: string]: unknown }
  | { ok: false; error?: string; [k: string]: unknown };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<HealthResult | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/health", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        const text = await res.text(); // eerst als tekst (handig bij HTML errors)
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { ok: false, error: "Non-JSON response", raw: text };
        }

        if (!cancelled) {
          if (!res.ok) {
            setError(`HTTP ${res.status} ${res.statusText}`);
          }
          setResult(data);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">FollowThrough</h1>
        <p className="tagline">Step 2 — API health check</p>
      </header>

      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="chip chipOpen">
            {loading ? "Checking /api/health…" : "Done"}
          </span>

          {error ? (
            <span className="chip chipOverdue">Error: {error}</span>
          ) : result?.ok ? (
            <span className="chip chipDone">API OK ✅</span>
          ) : (
            <span className="chip chipSoon">API not OK ⚠️</span>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Response</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {loading ? "…" : JSON.stringify(result, null, 2)}
          </pre>
        </div>

        <div style={{ marginTop: 12, opacity: 0.8, fontSize: 13 }}>
          URL tested: <code>/api/health</code>
        </div>
      </section>
    </div>
  );
}
