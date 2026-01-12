import { useEffect, useState } from "react";

type Followup = {
  id: string;
  contactName: string;
  companyName: string;
  status: string;
};

export default function App() {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/followups?workspaceId=ws_1")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading followups…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Followthrough</h1>

      {items.length === 0 && <p>No followups yet.</p>}

      <ul>
        {items.map((f) => (
          <li key={f.id}>
            <strong>{f.contactName}</strong> – {f.companyName} ({f.status})
          </li>
        ))}
      </ul>
    </div>
  );
}
