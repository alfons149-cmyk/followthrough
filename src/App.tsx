import { useEffect, useState } from "react";

type Followup = {
  id: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;
  status: string;
};

export default function App() {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/followups?workspaceId=ws_1");
    const data = await res.json();
    setItems(data.items);
    setLoading(false);
  }

  async function toggleStatus(item: Followup) {
    const newStatus = item.status === "done" ? "open" : "done";

    await fetch(`/api/followups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    // opnieuw laden
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Followups</h1>

      {items.length === 0 && <p>No followups</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((f) => (
          <li
            key={f.id}
            style={{
              padding: 12,
              marginBottom: 8,
              border: "1px solid #ddd",
              borderRadius: 6,
              opacity: f.status === "done" ? 0.6 : 1,
            }}
          >
            <strong>{f.contactName}</strong> — {f.companyName}
            <br />
            Next: {f.nextStep}
            <br />
            Status: <b>{f.status}</b>
            <br />
            <button onClick={() => toggleStatus(f)}>
              Mark as {f.status === "done" ? "open" : "done"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
