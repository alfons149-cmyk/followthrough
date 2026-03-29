import { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";

type Status = "open" | "sent" | "waiting" | "followup" | "done";
type StatusFilter = Status | "all";
type RiskFilter = "all" | "high" | "medium" | "low";
type SortMode = "risk" | "due" | "created";

type FollowupRisk = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
  suggestion: string;
};

type Followup = {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactName: string;
  contactEmail?: string;
  companyName: string;
  nextStep: string;
  dueAt: string;
  status: Status;
  createdAt?: string;
  risk?: FollowupRisk;

  emailEnabled?: boolean;
  emailStatus?: string;
  emailSequenceStep?: number;
  lastEmailSentAt?: string | null;
  nextEmailAt?: string | null;
  lastEmailSubject?: string | null;
  lastEmailPreview?: string | null;
  replyDetectedAt?: string | null;
  emailFailureReason?: string | null;
};

const STATUS_ORDER: Status[] = ["open", "sent", "waiting", "followup", "done"];
const API_BASE = ""; // same-origin on Cloudflare Pages
const API_KEY_STORAGE = "VD_API_KEY";

const UI = {
  appName: "VolgDraad",
  subtitle: "Betrouwbaarheid · Draden die niet wegglippen",

  email: "E-mail",
  autoEmail: "Auto-mail",
  placeholderEmail: "Bijv. jan@bedrijf.nl",

  sendInitial: "Stuur eerste mail",
  sendFollowup: "Stuur follow-up",
  enableAutoEmail: "Auto-mail aan",
  disableAutoEmail: "Auto-mail uit",

  emailStatus: "Mailstatus",
  lastEmail: "Laatste mail",
  nextEmail: "Volgende mail",

  // actions / common
  refreshTitle: "Vernieuwen",
  retry: "Opnieuw",
  loading: "Laden…",

  // error copy
  missingKey: "Geen API-key ingesteld (VD_API_KEY in localStorage).",

  // KPI
  today: "Vandaag",
  overdue: "Achterstallig",
  high: "Hoog",
  medium: "Middel",
  low: "Laag",

  // create form
  createTitle: "Nieuwe draad",
  contactName: "Contactpersoon",
  company: "Organisatie",
  nextStep: "Volgende stap",
  date: "Datum",
  add: "Toevoegen",
  clear: "Wissen",

  placeholderContact: "Bijv. Jan Jansen",
  placeholderCompany: "Bijv. Bedrijf BV",
  placeholderNext: "Bijv. Belafspraak plannen",
  placeholderDate: "YYYY-MM-DD",

  // list + filters
  threads: "Jouw actieve draden",
  search: "Zoeken",
  status: "Status",
  risk: "Risico",
  sort: "Sorteren",
  clearFilters: "Filters wissen",

  // empty states
  noThreadsYet: "Nog geen draden.",
  addFirst: "Maak je eerste draad",
  noResults: "Geen resultaten voor deze filters.",
  seedExamples: "Vul met voorbeelden",

  // risk banner
  highRiskBannerTitle: "Hoog risico",
  highRiskBannerText: "Eerst oppakken",
  showHighRisk: "Toon hoog risico",

  // card labels
  next: "Volgende stap",
  due: "Datum",
  why: "Waarom",
  advice: "Advies",

  // buttons per card
  move: "Volgende fase",
  snooze1: "+1 dag",
  snooze3: "+3 dagen",
  snooze7: "+7 dagen",
  done: "Afgerond",
  reopen: "Heropenen",

  // inline edit tooltips
  editNextTitle: "Bewerk volgende stap",
  editDueTitle: "Bewerk datum",
  clickToEditDate: "Klik om de datum te wijzigen",

  // status labels + filter labels
  statusAll: "Alles",
  statusOpen: "Open",
  statusSent: "Verstuurd",
  statusWaiting: "Wachten",
  statusFollowup: "Opvolgen",
  statusDone: "Afgerond",

  riskAll: "Alles",
  riskHigh: "Hoog",
  riskMedium: "Middel",
  riskLow: "Laag",

  sortRisk: "Risico",
  sortDue: "Datum",
  sortCreated: "Nieuwste",
};

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(e: unknown, fallback = "Onbekende fout"): string {
  console.error("App error:", e);

  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e;

  try {
    return JSON.stringify(e);
  } catch {
    return fallback;
  }
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
  if (s === "open") return UI.statusOpen;
  if (s === "sent") return UI.statusSent;
  if (s === "waiting") return UI.statusWaiting;
  if (s === "followup") return UI.statusFollowup;
  return UI.statusDone;
}

function riskLabel(level?: "low" | "medium" | "high") {
  if (level === "high") return "Hoog";
  if (level === "medium") return "Middel";
  if (level === "low") return "Laag";
  return "—";
}

function suggestionNL(risk?: { level?: "high" | "medium" | "low" }) {
  const level = risk?.level;

  if (level === "high") return "Vandaag opvolgen";
  if (level === "medium") return "Warm houden";
  if (level === "low") return "Geen directe actie nodig";

  return "—";
}

function nextStatus(s: Status): Status {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)];
}

function isValidYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getApiKey(): string {
  return (localStorage.getItem(API_KEY_STORAGE) || "").trim();
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readApiError(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = (await res.json().catch(() => null)) as any;
      if (j?.error) return String(j.error);
      if (j?.message) return String(j.message);
      if (j && typeof j === "object") return JSON.stringify(j);
    }
  } catch {}
  const t = await res.text().catch(() => "");
  return t || res.statusText || `HTTP ${res.status}`;
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new ApiError(401, UI.missingKey);

  const { json, headers, ...rest } = opts;

  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${apiKey}`,
      ...(headers || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    const msg = await readApiError(res);
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => null)) as T;
}

const apiGet = <T,>(path: string) => apiFetch<T>(path, { method: "GET" });
const apiPost = <T,>(path: string, json?: unknown) =>
  apiFetch<T>(path, { method: "POST", json });
const apiPatch = <T,>(path: string, json?: unknown) =>
  apiFetch<T>(path, { method: "PATCH", json });

export default function App() {
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState(() => getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [contactEmail, setContactEmail] = useState("");  
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }

  async function onSendInitialEmail(f: Followup) {
  setLoading(true);
  setErr(null);

  try {
    if (!f.contactEmail?.trim()) {
      throw new Error("Geen e-mailadres ingesteld.");
    }

    const res = await sendInitialEmail(f.id);
    showToast(res?.simulated ? "Eerste mail gesimuleerd ✉️" : "Eerste mail verstuurd ✉️");
    await refreshAll();
  } catch (e: unknown) {
    setErr(errorMessage(e, "Versturen mislukt"));
  } finally {
    setLoading(false);
  }
}  

  function saveApiKey(value: string) {
    const v = (value || "").trim();
    if (!v) return;
    localStorage.setItem(API_KEY_STORAGE, v);
    setApiKey(v);
    setKeyInput("");
    showToast("API-key opgeslagen ✅");
  }

  function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey("");
    showToast("API-key verwijderd");
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [items, setItems] = useState<Followup[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("risk");

  const dashboardList = useMemo(() => {
    let list = [...items];

    // status filter
    if (statusFilter !== "all") {
      list = list.filter((f) => f.status === statusFilter);
    }

    // search
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((f) => {
        const hay = `${f.contactName ?? ""} ${f.companyName ?? ""} ${f.nextStep ?? ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    // risk filter
    if (riskFilter !== "all") {
      list = list.filter((f) => f.risk?.level === riskFilter);
    }

    // risk group: high(0) → medium(1) → low(2) → none(3)
    const riskGroup = (f: Followup) => {
      const lvl = f.risk?.level;
      if (lvl === "high") return 0;
      if (lvl === "medium") return 1;
      if (lvl === "low") return 2;
      return 3;
    };

    const riskScore = (f: Followup) =>
      typeof f.risk?.score === "number" ? f.risk.score : -1;
    const dueKey = (f: Followup) =>
      (f.dueAt || "").slice(0, 10) || "9999-99-99";
    const createdKey = (f: Followup) => f.createdAt || "";

    // “Intelligent” sort: risk-groep eerst, daarna gekozen sort
    list.sort((a, b) => {
      const g = riskGroup(a) - riskGroup(b);
      if (g !== 0) return g;

      if (sortMode === "risk") return riskScore(b) - riskScore(a); // hoog→laag
      if (sortMode === "due") return dueKey(a).localeCompare(dueKey(b)); // vroeg→laat
      return createdKey(b).localeCompare(createdKey(a)); // nieuw→oud
    });

    return list;
  }, [items, q, statusFilter, riskFilter, sortMode]);

  // Form state (create)
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [dueAt, setDueAt] = useState(todayYMD());

  // Inline edit state
  const [editNextId, setEditNextId] = useState<string | null>(null);
  const [editDueId, setEditDueId] = useState<string | null>(null);
  const [draftNextById, setDraftNextById] = useState<Record<string, string>>({});
  const [draftDueById, setDraftDueById] = useState<Record<string, string>>({});

  const draftNext = (id: string) => draftNextById[id] ?? "";
  const draftDue = (id: string) => draftDueById[id] ?? "";

  // KPIs
  const needsTodayCount = useMemo(() => {
    const today = todayYMD();
    return items.filter(
      (f) => f.status !== "done" && (f.dueAt || "").slice(0, 10) === today
    ).length;
  }, [items]);

  const overdueCount = useMemo(() => {
    const today = todayYMD();
    return items.filter(
      (f) => f.status !== "done" && (f.dueAt || "").slice(0, 10) < today
    ).length;
  }, [items]);

  async function refreshAll() {
    setLoading(true);
    setErr(null);

    try {
      const data = await apiGet<{ items: Followup[] }>(`/api/followups?includeRisk=1`);
      setItems(data?.items || []);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Ophalen mislukt"));
    } finally {
      setLoading(false);
    }
  }

  async function onCreate() {
  setLoading(true);
  setErr(null);

  try {
  const payload = {
  contactName: contactName.trim(),
  contactEmail: contactEmail.trim(),
  companyName: companyName.trim(),
  nextStep: nextStep.trim(),
  dueAt: (dueAt || "").trim(),
  status: "open" as Status,

  emailEnabled: !!contactEmail.trim(), // 👈 TOEVOEGEN
};

    if (!payload.contactName) throw new Error("Vul een contactpersoon in.");
    if (!payload.nextStep) throw new Error("Vul een volgende stap in.");
    if (!payload.dueAt) throw new Error("Vul een datum in (YYYY-MM-DD).");
    if (!isValidYMD(payload.dueAt)) throw new Error("Datum moet YYYY-MM-DD zijn.");

    await apiPost<{ ok: boolean; id?: string }>(`/api/followups`, payload);

    setContactName("");
    setContactEmail("");
    setCompanyName("");
    setNextStep("");
    setDueAt(todayYMD());

    await refreshAll();
  } catch (e: unknown) {
    setErr(errorMessage(e, "Toevoegen mislukt"));
  } finally {
    setLoading(false);
  }
}

    async function seedExamples() {
  setLoading(true);
  setErr(null);
  try {
    const examples = [
      { contactName: "Jan Jansen", companyName: "Bedrijf BV", nextStep: "Belafspraak plannen", dueAt: addDays(todayYMD(), 0), status: "followup" as Status },
      { contactName: "Sanne de Vries", companyName: "Studio Noord", nextStep: "Voorstel sturen", dueAt: addDays(todayYMD(), 2), status: "sent" as Status },
      { contactName: "Murat Kaya", companyName: "Kaya Logistics", nextStep: "Reactie checken", dueAt: addDays(todayYMD(), -2), status: "waiting" as Status },
      { contactName: "Eva Smit", companyName: "Smit & Co", nextStep: "Demo plannen", dueAt: addDays(todayYMD(), 7), status: "open" as Status },
      { contactName: "Noor Bakker", companyName: "Bakker Agency", nextStep: "Follow-up mail sturen", dueAt: addDays(todayYMD(), 1), status: "followup" as Status },
      { contactName: "Tom Peters", companyName: "Peters IT", nextStep: "Offerte aanpassen", dueAt: addDays(todayYMD(), 3), status: "sent" as Status },
    ];

    for (const ex of examples) {
      await apiPost(`/api/followups`, ex);
    }

    showToast("Voorbeelden toegevoegd ✨");
    setTimeout(() => setToast(null), 2200);
    await refreshAll();
  } catch (e: unknown) {
    setErr(errorMessage(e, "Voorbeelden toevoegen mislukt"));
  } finally {
    setLoading(false);
  }
}

  async function patchFollowup(
    id: string,
    body: Partial<Pick<Followup, "status" | "dueAt" | "nextStep">>
  ) {
    await apiPatch<{ ok?: boolean }>(`/api/followups/${encodeURIComponent(id)}`, body);
  }
    
  async function sendInitialEmail(id: string) {
  return apiPost<{
    ok: boolean;
    simulated?: boolean;
    preview?: { to: string; subject: string; body: string };
  }>(`/api/followups/send-initial-email`, { id });
}

    async function patchEmailSettings(id: string, emailEnabled: boolean) {
  return apiFetch<{ ok: boolean }>(`/api/followups/email-settings`, {
    method: "PATCH",
    json: { id, emailEnabled },
  });
}

    async function onToggleEmailEnabled(f: Followup) {
  setLoading(true);
  setErr(null);

  try {
    await patchEmailSettings(f.id, !f.emailEnabled);
    showToast(!f.emailEnabled ? "Auto-mail ingeschakeld" : "Auto-mail uitgeschakeld");
    await refreshAll();
  } catch (e: unknown) {
    setErr(errorMessage(e, "Bijwerken mislukt"));
  } finally {
    setLoading(false);
  }
}

    async function sendFollowupEmail(id: string) {
  return apiPost<{
    ok: boolean;
    simulated?: boolean;
    preview?: { to: string; subject: string; body: string };
  }>(`/api/followups/send-followup-email`, { id });
}

  // Actions (Move/Done/Reopen/Snooze)
  function transitionPlan(f: Followup) {
    const ns = nextStatus(f.status);
    const today = todayYMD();

    if (f.status === "open" && ns === "sent") return { status: ns, dueAt: addDays(today, 3) };
    if (f.status === "sent" && ns === "waiting") return { status: ns, dueAt: addDays(today, 7) };
    if (f.status === "waiting" && ns === "followup") return { status: ns, dueAt: today };
    if (f.status === "followup" && ns === "done") return { status: ns };
    return { status: ns };
  }

  async function onMove(f: Followup) {
    setLoading(true);
    setErr(null);
    try {
      const plan = transitionPlan(f);
      await patchFollowup(f.id, plan);
      await refreshAll();
    } catch (e: unknown) {
      setErr(errorMessage(e, "Actie mislukt"));
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
    } catch (e: unknown) {
      setErr(errorMessage(e, "Afronden mislukt"));
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
    } catch (e: unknown) {
      setErr(errorMessage(e, "Heropenen mislukt"));
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
    } catch (e: unknown) {
      setErr(errorMessage(e, "Uitstellen mislukt"));
    } finally {
      setLoading(false);
    }
  }

  // Inline edit handlers
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
    } catch (e: unknown) {
      setErr(errorMessage(e, "Opslaan mislukt"));
    } finally {
      setLoading(false);
    }
  }

    async function onSendFollowupEmail(f: Followup) {
  setLoading(true);
  setErr(null);

  try {
    if (!f.contactEmail?.trim()) {
      throw new Error("Geen e-mailadres ingesteld.");
    }

    const res = await sendFollowupEmail(f.id);
    showToast(res?.simulated ? "Follow-up gesimuleerd ✉️" : "Follow-up verstuurd ✉️");
    await refreshAll();
  } catch (e: unknown) {
    setErr(errorMessage(e, "Versturen mislukt"));
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
    } catch (e: unknown) {
      setErr(errorMessage(e, "Opslaan mislukt"));
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
  setContactName("");
  setContactEmail("");
  setCompanyName("");
  setNextStep("");
  setDueAt(todayYMD());
}
    
  useEffect(() => {
  if (!apiKey) return;
  refreshAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [apiKey]);

  const riskCounts = useMemo(() => {
  const counts = { high: 0, medium: 0, low: 0, none: 0 };
  for (const f of items) {
    const level = f.risk?.level;
    if (level === "high") counts.high++;
    else if (level === "medium") counts.medium++;
    else if (level === "low") counts.low++;
    else counts.none++;
  }
  return counts;
}, [items]);

  if (!apiKey) {
  return (
    <div className="page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <header className="appTopbar">
        <div className="appTopbarLeft">
          <h1 className="appTitle">{UI.appName}</h1>
          <div className="appSubtitle">Start voor testers · sleutel erin, klaar.</div>
        </div>
      </header>

      {toast ? (
  <div className="panel" style={{ marginTop: 10, opacity: 0.9 }}>
    {toast}
  </div>
) : null}


      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Toegang instellen</h3>
        <p style={{ marginTop: 6, opacity: 0.85 }}>
          Plak je <b>VolgDraad API-key</b> hieronder. Daarna kun je direct aan de slag.
        </p>

        <div className="field" style={{ marginTop: 10 }}>
          <label>API-key</label>
          <input
            className="input"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="vd_..."
            autoFocus
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btnPrimary" onClick={() => saveApiKey(keyInput)}>
            Opslaan
          </button>
          <button
            className="btn"
            onClick={() => {
              // handig voor mobiel: testers kunnen key ook via ?key=... binnenkrijgen
              const p = new URLSearchParams(window.location.search);
              const k = (p.get("key") || "").trim();
              if (k) saveApiKey(k);
              else setToast("Geen key gevonden in de URL (?key=...)");
              setTimeout(() => setToast(null), 2200);
            }}
          >
            Pak key uit URL
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>
          Tip: op mobiel kun je een link delen als: <code>?key=vd_...</code>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Feedback</h3>
        <p style={{ marginTop: 6, opacity: 0.85 }}>
          Iets onduidelijk of stuk? Stuur het direct door.
        </p>
        <a
          className="btn"
          href={`mailto:jou@email.nl?subject=${encodeURIComponent("VolgDraad feedback (tester)")}
&body=${encodeURIComponent("Wat ging er goed/mis?\n\nContext:\n- device: " + navigator.userAgent + "\n- url: " + location.href + "\n")}`}
        >
          Feedback mailen
        </a>
      </section>
    </div>
  );
}
    
  return (
    <div className="page">
      <header className="appTopbar">
        <div className="appTopbarLeft">
          <h1 className="appTitle">{UI.appName}</h1>
          <div className="appSubtitle">{UI.subtitle}</div>
        </div>

        <div className="appTopbarRight">
          <div className="appMeta">
            Draden: <b>{items.length}</b>
          </div>
          <button
            className="iconBtn"
            onClick={refreshAll}
            disabled={loading}
            title={UI.refreshTitle}
          >
            {loading ? "…" : "↻"}
          </button>
          <button className="btn" onClick={clearApiKey} disabled={loading} title="API-key verwijderen">
  Uitloggen
</button>

<a
  className="btn"
  href={`mailto:jou@email.nl?subject=${encodeURIComponent("VolgDraad feedback (tester)")}
&body=${encodeURIComponent("Feedback:\n\nContext:\n- items: " + items.length + "\n- device: " + navigator.userAgent + "\n- url: " + location.href + "\n")}`}
  style={{ textDecoration: "none" }}
>
  Feedback
</a>
        </div>
      </header>

      {err ? (
        <div className="error">
          Fout: {err}{" "}
          <button
            className="btn"
            onClick={refreshAll}
            disabled={loading}
            style={{ marginLeft: 8 }}
          >
            {UI.retry}
          </button>
        </div>
      ) : null}

      <div className="kpiBar">
        <span className="kpiChip kpiSoon">
          {UI.today}: {needsTodayCount}
        </span>
        <span className="kpiChip kpiOverdue">
          {UI.overdue}: {overdueCount}
        </span>

        <span className="kpiChip kpiRiskHigh">
          {UI.high}: {riskCounts.high}
        </span>
        <span className="kpiChip kpiRiskMed">
          {UI.medium}: {riskCounts.medium}
        </span>
        <span className="kpiChip kpiRiskLow">
          {UI.low}: {riskCounts.low}
        </span>
      </div>

     {/* Create */}
<section className="panel" style={{ marginBottom: 12 }}>
  <h3 style={{ marginTop: 0 }}>{UI.createTitle}</h3>

  <div className="grid">
    {/* Contactpersoon */}
    <div className="field">
      <label>{UI.contactName}</label>
      <input
        id="contactName"
        className="input"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        disabled={loading}
        placeholder={UI.placeholderContact}
      />
    </div>

    {/* E-mail (NIEUW) */}
    <div className="field">
      <label>{UI.email}</label>
      <input
        className="input"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        disabled={loading}
        placeholder={UI.placeholderEmail}
      />
    </div>

    {/* Organisatie */}
    <div className="field">
      <label>{UI.company}</label>
      <input
        className="input"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        disabled={loading}
        placeholder={UI.placeholderCompany}
      />
    </div>

    {/* Volgende stap */}
    <div className="field">
      <label>{UI.nextStep}</label>
      <input
        className="input"
        value={nextStep}
        onChange={(e) => setNextStep(e.target.value)}
        disabled={loading}
        placeholder={UI.placeholderNext}
      />
    </div>

    {/* Datum */}
    <div className="field">
      <label>{UI.date}</label>
      <input
        className="input"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        disabled={loading}
        placeholder={UI.placeholderDate}
      />
    </div>
  </div>

  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
    <button className="btn btnPrimary" onClick={onCreate} disabled={loading}>
      {UI.add}
    </button>

    <button className="btn" onClick={clearForm} disabled={loading}>
      {UI.clear}
    </button>
  </div>
</section>

      {/* List */}
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>
          {UI.threads} ({dashboardList.length})
        </h3>

        {/* Filters */}
        <div className="toolbarRow">
          <div className="field" style={{ minWidth: 240 }}>
            <label>{UI.search}</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={loading}
              placeholder="Zoek…"
            />
          </div>

          <div className="field" style={{ minWidth: 170 }}>
            <label>{UI.status}</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              disabled={loading}
            >
              <option value="all">{UI.statusAll}</option>
              <option value="open">{UI.statusOpen}</option>
              <option value="sent">{UI.statusSent}</option>
              <option value="waiting">{UI.statusWaiting}</option>
              <option value="followup">{UI.statusFollowup}</option>
              <option value="done">{UI.statusDone}</option>
            </select>
          </div>

          <div className="field" style={{ minWidth: 140 }}>
            <label>{UI.risk}</label>
            <select
              className="select"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
              disabled={loading}
            >
              <option value="all">{UI.riskAll}</option>
              <option value="high">{UI.riskHigh}</option>
              <option value="medium">{UI.riskMedium}</option>
              <option value="low">{UI.riskLow}</option>
            </select>
          </div>

          <div className="field" style={{ minWidth: 140 }}>
            <label>{UI.sort}</label>
            <select
              className="select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              disabled={loading}
            >
              <option value="risk">{UI.sortRisk}</option>
              <option value="due">{UI.sortDue}</option>
              <option value="created">{UI.sortCreated}</option>
            </select>
          </div>

          <div className="toolbarRight">
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setStatusFilter("all");
                setRiskFilter("all");
                setSortMode("risk");
              }}
              disabled={loading}
            >
              {UI.clearFilters}
            </button>
          </div>
        </div>

        {/* High-risk banner */}
        {riskCounts.high > 0 && riskFilter !== "high" ? (
          <div className="highRiskBanner">
            <span className="chip chipRisk chipRisk-high">
              {UI.highRiskBannerTitle}: {riskCounts.high}
            </span>
            <span style={{ opacity: 0.8 }}>{UI.highRiskBannerText}</span>
            <button
              className="btn"
              onClick={() => {
                setRiskFilter("high");
                setSortMode("risk");
              }}
              disabled={loading}
              style={{ marginLeft: "auto" }}
            >
              {UI.showHighRisk}
            </button>
          </div>
        ) : null}

               {/* Empty / list states */}
        {loading && items.length === 0 ? (
          <div className="empty">
            <p>{UI.loading}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p>{UI.noThreadsYet}</p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => document.getElementById("contactName")?.focus()}
                disabled={loading}
              >
                {UI.addFirst}
              </button>

              <button
                className="btn"
                onClick={seedExamples}
                disabled={loading}
                style={{ marginLeft: 0 }}
              >
                {UI.seedExamples}
              </button>
            </div>
          </div>
        ) : dashboardList.length === 0 ? (
          <div className="empty">
            <p>{UI.noResults}</p>
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setStatusFilter("all");
                setRiskFilter("all");
                setSortMode("risk");
              }}
              disabled={loading}
            >
              {UI.clearFilters}
            </button>
          </div>
        ) : (
          <div className="list">
            {dashboardList.map((f) => {
              const today = todayYMD();
              const due = (f.dueAt || "").slice(0, 10);
              const overdue = f.status !== "done" && due && due < today;
              const cardClass = overdue ? "card cardOverdue" : "card";

              return (
               <div key={f.id} className={cardClass}>
  {/* LINKS */}
  <div className="cardContent">

    {/* Naam + bedrijf */}
    <div style={{ fontWeight: 700 }}>{f.contactName || "—"}</div>
    <div style={{ opacity: 0.8 }}>{f.companyName || "—"}</div>

   {/* Email */}
<div style={{ marginTop: 6, opacity: 0.85 }}>
  <b>{UI.email}:</b> {f.contactEmail || "—"}
</div>

{/* Auto-mail + toggle */}
<div
  style={{
    marginTop: 4,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }}
>
  <span style={{ opacity: 0.6 }}>{UI.autoEmail}:</span>

  <div
    className="toggle"
    onClick={() => onToggleEmailEnabled(f)}
  >
    <div className={`toggleTrack ${f.emailEnabled ? "on" : ""}`}>
      <div className="toggleThumb" />
    </div>
  </div>

  <span style={{ fontWeight: 600 }}>
  {f.emailEnabled ? "Actief" : "Uit"}
  </span>
  </div>

    {/* Next step */}
    <div style={{ marginTop: 10 }}>
      <b>{UI.next}:</b>{" "}
      {editNextId === f.id ? (
        <input
          className="input"
          value={draftNext(f.id)}
          autoFocus
          disabled={loading}
          onChange={(e) =>
            setDraftNextById((prev) => ({ ...prev, [f.id]: e.target.value }))
          }
          onBlur={() => saveEditNext(f.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEditNext(f.id);
            if (e.key === "Escape") cancelEditNext(f.id);
          }}
          style={{ maxWidth: 520 }}
        />
      ) : (
        <>
          <span
            role="button"
            tabIndex={0}
            onClick={() => startEditNext(f)}
            style={{ cursor: "pointer" }}
          >
            {f.nextStep || "—"}
          </span>
          <button
            className="btn"
            disabled={loading}
            style={{ marginLeft: 6, padding: "2px 6px", fontSize: 12 }}
            onClick={() => startEditNext(f)}
          >
            ✎
          </button>
        </>
      )}
    </div>

    {/* Status + datum */}
    <div
      className="cardMeta"
      style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}
    >
      <span className="chip chipOpen">{statusLabel(f.status)}</span>

      <span className="chip chipDue">
        {UI.due}:{" "}
        {editDueId === f.id ? (
          <input
            className="input"
            value={draftDue(f.id)}
            autoFocus
            disabled={loading}
            onChange={(e) =>
              setDraftDueById((prev) => ({ ...prev, [f.id]: e.target.value }))
            }
            onBlur={() => saveEditDue(f.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEditDue(f.id);
              if (e.key === "Escape") cancelEditDue(f.id);
            }}
            style={{ width: 140 }}
            placeholder={UI.placeholderDate}
          />
        ) : (
          <>
            <span
              role="button"
              tabIndex={0}
              onClick={() => startEditDue(f)}
              style={{ cursor: "pointer", fontWeight: 700 }}
            >
              {due || "—"}
            </span>

            {overdue ? (
              <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 600 }}>
                • Achterstallig
              </span>
            ) : null}
          </>
        )}
      </span>
    </div>

    {/* Risk */}
    {f.risk ? (
      <>
        <span className={`chip chipRisk chipRisk-${f.risk.level}`}>
          {UI.risk}: {riskLabel(f.risk.level)} ({f.risk.score})
        </span>

        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
          <div>
            <b>{UI.why}:</b> {(f.risk.reasons || []).join(" · ")}
          </div>
          <div>
            <b>{UI.advice}:</b> {suggestionNL(f.risk)}
          </div>
        </div>
      </>
    ) : null}

    {/* Email info */}
    <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
      <div>
        <b>{UI.emailStatus}:</b> {f.emailStatus || "off"}
      </div>
      <div>
        <b>{UI.lastEmail}:</b>{" "}
        {f.lastEmailSentAt ? String(f.lastEmailSentAt).slice(0, 16) : "—"}
      </div>
      <div>
        <b>{UI.nextEmail}:</b>{" "}
        {f.nextEmailAt ? String(f.nextEmailAt).slice(0, 16) : "—"}
      </div>
    </div>

  </div>

  {/* RECHTS */}
  <div className="cardActions">

    <button className="btn btnPrimary" onClick={() => onMove(f)} disabled={loading}>
      {UI.move}
    </button>

    <button className="btn btnSecondary" onClick={() => onSnooze(f, 1)} disabled={loading}>
      {UI.snooze1}
    </button>

    <button className="btn btnSecondary" onClick={() => onSnooze(f, 3)} disabled={loading}>
      {UI.snooze3}
    </button>

    <button className="btn btnSecondary" onClick={() => onSnooze(f, 7)} disabled={loading}>
      {UI.snooze7}
    </button>

    {f.contactEmail ? (
      <button className="btn btnGhost" onClick={() => onSendInitialEmail(f)} disabled={loading}>
        {UI.sendInitial}
      </button>
    ) : null}

    {f.contactEmail ? (
      <button className="btn btnGhost" onClick={() => onSendFollowupEmail(f)} disabled={loading}>
        {UI.sendFollowup}
      </button>
    ) : null}

    {f.status !== "done" ? (
      <button className="btn btnGhost" onClick={() => onDone(f)} disabled={loading}>
        {UI.done}
      </button>
    ) : (
      <button className="btn btnGhost" onClick={() => onReopen(f)} disabled={loading}>
        {UI.reopen}
      </button>
    )}

  </div>
</div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
