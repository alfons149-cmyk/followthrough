import { useEffect, useState } from "react";

type Followup = {
  id: string;
  contactName: string;
  companyName: string;
  nextStep: string;
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

  async function toggle(id: string, status: string) {
    await fetch(`/api/followups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: status === "open" ? "done" : "open",
      }),
    });

    await load();
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p>Loading followups…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Followups</h1>

      {items.length === 0 && <p>No followups found.</p>}

      <ul>
        {items.map((f) => (
          <li key={f.id} style={{ marginBottom: 12 }}>
            <strong>{f.contactName}</strong> – {f.companyName}
            <br />
            {f.nextStep}
            <br />
            Status: <b>{f.status}</b>{" "}
            <button onClick={() => toggle(f.id, f.status)}>
              toggle
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
