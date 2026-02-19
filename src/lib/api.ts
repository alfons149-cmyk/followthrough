function getApiKey() {
  // 1) Key uit localStorage (werkt op mobiel + desktop)
  const fromStorage = localStorage.getItem("VD_API_KEY")?.trim();
  if (fromStorage) return fromStorage;

  // 2) (optioneel) fallback: .env via Vite (alleen voor lokaal dev)
  const fromEnv = (import.meta as any).env?.VITE_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  return "";
}

/* ---------------- GET followups ---------------- */
export async function fetchFollowups() {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error("Geen API key ingesteld (VD_API_KEY ontbreekt).");

  const res = await fetch("/api/followups", {
    headers: { "x-api-key": API_KEY },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------------- CREATE followup ---------------- */
export async function createFollowup(data: any) {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error("Geen API key ingesteld (VD_API_KEY ontbreekt).");

  const res = await fetch("/api/followups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
