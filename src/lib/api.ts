const API_KEY = vd_c9faf4a015a34341abdb54a830f6ffea;

if (!API_KEY) {
  console.error("Missing VITE_API_KEY in .env");
}

/* ---------------- GET followups ---------------- */
export async function fetchFollowups() {
  const res = await fetch("/api/followups", {
    headers: {
      "x-api-key": API_KEY
    }
  });

  return res.json();
}

/* ---------------- CREATE followup ---------------- */
export async function createFollowup(data:any) {
  const res = await fetch("/api/followups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY
    },
    body: JSON.stringify(data)
  });

  return res.json();
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return res.json();
}
