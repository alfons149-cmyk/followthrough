import { useEffect, useState } from "react";

type Followup = {
  id: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string;
  status: string;
};

function App() {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/followups?workspaceId=ws_1")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading followups…</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Followups</h1>

      {items.length === 0 && <p>No followups yet.</p>}

      <ul>
        {items.map((f) => (
          <li key={f.id} style={{ marginBottom: 12 }}>
            <strong>{f.contactName}</strong> — {f.companyName}
            <br />
            Next step: {f.nextStep}
            <br />
            Due: {f.dueAt}
            <br />
            Status: <em>{f.status}</em>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
