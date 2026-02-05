import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Status = "open" | "sent" | "waiting" | "followup" | "done";

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  companyName: string;
  nextStep: string;
  dueAt: string; // YYYY-MM-DD
  status: Status;
  createdAt?: string;
};

type Workspace = {
  id: string;
  name: string;
  createdAt?: string;
};

const WORKSPACE_ID = "ws_1";
const OWNER_ID = "u_1";

const STATUS_ORDER: Status[] = ["open", "sent", "waiting", "followup", "done"];

const API_BASE = ""; // same-origin on Cloudflare Pages
function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function parseYMD(s: string) {
  const v = (s || "").slice(0, 10);
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(ymd: string, days: number) {
  const dt = parseYMD(ymd) ?? new Date();
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function statusLabel(s: Status) {
  if (s === "open") return "Open";
  if (s === "sent") return "Sent";
  if (s === "waiting") return "Waiting";
  if (s === "followup") return "Follow-up";
  return "Done";
}

function nextStatus(s: Status): Status {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

function isValidYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [items, setItems] = useState<Followup[]>([]);

  // Form state (create)
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [dueAt, setDueAt] = useState(todayYMD());

  // Search/filter
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  // Step 7: inline edit state (draft per item-id)
  const [editNextId, setEditNextId] = useState<string | null>(null);
  const [editDueId, setEditDueId] = useState<string | null>(null);
  const [draftNextById, setDraftNextById] = useState<Record<string, string>>({});
  const [draftDueById, setDraftDueById] = useState<Record<string, string>>({});

  const draftNext = (id: string) => draftNextById[id] ?? "";
  const draftDue = (id: string) => draftDueById[id] ?? "";

  // ✅ FILTERED LIST (search + status)
  const visible = useMemo(() => {
    const needle = (q || "").trim().toLowerCase();

    return items.filter((f) => {
      const matchesStatus = statusFilter === "all" ? true : f.status === statusFilter;

      const hay = `${f.contactName ?? ""} ${f.companyName ?? ""} ${f.nextStep ?? ""}`.toLowerCase();
      const matchesSearch = !needle ? true : hay.includes(needle);

      return matchesStatus && matchesSearch;
    });
  }, [items, q, statusFilter]);

  // ---- KPIs
  const needsTodayCount = useMemo(() => {
    const today = todayYMD();
    return items.filter((f) => f.status !== "done" && (f.dueAt || "").slice(0, 10) === today).length;
  }, [items]);

  const overdueCount = useMemo(() => {
    const today = todayYMD();
    return items.filter((f) => f.status !== "done" && (f.dueAt || "").slice(0, 10) < today).length;
  }, [items]);

  // ---- API
  async function refreshAll() {
    setLoading(true);
    setErr(null);

    try {
      // workspaces (optional)
      const wsRes = await fetch(apiUrl("/api/workspaces"), { headers: { Accept: "application/json" } });
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        setWorkspaces(wsData.items || []);
      } else {
        setWorkspaces([]);
      }

      // followups
      const fuRes = await fetch(apiUrl(`/api/followups?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`), {
        headers: { Accept: "application/json" },
      });
      if (!fuRes.ok) throw new Error(`Followups failed (${fuRes.status})`);
      const fuData = await fuRes.json();
      setItems(fuData.items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  async function onCreate() {
    setLoading(true);
    setErr(null);

    try {
      const payload = {
        workspaceId: WORKSPACE_ID,
        ownerId: OWNER_ID,
        contactName: contactName.trim(),
        companyName: companyName.trim(),
        nextStep: nextStep.trim(),
        dueAt: (dueAt || "").trim(),
        status: "open" as Status,
      };

      if (!payload.contactName) throw new Error("Please enter a contact name.");
      if (!payload.nextStep) throw new Error("Please enter a next step.");
      if (!payload.dueAt) throw new Error("Please enter a due date (YYYY-MM-DD).");

      const res = await fetch(apiUrl("/api/followups"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create failed (${res.status}) ${text ? "— " + text : ""}`);
      }

      await res.json().catch(() => null);

      // clear form (date houden we)
      setContactName("");
      setCompanyName("");
      setNextStep("");

      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function patchFollowup(
    id: string,
    body: Partial<Pick<Followup, "status" | "dueAt" | "nextStep">>
  ) {
    const res = await fetch(apiUrl(`/api/followups/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Patch failed (${res.status}) ${text ? "— " + text : ""}`);
    }

    await res.json().catch(() => null);
  }

  // ---- Actions (Move/Done/Reopen/Snooze)
  function transitionPlan(f: Followup) {
    const ns = nextStatus(f.status);
    const today = todayYMD();

    if (f.status === "open" && ns === "sent") return { status: ns, dueAt: addDays(today, 3) };
    if (f.status === "sent" && ns === "waiting") return { status: ns, dueAt: addDays(today, 7) };
    if (f.status === "waiting" && ns === "followup") return { status: ns, dueAt: today };
    if (f.status === "done") return { status: "done" as const };
    return { status: ns };
  }

  async function onMove(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      const plan = transitionPlan(f);
      await patchFollowup(f.id, plan);
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Move failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDone(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(f.id, { status: "done" });
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Done failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReopen(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(f.id, { status: "open" });
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Reopen failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSnooze(f: Followup, days: number) {
    setLoading(true);
    setErr(null);
    try {
      const base = ((f.dueAt || todayYMD()).slice(0, 10) || todayYMD()).trim();
      await patchFollowup(f.id, { dueAt: addDays(base, days) });
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Snooze failed");
    } finally {
      setLoading(false);
    }
  }

  // Step 7: inline edit handlers
  function startEditNext(f: Followup) {
    setEditDueId(null);
    setEditNextId(f.id);
    setDraftNextById((prev) => ({ ...prev, [f.id]: f.nextStep || "" }));
  }

  function cancelEditNext(id: string) {
    setEditNextId((cur) => (cur === id ? null : cur));
  }

  async function saveEditNext(id: string) {
    const v = (draftNext(id) || "").trim();
    setEditNextId(null);
    if (!v) return;

    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(id, { nextStep: v });
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Save next step failed");
    } finally {
      setLoading(false);
    }
  }

  function startEditDue(f: Followup) {
    setEditNextId(null);
    setEditDueId(f.id);
    setDraftDueById((prev) => ({ ...prev, [f.id]: (f.dueAt || "").slice(0, 10) }));
  }

  function cancelEditDue(id: string) {
    setEditDueId((cur) => (cur === id ? null : cur));
  }

  async function saveEditDue(id: string) {
    const v = (draftDue(id) || "").trim();
    setEditDueId(null);
    if (!isValidYMD(v)) return;

    setLoading(true);
    setErr(null);
    try {
      await patchFollowup(id, { dueAt: v });
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Save due date failed");
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
    <h1>FollowThrough</h1>
    <p>Test render</p>
  </div>
   );
}