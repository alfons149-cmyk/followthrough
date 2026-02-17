const API_KEY = vd_c9faf4a015a34341abdb54a830f6ffea;

if (!API_KEY) {
  console.error("Missing VITE_API_KEY in .env");
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
