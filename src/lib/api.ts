const API_KEY = "vd_c9faf4a015a34341abdb54a830f6ffea";

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
export async function createFollowup(data: any) {
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
