"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, PlusCircle, Users, Package, Settings as SettingsIcon,
  Calculator, TrendingUp, AlertTriangle, Bell, Trash2, Sun, PiggyBank, Wallet, Banknote, LogOut, Moon, CalendarDays, Share2, Gift, Receipt, MoreHorizontal
} from "lucide-react";
import ShareCard from "@/components/ShareCard";
import CsvImport from "@/components/CsvImport";
import PushToggle from "@/components/PushToggle";
import InstallPrompt from "@/components/InstallPrompt";
import { createClient } from "@/lib/supabase/client";
import { loadUserState, createUserState, saveField } from "@/lib/userState";

/* ------------------------------- helpers --------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* Display currency. The user picks one in Settings; every money figure uses it.
   (Soli's own subscription is billed by Stripe in USD regardless.) */
const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar (CA$)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
];
const curSymbol = (code) => (CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]).symbol;
let CUR = "$"; // active display symbol; set from the signed-in user's settings on each render
const money = (n) => CUR + (Math.round(n)).toLocaleString();
const money2 = (n) => CUR + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const SOURCES = [
  { id: "cash", label: "Cash" },
  { id: "venmo", label: "Venmo / Zelle" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
];
const srcLabel = (id) => (SOURCES.find(s => s.id === id) || {}).label || "Other";

/* --------------------------- seed sample data ---------------------------- */
function buildSeed() {
  const products = [
    { id: "p1", name: "Classic lash tray", cost: 3.0, stock: 8, unit: "set" },
    { id: "p2", name: "Volume lash fans", cost: 5.0, stock: 6, unit: "set" },
    { id: "p3", name: "Lash adhesive", cost: 4.0, stock: 4, unit: "set" },
    { id: "p4", name: "Under-eye pads", cost: 0.5, stock: 40, unit: "pair" },
    { id: "p5", name: "Brow tint", cost: 1.2, stock: 15, unit: "use" },
    { id: "p6", name: "Lamination solution", cost: 2.4, stock: 9, unit: "use" },
    { id: "p7", name: "Dermaplane blade", cost: 1.0, stock: 20, unit: "blade" },
    { id: "p8", name: "Chemical peel solution", cost: 6.0, stock: 5, unit: "use" },
    { id: "p9", name: "Soft wax", cost: 2.5, stock: 12, unit: "service" },
  ];
  const clients = [
    { id: "c1", name: "Maya R.", phone: "555-0142", notes: "Loves a dramatic volume set.", rebookWeeks: 3, lastVisit: daysAgo(24) },
    { id: "c2", name: "Jess T.", phone: "555-0188", notes: "Monthly peel. Avoid retinol week before.", rebookWeeks: 4, lastVisit: daysAgo(31) },
    { id: "c3", name: "Carla D.", phone: "555-0119", notes: "Brow lam + tint regular. Warm brown.", rebookWeeks: 6, lastVisit: daysAgo(15) },
    { id: "c4", name: "Ana P.", phone: "555-0177", notes: "Classic fills. Saturday AM.", rebookWeeks: 3, lastVisit: daysAgo(20) },
    { id: "c5", name: "Priya S.", phone: "555-0133", notes: "Dermaplane + facial combo.", rebookWeeks: 5, lastVisit: daysAgo(8) },
  ];
  const recipes = {
    "Classic full set": [120, 120, [["p1", 1], ["p3", 1], ["p4", 1]]],
    "Volume full set": [160, 150, [["p2", 1], ["p3", 1], ["p4", 1]]],
    "Lash fill": [65, 60, [["p1", 0.5], ["p3", 0.5], ["p4", 1]]],
    "Brow lamination + tint": [70, 60, [["p5", 1], ["p6", 1]]],
    "Dermaplaning": [75, 45, [["p7", 1]]],
    "Chemical peel": [95, 45, [["p8", 1]]],
    "Lip wax": [15, 15, [["p9", 0.3]]],
    "Lash removal": [25, 30, [["p3", 0.2]]],
  };
  const pCost = (pid) => products.find(p => p.id === pid).cost;
  const cost = (items) => items.reduce((s, [pid, q]) => s + pCost(pid) * q, 0);
  // [clientId, service, daysAgo, paySource]
  const plan = [
    ["c1", "Volume full set", 2, "venmo"], ["c4", "Classic full set", 4, "card"], ["c1", "Lash fill", 9, "cash"],
    ["c2", "Chemical peel", 3, "card"], ["c3", "Brow lamination + tint", 6, "venmo"], ["c5", "Dermaplaning", 1, "cash"],
    ["c4", "Lash fill", 11, "venmo"], ["c1", "Volume full set", 14, "card"], ["c2", "Lip wax", 16, "cash"],
    ["c3", "Lip wax", 7, "cash"], ["c5", "Chemical peel", 8, "card"], ["c4", "Classic full set", 18, "venmo"],
    ["c1", "Lash fill", 21, "cash"], ["c2", "Dermaplaning", 22, "card"], ["c3", "Brow lamination + tint", 15, "venmo"],
    ["c4", "Lip wax", 25, "cash"], ["c5", "Lash removal", 19, "venmo"], ["c1", "Volume full set", 26, "card"],
    ["c2", "Chemical peel", 31, "card"], ["c4", "Lash fill", 28, "cash"], ["c3", "Lip wax", 12, "venmo"],
    ["c5", "Dermaplaning", 5, "card"], ["c1", "Lash fill", 3, "venmo"], ["c4", "Classic full set", 6, "card"],
    ["c2", "Lip wax", 2, "cash"], ["c3", "Brow lamination + tint", 1, "card"],
  ];
  const logs = plan.map(([cid, svc, d, src]) => {
    const [price, dur, items] = recipes[svc];
    return { id: uid(), clientId: cid, service: svc, price, durationMin: dur, paySource: src,
      productCost: Math.round(cost(items) * 100) / 100, date: daysAgo(d) };
  });
  return { products, clients, logs,
    settings: { boothRentHourly: 12, taxRate: 30 },
    plan: { goal: 3000, monthlyRent: 1400, avgPrice: 90, capacity: 18 } };
}

/* ------------------------------ calc engine ------------------------------ */
function profitOf(log, rent) {
  const booth = (log.durationMin / 60) * rent;
  const profit = log.price - log.productCost - booth;
  /* A rate needs time, and a margin needs a price. Dividing by zero produced
     Infinity and NaN, which reached the screen as "$∞" and "$NaN". Imported
     services often arrive with no duration, so this is reachable. null means
     "cannot be worked out" and the screens say so instead of printing a symbol. */
  const hours = log.durationMin / 60;
  return {
    booth,
    profit,
    perHour: hours > 0 ? profit / hours : null,
    margin: log.price > 0 ? profit / log.price : null,
  };
}

/* ----------------------------- defaults ---------------------------------- */
/* Sensible starting values for the editable config/calculator inputs. These
   are NOT sample data. Clients, products and logged services all start empty
   so each user works entirely from their own real numbers. */
const DEFAULT_SETTINGS = { boothRentHourly: 12, taxRate: 30 };
const DEFAULT_PLAN = { goal: 3000, monthlyRent: 1400, avgPrice: 90, capacity: 18 };

/* How much of a product is left, worked out from the amount last recorded as on
   hand minus what services have used since. Deriving it means editing or
   deleting a service corrects the stock automatically, where a running counter
   would drift out of step with reality and could never be trusted again. */
function stockFor(product, logs) {
  const stocked = Number(product.stocked) || 0;
  if (!stocked || !product.stockedAt) return null; // not tracking this one
  const since = new Date(product.stockedAt).getTime();
  let used = 0, uses = 0;
  (logs || []).forEach((l) => {
    if (new Date(l.date).getTime() < since) return;
    const q = Number(l.qty && l.qty[product.id]) || 0;
    if (q > 0) { used += q; uses += 1; }
  });
  const remaining = Math.max(0, stocked - used);
  const perUse = uses > 0 ? used / uses : 0;
  return {
    stocked, used, remaining,
    pct: remaining / stocked,
    // Only estimate services left once there is real usage to average.
    servicesLeft: perUse > 0 ? Math.floor(remaining / perUse) : null,
  };
}
const isLowStock = (s) => !!s && (s.remaining <= 0 || s.pct <= 0.2 || (s.servicesLeft !== null && s.servicesLeft <= 3));

/* Business overhead categories. These are costs that are not tied to one
   service, so they never touch profitOf. Folding them into per-service profit
   would distort which services are actually worth doing. */
const EXPENSE_CATEGORIES = [
  "Booth or chair rent",
  "Supplies",
  "Mileage and travel",
  "Insurance",
  "Software and subscriptions",
  "Education and training",
  "Licensing and fees",
  "Marketing",
  "Other",
];
const RENT_CATEGORY = "Booth or chair rent";

/* Specialties (for the product filter + starter products). */
const SPECIALTIES = [
  { key: "esthetician", label: "Esthetician" },
  { key: "barber", label: "Barber" },
  { key: "cosmo", label: "Cosmetologist / Stylist" },
  { key: "nails", label: "Nail tech" },
];
const specialtyLabel = (k) => (SPECIALTIES.find((s) => s.key === k) || {}).label || "";

/* Opens the phone's messaging app with a friendly rebooking note already
   written, so a nudge is one tap. The pro can edit it before sending. */
const rebookSms = (phone, name) =>
  `sms:${String(phone || "").replace(/[^0-9+]/g, "")}?&body=${encodeURIComponent(
    `Hi ${String(name || "").split(" ")[0]}! It has been a little while since your last visit. Want me to get you back on the books?`
  )}`;

/* Small starter product lists per specialty: [name, totalCost, amount, unit]. */
const STARTER_PRODUCTS = {
  esthetician: [["Cleanser", 24, 240, "ml"], ["Serum", 40, 30, "ml"], ["Mask", 30, 200, "ml"], ["Wax", 20, 400, "g"], ["Gloves", 8, 100, "pair"]],
  barber: [["Clipper oil", 6, 120, "ml"], ["Blade wash", 8, 500, "ml"], ["Neck strips", 7, 100, "strip"], ["Pomade", 14, 100, "g"], ["Talc", 5, 300, "g"]],
  cosmo: [["Color tube", 9, 60, "g"], ["Developer", 12, 1000, "ml"], ["Foils", 10, 500, "sheet"], ["Shampoo", 18, 1000, "ml"], ["Toner", 11, 60, "g"]],
  nails: [["Gel polish", 9, 15, "ml"], ["Base/top coat", 12, 15, "ml"], ["Acrylic powder", 20, 240, "g"], ["Nail file", 6, 50, "file"], ["Acetone", 7, 1000, "ml"]],
};

/* Booth rent can be entered hourly / weekly / monthly. We convert everything to
   an hourly rate so profitOf (unchanged) keeps working the same way. */
const boothHourly = (s) => {
  const unit = s.boothRentUnit || "hour";
  const amt = Number(s.boothRentAmount);
  const hpw = Number(s.boothRentHoursPerWeek) || 0;
  if (unit === "week" && amt > 0 && hpw > 0) return amt / hpw;
  if (unit === "month" && amt > 0 && hpw > 0) return (amt * 12 / 52) / hpw;
  if (unit === "hour" && s.boothRentAmount !== undefined && s.boothRentAmount !== "") return amt || 0;
  return Number(s.boothRentHourly) || 0; // legacy accounts
};

/* Week helpers (weeks start Monday). */
const weekStartMs = (d) => { const dt = new Date(d); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dt.getTime(); };
const weekLabel = (ms) => "Week of " + new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const isoWeekNum = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const wk1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - wk1) / 864e5 - 3 + ((wk1.getDay() + 6) % 7)) / 7); };

/* Cost of one unit of a product. If a total `amount` is set, the product's
   `cost` is the total cost and we divide (e.g. $10 / 100g = $0.10/g). If no
   amount, `cost` is treated as a flat per-use cost, exactly like before. */
const perUnitCost = (p) => (p && Number(p.amount) > 0 ? p.cost / p.amount : (p ? Number(p.cost) || 0 : 0));


/* ================================ APP ==================================== */
export default function Soli() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refBanner, setRefBanner] = useState("");
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState("dash");
  const [theme, setTheme] = useState("light");
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"); }, []);
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("soli-theme", next); } catch {}
    setTheme(next);
  };
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [comped, setComped] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [expensesReady, setExpensesReady] = useState(true);
  const [billingBusy, setBillingBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw new Error("Auth check failed: " + authErr.message);
        if (!user) { router.replace("/login"); return; }
        setUserId(user.id);
        setEmail(user.email || "");

        // Load this user's row, creating an empty one (with a 14-day trial) on first login.
        let row = await loadUserState(supabase, user.id);
        if (!row) {
          row = await createUserState(supabase, user.id, {
            settings: DEFAULT_SETTINGS, clients: [], products: [], logs: [], plan: DEFAULT_PLAN,
            demo_seeded: false, trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(),
          });
        }
        let { settings: s, clients: c, products: pr, logs: lg, plan: pl, demo_seeded,
          trial_ends_at: trialEnd, subscription_status: sub } = row;
        s = s || DEFAULT_SETTINGS; c = c || []; pr = pr || []; lg = lg || []; pl = pl || DEFAULT_PLAN;
        // Read comp status separately so a missing column (before the migration) never breaks the app.
        try {
          const { data: cr } = await supabase.from("user_state").select("comped").eq("user_id", user.id).maybeSingle();
          setComped(!!(cr && cr.comped));
        } catch { /* comped column not added yet */ }
        // Same for expenses, read on its own so a missing column never breaks the app.
        // Supabase resolves with an error object rather than throwing, so the error
        // has to be checked explicitly. Getting this wrong would show a working form
        // whose entries silently vanish on the next load.
        try {
          const { data: er, error: eErr } = await supabase.from("user_state").select("expenses").eq("user_id", user.id).maybeSingle();
          if (eErr) { setExpensesReady(false); }
          else { setExpenses(Array.isArray(er?.expenses) ? er.expenses : []); setExpensesReady(true); }
        } catch { setExpensesReady(false); }

        // "Try it with sample data" deep-link (/app?demo=1). Seeds at most once,
        // and only when the account has no data yet, so it never overwrites real work.
        const params = new URLSearchParams(window.location.search);
        const wantsDemo = params.get("demo") === "1";
        if (wantsDemo && lg.length === 0 && !demo_seeded) {
          const seed = buildSeed();
          s = seed.settings; c = seed.clients; pr = seed.products; lg = seed.logs; pl = seed.plan;
          await saveField(supabase, user.id, "settings", s);
          await saveField(supabase, user.id, "clients", c);
          await saveField(supabase, user.id, "products", pr);
          await saveField(supabase, user.id, "logs", lg);
          await saveField(supabase, user.id, "plan", pl);
          await saveField(supabase, user.id, "demo_seeded", true);
        }

        // Returning straight from Checkout: reconcile with Stripe before showing the
        // UI so Pro appears immediately, independent of webhook timing/config.
        if (params.get("upgraded") === "1") {
          try {
            const d = await (await fetch("/api/subscription", { method: "POST" })).json();
            if (d && d.status !== undefined) sub = d.status;
          } catch { /* the background reconcile below will catch up */ }
        }

        setSettings(s); setClients(c); setProducts(pr); setLogs(lg); setPlan(pl);
        setTrialEndsAt(trialEnd); setSubStatus(sub);
        if (wantsDemo || params.get("upgraded") === "1") window.history.replaceState({}, "", "/app");
        setLoading(false);

        // Background: keep subscription status honest with Stripe on every load, so a
        // missed webhook self-heals and cancellations are caught. Non-blocking.
        fetch("/api/subscription", { method: "POST" })
          .then((r) => r.json())
          .then((d) => { if (d && d.status !== undefined && d.status !== sub) setSubStatus(d.status); })
          .catch(() => {});

        // If they arrived from someone's referral link, claim it once. The stored
        // code is cleared either way so a failed claim can't retry forever.
        try {
          const pending = localStorage.getItem("soli-ref");
          if (pending) {
            const r = await fetch("/api/referral", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: pending }),
            });
            const d = await r.json().catch(() => ({}));
            localStorage.removeItem("soli-ref");
            if (d?.ok && !d.already && d.rewardDays) {
              const fresh = await loadUserState(supabase, user.id);
              if (fresh?.trial_ends_at) setTrialEndsAt(fresh.trial_ends_at);
              setRefBanner(`Referral applied. You have ${d.rewardDays} extra days on your trial.`);
            }
          }
        } catch { /* never let a referral problem block the app */ }
      } catch (e) {
        console.error(e);
        setLoadError(e?.message || String(e));
        setLoading(false);
      }
    })();
  }, [supabase, router]);

  const goCheckout = async (plan = "monthly") => {
    setBillingBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      alert(data.error || "Could not start checkout.");
    } catch { alert("Could not start checkout."); }
    setBillingBusy(false);
  };
  const goPortal = async () => {
    setBillingBusy(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      alert(data.error || "Could not open billing.");
    } catch { alert("Could not open billing."); }
    setBillingBusy(false);
  };
  const redeemCode = async (code) => {
    try {
      const res = await fetch("/api/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const d = await res.json();
      if (d.ok) { setComped(true); return { ok: true }; }
      return { ok: false, error: d.error || "That code isn't valid." };
    } catch { return { ok: false, error: "Something went wrong. Try again." }; }
  };

  const saveLogs = (v) => { setLogs(v); if (userId) saveField(supabase, userId, "logs", v); };

  /* Writes imported services in, matching clients by name so a history import
     lands against the people already in the account instead of duplicating
     them. lastVisit only moves forward, since importing old work should not
     make someone look freshly seen and drop them out of rebooking reminders. */
  const importServices = (incoming) => {
    const byName = {};
    clients.forEach((c) => { byName[c.name.trim().toLowerCase()] = c; });

    const newClients = [];
    const touched = {};
    const newLogs = incoming.map((r) => {
      let cid = "";
      const key = r.client.trim().toLowerCase();
      if (key) {
        const hit = byName[key];
        if (hit) cid = hit.id;
        else {
          const made = { id: uid(), name: r.client.trim(), phone: "", notes: "", rebookWeeks: 4, lastVisit: r.date };
          byName[key] = made; newClients.push(made); cid = made.id;
        }
        if (!touched[cid] || new Date(r.date) > new Date(touched[cid])) touched[cid] = r.date;
      }
      return {
        id: uid(), clientId: cid, service: r.service, price: r.price,
        durationMin: r.durationMin, tip: r.tip, paySource: r.paySource,
        productCost: 0, date: r.date, imported: true,
      };
    });

    const merged = [...clients, ...newClients].map((c) => {
      const seen = touched[c.id];
      if (!seen) return c;
      return (!c.lastVisit || new Date(seen) > new Date(c.lastVisit)) ? { ...c, lastVisit: seen } : c;
    });

    saveClients(merged);
    saveLogs([...newLogs, ...logs].sort((a, b) => new Date(b.date) - new Date(a.date)));

    /* Turn the imported work into quick-log templates too, using each service's
       most recent price and length. Someone who brings their history over
       almost certainly performs those same services, so this saves them
       rebuilding their menu by hand. */
    const have = new Set(templates.map((t) => t.name.trim().toLowerCase()));
    const seen = {};
    newLogs.forEach((l) => {
      const key = l.service.trim().toLowerCase();
      if (!key || have.has(key)) return;
      const prev = seen[key];
      if (!prev || new Date(l.date) > new Date(prev.date)) {
        seen[key] = { date: l.date, name: l.service.trim(), price: l.price, durationMin: l.durationMin, paySource: l.paySource };
      }
    });
    const madeTpls = Object.values(seen).map((t) => ({
      id: uid(), name: t.name, price: t.price, durationMin: t.durationMin, paySource: t.paySource || "card", qty: {},
    }));
    if (madeTpls.length) saveTemplates([...madeTpls, ...templates]);

    return { services: newLogs.length, clients: newClients.length, templates: madeTpls.length };
  };
  // A mistyped price would otherwise stay wrong forever and quietly skew every
  // figure, including the tax export, so logged services must be fixable.
  const updateLog = (id, patch) => saveLogs(logs.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const deleteLog = (id) => saveLogs(logs.filter((l) => l.id !== id));
  const saveClients = (v) => { setClients(v); if (userId) saveField(supabase, userId, "clients", v); };
  const saveProducts = (v) => { setProducts(v); if (userId) saveField(supabase, userId, "products", v); };
  const saveSettings = (v) => { setSettings(v); if (userId) saveField(supabase, userId, "settings", v); };
  const savePlan = (v) => { setPlan(v); if (userId) saveField(supabase, userId, "plan", v); };
  const saveExpenses = (v) => { setExpenses(v); if (userId) saveField(supabase, userId, "expenses", v); };

  // Service templates live inside the settings blob (no schema change needed).
  const templates = settings.templates || [];
  const saveTemplates = (v) => saveSettings({ ...settings, templates: v });

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const deleteAccount = async () => {
    try {
      const r = await fetch("/api/account/delete", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: d.error || "Could not delete the account." };
      await supabase.auth.signOut();
      window.location.assign("/");
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not reach the server. Please try again." };
    }
  };

  // Optional explore/reset tools surfaced in Settings.
  const loadSample = () => {
    const seed = buildSeed();
    saveSettings(seed.settings); saveClients(seed.clients);
    saveProducts(seed.products); saveLogs(seed.logs); savePlan(seed.plan);
    setTab("dash");
  };
  const clearAll = () => {
    saveClients([]); saveProducts([]); saveLogs([]);
    saveSettings(DEFAULT_SETTINGS); savePlan(DEFAULT_PLAN);
  };

  CUR = curSymbol(settings.currency); // keep money() in the user's chosen currency
  const rent = boothHourly(settings);
  const taxRate = settings.taxRate;

  // Access: active subscription, a payment-retry grace period, or the free trial.
  const isSubscribed = subStatus === "active" || subStatus === "trialing";
  const inGrace = subStatus === "past_due"; // renewal failed; Stripe is retrying, keep access and nudge to fix
  const msLeft = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const inTrial = msLeft > 0;
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / 864e5));
  const hasAccess = comped || isSubscribed || inGrace || inTrial;

  const nav = [
    { id: "dash", label: "Dashboard", Icon: LayoutDashboard },
    { id: "week", label: "Weekly", Icon: CalendarDays },
    { id: "log", label: "Log service", Icon: PlusCircle },
    { id: "plan", label: "What to charge", Icon: Calculator },
    { id: "clients", label: "Clients", Icon: Users },
    { id: "inv", label: "Inventory", Icon: Package },
    { id: "exp", label: "Expenses", Icon: Receipt },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  if (loadError) return (
    <div className="soli-root soli-center"><Styles />
      <div style={{ maxWidth: 460, textAlign: "center", padding: 24 }}>
        <div className="soli-loadmark" style={{ margin: "0 auto 16px", animation: "none", background: "var(--clay-d)" }}><AlertTriangle size={24} /></div>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, margin: "0 0 8px" }}>We couldn't load your data</h2>
        <p style={{ color: "var(--ink2)", fontSize: 14, margin: "0 0 16px" }}>{loadError}</p>
        <button className="soli-cta" style={{ maxWidth: 260, margin: "0 auto" }} onClick={() => location.reload()}>Try again</button>
        <button className="soli-navbtn soli-signout" style={{ margin: "12px auto 0" }} onClick={signOut}><LogOut size={16} /> Sign out</button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="soli-root soli-center"><Styles /><div className="soli-loadmark"><Sun size={26} strokeWidth={1.6} /></div></div>
  );

  if (!hasAccess) return <Paywall email={email} onSubscribe={goCheckout} onSignOut={signOut} busy={billingBusy} onRedeem={redeemCode} />;

  return (
    <div className="soli-root">
      <Styles />
      <header className="soli-header">
        <div className="soli-brand">
          <span className="soli-logomark"><Sun size={18} strokeWidth={1.8} /></span>
          <span className="soli-wordmark">Soli</span>
          <span className="soli-tag">know what you actually keep</span>
        </div>
        <nav className="soli-nav">
          {nav.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={"soli-navbtn" + (tab === id ? " active" : "")}>
              <Icon size={16} strokeWidth={1.9} /><span>{label}</span>
            </button>
          ))}
          <button onClick={toggleTheme} className="soli-navbtn soli-themebtn" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun size={16} strokeWidth={1.9} /> : <Moon size={16} strokeWidth={1.9} />}
          </button>
          <button onClick={signOut} className="soli-navbtn soli-signout" title={email ? `Signed in as ${email}` : "Sign out"}>
            <LogOut size={16} strokeWidth={1.9} /><span>Sign out</span>
          </button>
        </nav>
      </header>

      {/* Phone navigation. Nine items wrapped across three rows on a small
          screen, so the ones used daily move to a thumb-reachable bar and the
          rest live behind More. The header nav is hidden at this width. */}
      <nav className="soli-tabbar">
        {[
          { id: "dash", label: "Home", Icon: LayoutDashboard },
          { id: "week", label: "Weekly", Icon: CalendarDays },
          { id: "log", label: "Log", Icon: PlusCircle, primary: true },
          { id: "clients", label: "Clients", Icon: Users },
        ].map(({ id, label, Icon, primary }) => (
          <button key={id} onClick={() => { setTab(id); setMoreOpen(false); }}
            className={"soli-tabbtn" + (tab === id ? " active" : "") + (primary ? " primary" : "")}>
            <Icon size={20} strokeWidth={1.9} /><span>{label}</span>
          </button>
        ))}
        <button className={"soli-tabbtn" + (moreOpen ? " active" : "")} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <MoreHorizontal size={20} strokeWidth={1.9} /><span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="soli-sheet soli-sheet-bottom" onClick={() => setMoreOpen(false)}>
          <div className="soli-moresheet" onClick={(e) => e.stopPropagation()}>
            <div className="soli-sheethead">
              <h2>More</h2>
              <button className="soli-sheetx" onClick={() => setMoreOpen(false)} aria-label="Close">&times;</button>
            </div>
            <div className="soli-morelist">
              {nav.filter((n) => !["dash", "week", "log", "clients"].includes(n.id)).map(({ id, label, Icon }) => (
                <button key={id} className={"soli-moreitem" + (tab === id ? " active" : "")}
                  onClick={() => { setTab(id); setMoreOpen(false); }}>
                  <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
                </button>
              ))}
              <button className="soli-moreitem" onClick={toggleTheme}>
                {theme === "dark" ? <Sun size={18} strokeWidth={1.9} /> : <Moon size={18} strokeWidth={1.9} />}
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              <button className="soli-moreitem danger" onClick={signOut}>
                <LogOut size={18} strokeWidth={1.9} /><span>Sign out</span>
              </button>
            </div>
            {email && <p className="soli-help" style={{ textAlign: "center" }}>Signed in as {email}</p>}
          </div>
        </div>
      )}

      <main className="soli-main">
        {!comped && !isSubscribed && !inGrace && inTrial && (
          <div className="soli-trialbar">
            <span><Sun size={14} strokeWidth={2} /> {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left in your free trial</span>
            <button onClick={() => setTab("settings")}>See plans</button>
          </div>
        )}
        {inGrace && (
          <div className="soli-trialbar grace">
            <span><AlertTriangle size={14} strokeWidth={2} /> There's a problem with your last payment. Update your card to keep Soli Pro.</span>
            <button onClick={goPortal} disabled={billingBusy}>{billingBusy ? "One moment…" : "Update payment"}</button>
          </div>
        )}
        <InstallPrompt />
        {refBanner && (
          <div className="soli-trialbar" style={{ background: "linear-gradient(150deg,#5E7142,#475431)" }}>
            <span><Gift size={14} strokeWidth={2} /> {refBanner}</span>
            <button onClick={() => setRefBanner("")}>Got it</button>
          </div>
        )}
        {tab === "dash" && <Dashboard logs={logs} clients={clients} rent={rent} taxRate={taxRate} setTab={setTab} buckets={settings.buckets || []} plan={plan} savePlan={savePlan}
          settings={settings} templates={settings.templates || []} onHideOnboarding={() => saveSettings({ ...settings, hideOnboarding: true })} />}
        {tab === "week" && <WeeklyView logs={logs} rent={rent} taxRate={taxRate} />}
        {tab === "log" && <LogService clients={clients} products={products} saveClients={saveClients}
          logs={logs} saveLogs={saveLogs} rent={rent} taxRate={taxRate}
          templates={templates} saveTemplates={saveTemplates} specialty={settings.specialty}
          updateLog={updateLog} deleteLog={deleteLog} />}
        {tab === "plan" && <Planner plan={plan} savePlan={savePlan} taxRate={taxRate} logs={logs} boothRate={rent} />}
        {tab === "clients" && <ClientsView clients={clients} logs={logs} saveClients={saveClients} rent={rent} />}
        {tab === "inv" && <Inventory products={products} saveProducts={saveProducts} specialty={settings.specialty} logs={logs} />}
        {tab === "exp" && <ExpensesView expenses={expenses} saveExpenses={saveExpenses} ready={expensesReady} />}
        {tab === "settings" && <SettingsView settings={settings} saveSettings={saveSettings} loadSample={loadSample} clearAll={clearAll}
          isSubscribed={isSubscribed} inTrial={inTrial} trialDaysLeft={trialDaysLeft} onSubscribe={goCheckout} onManage={goPortal} billingBusy={billingBusy} email={email}
          comped={comped} onRedeem={redeemCode}
          logs={logs} clients={clients} rent={rent} expenses={expenses} products={products} plan={plan} onDeleteAccount={deleteAccount} onImportServices={importServices} />}
      </main>
      <footer className="soli-appfoot">
        Have feedback or a feature request?{" "}
        <a href="mailto:trysoli.beauty@gmail.com?subject=Soli%20feedback">trysoli.beauty@gmail.com</a>
      </footer>
    </div>
  );
}

/* ------------------------------ DASHBOARD -------------------------------- */
function Dashboard({ logs, clients, rent, taxRate, setTab, buckets = [], plan = {}, savePlan, settings = {}, templates = [], onHideOnboarding }) {
  const t = taxRate / 100;
  const now = Date.now();
  const [range, setRange] = useState("30d");
  const [shareOpen, setShareOpen] = useState(false);
  const rangeTitle = { "30d": "Last 30 days", "90d": "Last 90 days", year: "This year", all: "All time" }[range];
  const startMs = range === "all" ? 0
    : range === "year" ? new Date(new Date().getFullYear(), 0, 1).getTime()
    : now - (range === "90d" ? 90 : 30) * 864e5;
  const month = logs.filter(l => new Date(l.date).getTime() >= startMs);
  const totals = month.reduce((a, l) => {
    const { booth, profit } = profitOf(l, rent);
    a.rev += l.price; a.prod += l.productCost; a.booth += booth; a.profit += profit; a.tips += (Number(l.tip) || 0); return a;
  }, { rev: 0, prod: 0, booth: 0, profit: 0, tips: 0 });
  const setAside = totals.profit * t;
  const takeHome = totals.profit - setAside;
  const totalTips = totals.tips;
  const pocketed = takeHome + totalTips;

  // Goal progress always uses the current calendar month, whatever range is
  // selected above. The goal is a monthly one, so measuring 90 days or a whole
  // year against it would overstate progress.
  const goal = Number(plan.goal) || 0;
  const goalStats = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dayOfMonth = d.getDate();
    const kept = logs
      .filter((l) => new Date(l.date).getTime() >= start)
      .reduce((s, l) => s + profitOf(l, rent).profit * (1 - t) + (Number(l.tip) || 0), 0);
    const daysLeft = daysInMonth - dayOfMonth;
    return {
      kept,
      pct: goal > 0 ? Math.min(100, Math.round((kept / goal) * 100)) : 0,
      remaining: Math.max(0, goal - kept),
      daysLeft,
      monthLabel: d.toLocaleDateString(undefined, { month: "long" }),
      // Simple arithmetic, not a forecast: what is left divided by days left.
      perDay: daysLeft > 0 ? Math.max(0, goal - kept) / daysLeft : null,
    };
  }, [logs, rent, t, goal]);

  // Trend vs the previous equal-length window (only for the rolling day ranges).
  const isRolling = range === "30d" || range === "90d";
  const rollDays = range === "90d" ? 90 : 30;
  const prevMonth = isRolling ? logs.filter(l => {
    const d = new Date(l.date).getTime();
    return d < now - rollDays * 864e5 && d >= now - 2 * rollDays * 864e5;
  }) : [];
  const prevAgg = prevMonth.reduce((a, l) => {
    a.profit += profitOf(l, rent).profit; a.tips += (Number(l.tip) || 0); return a;
  }, { profit: 0, tips: 0 });
  const prevPocketed = prevAgg.profit * (1 - t) + prevAgg.tips;
  const trendDiff = pocketed - prevPocketed;
  const trendPct = prevPocketed > 0 ? Math.round((trendDiff / prevPocketed) * 100) : null;
  const hasPrev = isRolling && prevMonth.length > 0;
  const svcDelta = month.length - prevMonth.length;

  // Take-home per calendar month for the last 12 months (the year view).
  const byMonth = useMemo(() => {
    const m = {};
    logs.forEach(l => {
      const d = new Date(l.date);
      const key = d.getFullYear() + "-" + d.getMonth();
      m[key] = (m[key] || 0) + (profitOf(l, rent).profit * (1 - t) + (Number(l.tip) || 0));
    });
    const out = []; const base = new Date();
    for (let i = 11; i >= 0; i--) {
      const dd = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({ label: dd.toLocaleDateString(undefined, { month: "short" }), val: m[dd.getFullYear() + "-" + dd.getMonth()] || 0 });
    }
    return out;
  }, [logs, rent, t]);
  const maxMonth = Math.max(...byMonth.map(x => x.val), 1);

  // income by source
  const bySource = useMemo(() => {
    const m = {}; month.forEach(l => { m[l.paySource || "other"] = (m[l.paySource || "other"] || 0) + l.price; });
    return m;
  }, [month]);
  const offCard = (bySource.cash || 0) + (bySource.venmo || 0) + (bySource.other || 0);

  const byService = useMemo(() => {
    const m = {};
    month.forEach(l => {
      const { profit } = profitOf(l, rent); const k = l.service;
      m[k] = m[k] || { name: k, count: 0, profit: 0, hours: 0 };
      m[k].count++; m[k].profit += profit; m[k].hours += l.durationMin / 60;
    });
    // Services with no recorded time have no hourly rate. They still show, with
    // their average, but sort last rather than ranking above everything.
    return Object.values(m)
      .map(s => ({ ...s, perHour: s.hours > 0 ? s.profit / s.hours : null, avg: s.profit / s.count }))
      .sort((a, b) => {
        if (a.perHour === null && b.perHour === null) return b.profit - a.profit;
        if (a.perHour === null) return 1;
        if (b.perHour === null) return -1;
        return b.perHour - a.perHour;
      });
  }, [month, rent]);
  const rated = byService.filter(s => s.perHour !== null);
  const maxPH = Math.max(...rated.map(s => s.perHour), 1);
  // Only judge a service as a thin earner once there is time to judge it by.
  const watch = rated.filter(s => s.perHour < rent * 2.5);

  const due = clients.map(c => {
    const dueDate = new Date(new Date(c.lastVisit).getTime() + c.rebookWeeks * 7 * 864e5);
    return { ...c, overdue: Math.round((Date.now() - dueDate) / 864e5) };
  }).filter(c => c.overdue >= -3).sort((a, b) => b.overdue - a.overdue);

  if (logs.length === 0) {
    return (
      <div className="soli-page">
        <h1 className="soli-h1">Welcome to Soli</h1>
        <p className="soli-sub">Your numbers will appear here as soon as you start logging your own work.</p>
        {!settings.hideOnboarding && (
          <GettingStarted settings={settings} templates={templates} logs={logs} setTab={setTab} onDismiss={onHideOnboarding} />
        )}
        <div className="soli-empty">
          <span className="soli-emptymark"><Sun size={26} strokeWidth={1.8} /></span>
          <h2>No services logged yet</h2>
          <p>Log your first service and Soli shows your real take-home, after product, booth rent &amp; taxes. Everything here is built from your own numbers.</p>
          <button className="soli-cta" onClick={() => setTab("log")}><PlusCircle size={18} /> Log your first service</button>
        </div>
        <p className="soli-emptyhint">Just exploring? You can load a sample data set from <b>Settings</b> to see how it all works, then clear it anytime.</p>
      </div>
    );
  }

  return (
    <div className="soli-page">
      <div className="soli-dashhead">
        <h1 className="soli-h1">{rangeTitle}</h1>
        <div className="soli-rangeseg">
          {[["30d", "30d"], ["90d", "90d"], ["year", "Year"], ["all", "All"]].map(([k, lbl]) => (
            <button key={k} className={"soli-rangebtn" + (range === k ? " on" : "")} onClick={() => setRange(k)}>{lbl}</button>
          ))}
        </div>
      </div>
      <p className="soli-sub">{month.length} services{hasPrev ? ` (${svcDelta >= 0 ? "+" : ""}${svcDelta} vs prev ${rollDays}d)` : ""} · booth {money2(rent)}/hr · taxes set at {taxRate}%</p>

      {/* take-home hero */}
      <div className="soli-hero">
        <div className="soli-heroblock">
          <span className="soli-herolabel"><Wallet size={14} /> {totalTips > 0 ? "Take-home + tips" : "Your real take-home"}</span>
          <span className="soli-heroval">{money2(pocketed)}</span>
          <span className="soli-herosub">{totalTips > 0 ? `${money2(takeHome)} kept + ${money2(totalTips)} in tips` : "after product, booth rent & taxes"}</span>
          {hasPrev && (
            <span className={"soli-herodelta " + (trendDiff >= 0 ? "up" : "down")}>
              {trendDiff >= 0 ? "▲" : "▼"} {trendPct != null ? `${Math.abs(trendPct)}%` : money2(Math.abs(trendDiff))} vs previous {rollDays} days
            </span>
          )}
        </div>
        <div className="soli-herojar">
          <span className="soli-jarlabel"><PiggyBank size={14} /> Tax jar</span>
          <span className="soli-jarval">{money2(setAside)}</span>
          <span className="soli-herosub">set this aside, don't spend it</span>
        </div>
      </div>

      {!settings.hideOnboarding && (
        <GettingStarted settings={settings} templates={templates} logs={logs} setTab={setTab} onDismiss={onHideOnboarding} />
      )}

      <GoalCard goal={goal} stats={goalStats} savePlan={savePlan} plan={plan} />

      {month.length > 0 && (
        <button className="soli-sharebtn" onClick={() => setShareOpen(true)}>
          <Share2 size={15} strokeWidth={1.9} /> Share this {range === "30d" ? "month" : "run"}
        </button>
      )}
      <ShareCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        amount={money2(pocketed)}
        period={rangeTitle}
        statLeft={{ label: "Services", value: String(month.length) }}
        statRight={{ label: "Per hour", value: money2(rated.length ? rated[0].perHour : 0) }}
      />

      <div className="soli-cards">
        <Stat label="Revenue" value={money2(totals.rev)} tone="neutral" />
        <Stat label="Product" value={"– " + money2(totals.prod)} tone="cost" />
        <Stat label="Booth time" value={"– " + money2(totals.booth)} tone="cost" />
        <Stat label="Pre-tax profit" value={money2(totals.profit)} tone="profit" />
      </div>

      {/* take-home by month (the year view) */}
      <section className="soli-block">
        <div className="soli-blockhead"><TrendingUp size={18} strokeWidth={1.9} /><h2>Take-home by month</h2></div>
        <p className="soli-note">Your monthly take-home (profit after tax, plus tips) over the last 12 months. Tap or hover a bar for the amount.</p>
        <div className="soli-monthchart">
          {byMonth.map((mo, i) => (
            <div className="soli-monthcol" key={i} title={`${mo.label}: ${money2(mo.val)}`}>
              <div className="soli-monthval">{mo.val > 0 ? money(mo.val) : ""}</div>
              <div className="soli-monthbarwrap"><div className="soli-monthbar" style={{ height: Math.max(mo.val > 0 ? 4 : 0, (mo.val / maxMonth) * 100) + "%" }} /></div>
              <div className="soli-monthlabel">{mo.label}</div>
            </div>
          ))}
        </div>
      </section>

      {buckets.length > 0 && (
        <section className="soli-block">
          <div className="soli-blockhead"><PiggyBank size={18} strokeWidth={1.9} /><h2>Savings set-asides</h2></div>
          <p className="soli-note">Your own suggested set-asides from what you kept ({money2(takeHome)}) over {rangeTitle.toLowerCase()}. Tracker only, not financial advice.</p>
          <div className="soli-srcgrid">
            {buckets.map(b => (
              <div className="soli-srccell" key={b.id}>
                <span className="soli-srclabel">{b.name} · {b.pct}%</span>
                <span className="soli-srcval">{money2(takeHome * b.pct / 100)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* income by source */}
      <section className="soli-block">
        <div className="soli-blockhead"><Banknote size={18} strokeWidth={1.9} /><h2>Where your money came in</h2></div>
        <p className="soli-note">Booking apps only see card payments. Soli sees all of it, so your numbers are actually complete.</p>
        <div className="soli-srcgrid">
          {SOURCES.map(s => (
            <div className="soli-srccell" key={s.id}>
              <span className="soli-srclabel">{s.label}</span>
              <span className="soli-srcval">{money2(bySource[s.id] || 0)}</span>
            </div>
          ))}
        </div>
        {offCard > 0 && <div className="soli-srcnote">{money2(offCard)} came in outside card payments, captured here, so your numbers are actually complete.</div>}
      </section>

      {/* profit per hour */}
      <section className="soli-block">
        <div className="soli-blockhead"><TrendingUp size={18} strokeWidth={1.9} /><h2>Most profitable services, per hour</h2></div>
        <p className="soli-note">Based on service price only. Tips are excluded here so the ranking stays fair, and counted in your take-home above.</p>
        <div className="soli-bars">
          {byService.map(s => (
            <div className="soli-barrow" key={s.name}>
              <div className="soli-barlabel"><span>{s.name}</span><span className="soli-barval">{s.perHour === null ? "no time set" : money2(s.perHour) + "/hr"}</span></div>
              <div className="soli-bartrack"><div className="soli-barfill" style={{ width: (s.perHour === null ? 0 : (s.perHour / maxPH) * 100) + "%" }} /></div>
              <div className="soli-barmeta">{s.count}× · {money2(s.avg)} avg each</div>
            </div>
          ))}
        </div>
      </section>

      {watch.length > 0 && (
        <section className="soli-block soli-watch">
          <div className="soli-blockhead"><AlertTriangle size={18} strokeWidth={1.9} /><h2>Watch list: thin earners</h2></div>
          {watch.map(s => (
            <div className="soli-watchrow" key={s.name}><span>{s.name}</span><span className="soli-watchval">{money2(s.perHour)}/hr</span></div>
          ))}
        </section>
      )}

      <section className="soli-block">
        <div className="soli-blockhead"><Bell size={18} strokeWidth={1.9} /><h2>Rebooking reminders</h2></div>
        {due.length === 0 && <p className="soli-note">No one's due yet.</p>}
        {due.map(c => (
          <div className="soli-duerow" key={c.id}>
            <div><div className="soli-duename">{c.name}</div><div className="soli-duemeta">last {fmtDate(c.lastVisit)} · every {c.rebookWeeks}w</div></div>
            <div className="soli-dueactions">
              <span className={"soli-pill " + (c.overdue > 0 ? "late" : "soon")}>{c.overdue > 0 ? c.overdue + "d overdue" : "due soon"}</span>
              {c.phone && <a className="soli-textlink" href={rebookSms(c.phone, c.name)}>Text</a>}
            </div>
          </div>
        ))}
      </section>

      <button className="soli-cta" onClick={() => setTab("log")}><PlusCircle size={18} /> Log a service</button>
    </div>
  );
}

/* ---------------------------- GETTING STARTED ---------------------------- */
/* Shown only while setup is unfinished, then it disappears for good. Steps are
   worked out from real data rather than a stored "seen it" flag, so someone who
   set things up before this existed never sees it at all. */
function onboardingSteps({ settings, templates, logs }) {
  const rentSet = settings.boothRentAmount !== undefined && settings.boothRentAmount !== "";
  return [
    {
      key: "rent",
      done: rentSet,
      title: "Set your booth rent and tax rate",
      why: "Every take-home figure is built on these, so Soli's numbers are only yours once they are set.",
      cta: "Open Settings",
      tab: "settings",
    },
    {
      key: "services",
      done: templates.length > 0,
      title: "Add the services you offer",
      why: "Pick your trade for a starter list, or paste your menu from your booking app. Logging becomes one tap after this.",
      cta: "Add services",
      tab: "log",
    },
    {
      key: "log",
      done: logs.length > 0,
      title: "Log your first service",
      why: "This is where your real take-home appears. It takes about twenty seconds.",
      cta: "Log a service",
      tab: "log",
    },
  ];
}

function GettingStarted({ settings, templates, logs, setTab, onDismiss }) {
  const steps = onboardingSteps({ settings, templates, logs });
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // finished, so it stops appearing
  const next = steps.find((s) => !s.done);

  return (
    <section className="soli-onboard">
      <div className="soli-onboardtop">
        <div>
          <div className="soli-onboardtitle">Getting started</div>
          <div className="soli-onboardcount">{doneCount} of {steps.length} done</div>
        </div>
        <button className="soli-linkbtn" onClick={onDismiss}>Hide</button>
      </div>

      <div className="soli-onboardtrack">
        <div className="soli-onboardfill" style={{ width: Math.max(4, (doneCount / steps.length) * 100) + "%" }} />
      </div>

      <ol className="soli-onboardlist">
        {steps.map((s) => (
          <li key={s.key} className={"soli-onboardstep" + (s.done ? " done" : "") + (s === next ? " next" : "")}>
            <span className="soli-onboardmark">{s.done ? "✓" : ""}</span>
            <div className="soli-onboardbody">
              <div className="soli-onboardname">{s.title}</div>
              {s === next && <div className="soli-onboardwhy">{s.why}</div>}
            </div>
            {s === next && (
              <button className="soli-onboardcta" onClick={() => setTab(s.tab)}>{s.cta}</button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------- GOAL CARD ------------------------------- */
/* Progress toward the monthly take-home goal set in "What to charge". Uses the
   same goal value rather than a second one, so the two screens can never
   disagree. Editable here so the goal can be adjusted without leaving. */
function GoalCard({ goal, stats, savePlan, plan }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal || ""));
  useEffect(() => { setDraft(String(goal || "")); }, [goal]);

  const save = () => {
    const v = Math.max(0, Number(draft) || 0);
    savePlan({ ...plan, goal: v });
    setEditing(false);
  };

  if (!goal) {
    return (
      <div className="soli-goal">
        <div className="soli-goaltop">
          <span className="soli-goallabel">Monthly goal</span>
          {!editing && <button className="soli-linkbtn" onClick={() => setEditing(true)}>Set a goal</button>}
        </div>
        {editing ? (
          <div className="soli-goaledit">
            <input className="soli-input" type="number" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="3000" />
            <button className="soli-cta sm" onClick={save}>Save</button>
          </div>
        ) : (
          <p className="soli-help" style={{ marginTop: 0 }}>Set a monthly take-home target and watch it fill up as you log work.</p>
        )}
      </div>
    );
  }

  const met = stats.kept >= goal;
  return (
    <div className={"soli-goal" + (met ? " met" : "")}>
      <div className="soli-goaltop">
        <span className="soli-goallabel">{stats.monthLabel} goal</span>
        {editing ? (
          <div className="soli-goaledit">
            <input className="soli-input" type="number" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            <button className="soli-cta sm" onClick={save}>Save</button>
          </div>
        ) : (
          <button className="soli-linkbtn" onClick={() => setEditing(true)}>{money2(goal)} · edit</button>
        )}
      </div>

      <div className="soli-goalnums">
        <span className="soli-goalval">{money2(stats.kept)}</span>
        <span className="soli-goalpct">{stats.pct}%</span>
      </div>

      <div className="soli-goaltrack">
        <div className="soli-goalfill" style={{ width: Math.max(2, stats.pct) + "%" }} />
      </div>

      <div className="soli-goalfoot">
        {met ? (
          <span className="soli-goalmet">Goal met. Everything from here is on top.</span>
        ) : (
          <>
            <span>{money2(stats.remaining)} to go</span>
            {stats.daysLeft > 0
              ? <span>{stats.daysLeft} {stats.daysLeft === 1 ? "day" : "days"} left, about {money2(stats.perDay)}/day</span>
              : <span>last day of the month</span>}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ WEEKLY VIEW ------------------------------ */
function WeeklyView({ logs, rent, taxRate }) {
  const t = taxRate / 100;
  const weeks = useMemo(() => {
    const m = {};
    logs.forEach(l => {
      const ws = weekStartMs(l.date);
      const w = m[ws] || (m[ws] = { ws, booked: 0, booth: 0, profit: 0, tips: 0, hours: 0, count: 0 });
      const { booth, profit } = profitOf(l, rent);
      w.booked += l.price; w.booth += booth; w.profit += profit;
      w.tips += (Number(l.tip) || 0); w.hours += l.durationMin / 60; w.count++;
    });
    return Object.values(m)
      .map(w => ({ ...w, kept: w.profit * (1 - t) + w.tips, perHour: w.hours > 0 ? w.profit / w.hours : null }))
      .sort((a, b) => b.ws - a.ws);
  }, [logs, rent, t]);

  if (weeks.length === 0) {
    return (
      <div className="soli-page">
        <h1 className="soli-h1">Weekly breakdown</h1>
        <p className="soli-sub">Your week-by-week booked, kept, booth rent, and profit per hour.</p>
        <div className="soli-empty">
          <span className="soli-emptymark"><CalendarDays size={26} strokeWidth={1.8} /></span>
          <h2>No weeks yet</h2>
          <p>Log a few services and your weekly breakdown, plus your strongest and slowest weeks, builds here automatically.</p>
        </div>
      </div>
    );
  }

  const enoughForStats = weeks.length >= 4;
  const avgKept = weeks.reduce((s, w) => s + w.kept, 0) / weeks.length;
  const byKept = [...weeks].sort((a, b) => b.kept - a.kept);
  const best = byKept[0], worst = byKept[byKept.length - 1];

  const years = new Set(weeks.map(w => new Date(w.ws).getFullYear()));
  const multiYear = years.size >= 2;
  let slowWeeks = [];
  if (multiYear) {
    const byIso = {};
    weeks.forEach(w => { const k = isoWeekNum(w.ws); (byIso[k] = byIso[k] || []).push(w); });
    slowWeeks = Object.entries(byIso)
      .map(([k, arr]) => ({ iso: Number(k), avg: arr.reduce((s, w) => s + w.kept, 0) / arr.length, count: arr.length, sample: arr[0].ws }))
      .filter(x => x.count >= 2 && x.avg < avgKept * 0.7)
      .sort((a, b) => a.avg - b.avg).slice(0, 4);
  }

  return (
    <div className="soli-page">
      <h1 className="soli-h1">Weekly breakdown</h1>
      <p className="soli-sub">{weeks.length} weeks with activity · booked, kept, booth rent, and profit per hour</p>

      {enoughForStats && (
        <div className="soli-cards">
          <Stat label="Avg kept / week" value={money2(avgKept)} tone="profit" />
          <Stat label="Strongest week" value={money2(best.kept)} tone="neutral" />
          <Stat label="Slowest week" value={money2(worst.kept)} tone="cost" />
          <Stat label="Weeks tracked" value={String(weeks.length)} tone="neutral" />
        </div>
      )}

      {multiYear && slowWeeks.length > 0 && (
        <section className="soli-block soli-watch">
          <div className="soli-blockhead"><AlertTriangle size={18} strokeWidth={1.9} /><h2>Recurring slow weeks</h2></div>
          <p className="soli-note">Calendar weeks that came in below average in more than one year. Worth planning a promo or time off around.</p>
          {slowWeeks.map(s => (
            <div className="soli-watchrow" key={s.iso}><span>Around {weekLabel(weekStartMs(s.sample))} (week {s.iso})</span><span className="soli-watchval">{money2(s.avg)} avg kept</span></div>
          ))}
        </section>
      )}

      <section className="soli-block">
        <div className="soli-blockhead"><CalendarDays size={18} strokeWidth={1.9} /><h2>Week by week</h2></div>
        {!enoughForStats && <p className="soli-note">A few more weeks of data will unlock your strongest and slowest week comparisons.</p>}
        <div className="soli-weektable">
          <div className="soli-weekhead"><span>Week</span><span>Booked</span><span>Booth</span><span>Kept</span><span>Per hr</span></div>
          {weeks.map(w => (
            <div className="soli-weekrow" key={w.ws}>
              <span className="soli-weekname">{weekLabel(w.ws)}<small>{w.count} {w.count === 1 ? "service" : "services"}</small></span>
              <span data-label="Booked">{money2(w.booked)}</span>
              <span className="soli-weekcost" data-label="Booth">{money2(w.booth)}</span>
              <span className="soli-weekkept" data-label="Kept">{money2(w.kept)}</span>
              <span data-label="Per hr">{w.perHour === null ? "n/a" : money2(w.perHour)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (<div className={"soli-stat " + tone}><div className="soli-statlabel">{label}</div><div className="soli-statval">{value}</div></div>);
}

/* Best-effort spoken-number parser (Chrome/Safari usually return digits, but
   this covers "sixty five", "one hundred twenty", etc. as a fallback). */
function wordsToNumber(str) {
  const small = { zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19 };
  const tens = { twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90 };
  let total = 0, current = 0, found = false;
  for (const w of str.toLowerCase().replace(/-/g, " ").split(/\s+/)) {
    if (small[w] != null) { current += small[w]; found = true; }
    else if (tens[w] != null) { current += tens[w]; found = true; }
    else if (w === "hundred") { current = (current || 1) * 100; found = true; }
    else if (w === "thousand") { total += (current || 1) * 1000; current = 0; found = true; }
  }
  total += current;
  return found ? total : null;
}

/* Starter service sets by trade. Prices/times are just editable defaults so a
   brand-new user (e.g. from the flyer) isn't staring at a blank app. */

/* ------------------- trade starter service templates -------------------- */
/* [name, price, durationMin]. Starting points only; users rename/reprice/delete. */
const TRADE_STARTERS = {
  esthetician: [["Classic facial", 90, 60], ["Dermaplaning", 75, 45], ["Chemical peel", 100, 45], ["Back facial", 110, 60], ["Brow wax", 20, 15], ["Lip wax", 12, 10]],
  barber: [["Haircut", 35, 30], ["Fade", 40, 40], ["Beard trim", 20, 20], ["Haircut + beard", 50, 45], ["Hot towel shave", 35, 30], ["Kids cut", 25, 20]],
  cosmo: [["Women's cut", 55, 45], ["Men's cut", 35, 30], ["Root color", 90, 120], ["Full highlight", 160, 150], ["Balayage", 200, 180], ["Blowout", 45, 45]],
  nails: [["Gel manicure", 45, 45], ["Regular manicure", 30, 30], ["Pedicure", 50, 50], ["Full set acrylic", 60, 75], ["Fill", 40, 60], ["Gel-X full set", 70, 75]],
};
const TRADE_LIST = [
  { key: "esthetician", label: "Esthetician" },
  { key: "barber", label: "Barber" },
  { key: "cosmo", label: "Cosmetology" },
  { key: "nails", label: "Nails" },
];

/* ------------------------------ LOG SERVICE ------------------------------ */
function LogService({ clients, products, saveClients, logs, saveLogs, rent, taxRate, templates = [], saveTemplates, specialty, updateLog, deleteLog }) {
  const [batchOpen, setBatchOpen] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const filtered = (specialty && !showAllProducts) ? products.filter(p => !p.specialty || p.specialty === specialty) : products;
  const hiddenCount = products.length - filtered.length;
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [newClient, setNewClient] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [dur, setDur] = useState("");
  const [tip, setTip] = useState("");
  const [when, setWhen] = useState(ymd(new Date().toISOString()));
  const [lastVisit, setLastVisit] = useState(null);
  const [paySource, setPaySource] = useState("card");
  const [qty, setQty] = useState({});
  const [saved, setSaved] = useState(false);
  const [tplSaved, setTplSaved] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");

  useEffect(() => {
    setVoiceSupported(typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const productCost = products.reduce((s, p) => s + (Number(qty[p.id]) || 0) * perUnitCost(p), 0);
  const priceN = Number(price) || 0, durN = Number(dur) || 0, tipN = Number(tip) || 0;
  const pv = durN > 0 ? profitOf({ price: priceN, productCost, durationMin: durN }, rent) : null;
  const setAside = pv ? pv.profit * (taxRate / 100) : 0;
  const takeHome = pv ? pv.profit - setAside : 0;

  const submit = () => {
    if (!service || !priceN || !durN) return;
    const at = dateFromInput(when);
    let cid = clientId, cl = clients;
    if (newClient.trim()) {
      cid = uid();
      cl = [...clients, { id: cid, name: newClient.trim(), phone: "", notes: "", rebookWeeks: 4, lastVisit: at }];
      saveClients(cl);
    } else if (cid) {
      // Only move lastVisit forward. Entering old history should not make a
      // client look like they were just seen, which would hide them from
      // rebooking reminders and the slipping-away list.
      saveClients(clients.map(c => c.id === cid
        ? { ...c, lastVisit: (!c.lastVisit || new Date(at) > new Date(c.lastVisit)) ? at : c.lastVisit }
        : c));
    }
    // Record how much of each product was used, not just the total cost, so
    // stock remaining can be worked out from history rather than a running
    // counter that would drift whenever a service is edited or deleted.
    const usedQty = {};
    Object.keys(qty).forEach((pid) => { const n = Number(qty[pid]); if (n > 0) usedQty[pid] = n; });

    saveLogs([{ id: uid(), clientId: cid, service: service.trim(), price: priceN, durationMin: durN,
      paySource, tip: tipN, productCost: Math.round(productCost * 100) / 100,
      qty: Object.keys(usedQty).length ? usedQty : undefined, date: at }, ...logs]);
    setSaved(true); setService(""); setPrice(""); setDur(""); setTip(""); setQty({}); setNewClient(""); setPaySource("card");
    // Keep the client and date so another service from the same appointment can
    // be added without re-entering who it was for, then reset once done.
    setLastVisit({ clientId: cid, name: newClient.trim() || (clients.find((c) => c.id === cid) || {}).name || "", date: when });
    setWhen(ymd(new Date().toISOString()));
    setTimeout(() => setSaved(false), 2200);
  };

  const addAnother = () => {
    if (!lastVisit) return;
    setClientId(lastVisit.clientId);
    setNewClient("");
    setWhen(lastVisit.date);
    setLastVisit(null);
  };

  const applyTemplate = (t) => {
    setService(t.name);
    setPrice(String(t.price ?? ""));
    setDur(String(t.durationMin ?? ""));
    setPaySource(t.paySource || "card");
    setQty(t.qty || {});
  };
  const saveAsTemplate = () => {
    if (!service.trim() || !priceN || !durN) return;
    const cleanQty = {};
    Object.keys(qty).forEach(k => { const n = Number(qty[k]); if (n > 0) cleanQty[k] = n; });
    const t = { id: uid(), name: service.trim(), price: priceN, durationMin: durN, paySource, qty: cleanQty };
    const others = templates.filter(x => x.name.toLowerCase() !== t.name.toLowerCase());
    saveTemplates([t, ...others]);
    setTplSaved(true); setTimeout(() => setTplSaved(false), 2000);
  };
  const deleteTemplate = (id) => saveTemplates(templates.filter(t => t.id !== id));

  const applyTrade = (key) => {
    const starters = (TRADE_STARTERS[key] || []).map(([name, price, durationMin]) =>
      ({ id: uid(), name, price, durationMin, paySource: "card", qty: {} }));
    const have = new Set(templates.map(t => t.name.toLowerCase()));
    const toAdd = starters.filter(s => !have.has(s.name.toLowerCase()));
    saveTemplates([...toAdd, ...templates]);
  };


  const applyVoice = (text) => {
    const lower = text.toLowerCase();
    // Price: prefer a spoken digit, else fall back to number words.
    const digits = lower.match(/\d+(?:\.\d+)?/g);
    const spokenPrice = digits ? Number(digits[digits.length - 1]) : wordsToNumber(lower);
    // If the words match a saved template, apply the whole thing.
    const tpl = templates.find(t => lower.includes(t.name.toLowerCase()));
    if (tpl) {
      applyTemplate(tpl);
    } else {
      const name = text.replace(/[$£€]?\d+(?:\.\d+)?/g, "").replace(/\b(dollars?|pounds?|euros?|bucks?|quid|for|at)\b/gi, "").replace(/\s{2,}/g, " ").trim();
      if (name) setService(name.charAt(0).toUpperCase() + name.slice(1));
    }
    if (spokenPrice != null && !Number.isNaN(spokenPrice)) setPrice(String(spokenPrice));
    setVoiceMsg(`Heard: "${text}". Check it and hit Save.`);
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceMsg("Voice isn't supported in this browser. Try Chrome or Safari."); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    setListening(true); setVoiceMsg('Listening… try "lash fill 65" or a saved service name.');
    rec.onresult = (e) => applyVoice(e.results[0][0].transcript);
    rec.onerror = () => { setListening(false); setVoiceMsg("Didn't catch that. Tap and try again."); };
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="soli-page soli-narrow">
      <h1 className="soli-h1">Log a service</h1>
      <p className="soli-sub">Takes 20 seconds. Soli handles the profit, tax & take-home math.</p>

      {voiceSupported && (
        <div className="soli-voice">
          <button type="button" className={"soli-voicebtn" + (listening ? " on" : "")} onClick={startVoice} disabled={listening}>
            <span className="soli-voicedot" /> {listening ? "Listening…" : "🎤 Speak to log"}
          </button>
          {voiceMsg && <span className="soli-voicemsg">{voiceMsg}</span>}
        </div>
      )}

      {templates.length > 0 && (
        <div className="soli-tpl">
          <div className="soli-tpllabel">Quick log from a saved service</div>
          <div className="soli-tplrow">
            {templates.map(t => (
              <span className="soli-tplchip" key={t.id}>
                <button type="button" className="soli-tplapply" onClick={() => applyTemplate(t)}>{t.name} · {money(t.price)}</button>
                <button type="button" className="soli-tplx" onClick={() => deleteTemplate(t.id)} aria-label={"Delete " + t.name}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 && (
        <div className="soli-trade">
          <div className="soli-tradelabel">New here? Load starter services for your trade</div>
          <div className="soli-traderow">
            {TRADE_LIST.map(tr => (
              <button key={tr.key} type="button" className="soli-tradebtn" onClick={() => applyTrade(tr.key)}>{tr.label}</button>
            ))}
          </div>
          <p className="soli-help" style={{ marginTop: 9 }}>Loads editable services you can rename, reprice, or delete. Nothing is locked in.</p>
        </div>
      )}

      {batchOpen ? (
        <BatchDay clients={clients} saveClients={saveClients} logs={logs} saveLogs={saveLogs}
          templates={templates} products={products} rent={rent} taxRate={taxRate}
          onDone={() => setBatchOpen(false)} />
      ) : (
        <button type="button" className="soli-importtoggle" style={{ marginBottom: 20 }} onClick={() => setBatchOpen(true)}>
          Saw several clients today? Log the whole day at once
        </button>
      )}

      <Field label="Client">
        <select className="soli-input" value={clientId} onChange={e => setClientId(e.target.value)} disabled={!!newClient}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="soli-input" placeholder="…or type a new client name" value={newClient} onChange={e => setNewClient(e.target.value)} />
      </Field>

      <Field label="Service name">
        <input className="soli-input" placeholder="e.g. Volume full set" value={service} onChange={e => setService(e.target.value)} />
      </Field>

      <div className="soli-row2">
        <Field label={`Price charged (${CUR})`}><input className="soli-input" type="number" inputMode="decimal" placeholder="120" value={price} onChange={e => setPrice(e.target.value)} /></Field>
        <Field label="Time in chair (min)"><input className="soli-input" type="number" inputMode="numeric" placeholder="120" value={dur} onChange={e => setDur(e.target.value)} /></Field>
      </div>

      <Field label="Date">
        <input className="soli-input" type="date" value={when} max={ymd(new Date().toISOString())}
          onChange={(e) => setWhen(e.target.value || ymd(new Date().toISOString()))} />
        {when !== ymd(new Date().toISOString()) && (
          <p className="soli-help">Entering an older visit. Leave this on today for work you just finished.</p>
        )}
      </Field>

      <Field label={`Tip (optional, ${CUR})`}>
        <input className="soli-input" type="number" inputMode="decimal" placeholder="0" value={tip} onChange={e => setTip(e.target.value)} />
        <p className="soli-help">Tips are tracked separately and don't affect profit or profit-per-hour, so they never distort which services are worth doing.</p>
      </Field>

      <Field label="How did they pay?">
        <div className="soli-seg">
          {SOURCES.map(s => (
            <button key={s.id} className={"soli-segbtn" + (paySource === s.id ? " on" : "")} onClick={() => setPaySource(s.id)}>{s.label}</button>
          ))}
        </div>
      </Field>

      <Field label="Product used (set quantities)">
        {products.length === 0 && <p className="soli-help">No products yet. Add your supplies under <b>Inventory</b> to auto-track product cost. You can still log a service without them.</p>}
        {specialty && products.length > 0 && (
          <p className="soli-help" style={{ marginTop: 0 }}>
            Showing {showAllProducts ? "all products" : `${specialtyLabel(specialty)} products`}
            {hiddenCount > 0 || showAllProducts ? <> · <button type="button" className="soli-linkbtn" onClick={() => setShowAllProducts(v => !v)}>{showAllProducts ? "show mine only" : "show all"}</button></> : null}
          </p>
        )}
        <div className="soli-prodgrid">
          {filtered.map(p => (
            <div className="soli-prodpick" key={p.id}>
              <span className="soli-prodname">{p.name}<small>{money2(perUnitCost(p))}/{p.unit}{Number(qty[p.id]) > 0 ? ` · = ${money2((Number(qty[p.id]) || 0) * perUnitCost(p))}` : ""}</small></span>
              <input className="soli-qty" type="number" inputMode="decimal" min="0" placeholder="0" value={qty[p.id] || ""} onChange={e => setQty({ ...qty, [p.id]: e.target.value })} />
            </div>
          ))}
        </div>
      </Field>

      {pv && (
        <div className={"soli-preview " + (pv.profit >= 0 ? "good" : "bad")}>
          <div className="soli-prevrow"><span>Product cost</span><span>– {money2(productCost)}</span></div>
          <div className="soli-prevrow"><span>Booth time ({durN}m @ {money2(rent)}/hr)</span><span>– {money2(pv.booth)}</span></div>
          <div className="soli-prevrow"><span>Pre-tax profit</span><span>{money2(pv.profit)}</span></div>
          <div className="soli-prevrow tax"><span>Set aside for taxes ({taxRate}%)</span><span>– {money2(setAside)}</span></div>
          <div className="soli-prevrow main"><span>You actually keep</span><span>{money2(takeHome)}</span></div>
          {tipN > 0 && <div className="soli-prevrow"><span>+ Tip (separate from profit)</span><span>+ {money2(tipN)}</span></div>}
          {tipN > 0 && <div className="soli-prevrow main"><span>Total you pocket</span><span>{money2(takeHome + tipN)}</span></div>}
          <div className="soli-prevrow sub"><span>{pv.perHour === null ? "add minutes for an hourly rate" : money2(pv.perHour) + "/hr"}{pv.margin === null ? "" : " · " + Math.round(pv.margin * 100) + "% margin"} · tips excluded</span></div>
        </div>
      )}

      <button className="soli-cta" onClick={submit} disabled={!service || !priceN || !durN}>{saved ? "Saved ✓" : "Save service"}</button>

      {lastVisit && (
        <div className="soli-another">
          <span>Did {lastVisit.name || "this client"} have anything else done in the same appointment?</span>
          <button type="button" onClick={addAnother}>Add another service</button>
        </div>
      )}
      {service && priceN > 0 && durN > 0 && (
        <button className="soli-ghost soli-tplsave" onClick={saveAsTemplate}>{tplSaved ? "Saved as template ✓" : "Save this as a template"}</button>
      )}

      <RecentLogs logs={logs} clients={clients} rent={rent} updateLog={updateLog} deleteLog={deleteLog} />
    </div>
  );
}

/* --------------------------- BATCH DAY LOGGING ---------------------------- */
/* Pros are hands-on all day and catch up at night, so logging one service at a
   time is the main reason tracking gets abandoned. This adds a whole day at once. */
function BatchDay({ clients, saveClients, logs, saveLogs, templates, products, rent, taxRate, onDone }) {
  const blank = () => ({ id: uid(), clientId: clients[0]?.id || "", newClient: "", service: "", price: "", dur: "", tip: "", paySource: "card", productCost: 0 });
  const [rows, setRows] = useState([blank(), blank(), blank()]);
  const [saved, setSaved] = useState(0);

  const set = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const applyTpl = (id, tplId) => {
    const t = templates.find((x) => x.id === tplId);
    if (!t) { set(id, { service: "", price: "", dur: "", productCost: 0 }); return; }
    // Carry the template's product usage through at real cost, so batch-logged
    // services are as accurate as ones logged one at a time.
    const cost = Object.entries(t.qty || {}).reduce((s, [pid, q]) => {
      const p = (products || []).find((x) => x.id === pid);
      return s + (Number(q) || 0) * (p ? perUnitCost(p) : 0);
    }, 0);
    set(id, { service: t.name, price: String(t.price ?? ""), dur: String(t.durationMin ?? ""), paySource: t.paySource || "card", productCost: cost });
  };

  const filled = rows.filter((r) => r.service.trim() && Number(r.price) > 0 && Number(r.dur) > 0);
  const totals = filled.reduce(
    (a, r) => {
      const { profit } = profitOf({ price: Number(r.price), productCost: r.productCost || 0, durationMin: Number(r.dur) }, rent);
      a.booked += Number(r.price); a.tips += Number(r.tip) || 0; a.profit += profit; return a;
    },
    { booked: 0, tips: 0, profit: 0 }
  );
  const kept = totals.profit * (1 - taxRate / 100) + totals.tips;

  const saveAll = () => {
    if (filled.length === 0) return;
    let nextClients = [...clients];
    const now = new Date().toISOString();
    const newLogs = filled.map((r) => {
      let cid = r.clientId;
      if (r.newClient.trim()) {
        cid = uid();
        nextClients = [...nextClients, { id: cid, name: r.newClient.trim(), phone: "", notes: "", rebookWeeks: 4, lastVisit: now }];
      } else if (cid) {
        nextClients = nextClients.map((c) => (c.id === cid ? { ...c, lastVisit: now } : c));
      }
      return {
        id: uid(), clientId: cid, service: r.service.trim(), price: Number(r.price),
        durationMin: Number(r.dur), paySource: r.paySource, tip: Number(r.tip) || 0,
        productCost: Math.round((r.productCost || 0) * 100) / 100, date: now,
      };
    });
    saveClients(nextClients);
    saveLogs([...newLogs, ...logs]);
    setSaved(newLogs.length);
    setTimeout(() => { setSaved(0); onDone?.(); }, 1600);
  };

  return (
    <div className="soli-batch">
      <div className="soli-batchhead">
        <b>Log your whole day</b>
        <button className="soli-editbtn" onClick={onDone}>Close</button>
      </div>
      <p className="soli-help" style={{ marginTop: 0 }}>Add each client you saw, then save them all at once. Pick a saved service to fill the price and time for you.</p>

      {rows.map((r, i) => (
        <div className="soli-batchrow" key={r.id}>
          <div className="soli-batchnum">{i + 1}</div>
          <div className="soli-batchfields">
            <select className="soli-input slim" value={r.clientId} onChange={(e) => set(r.id, { clientId: e.target.value })} disabled={!!r.newClient}>
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="soli-input slim" placeholder="or new name" value={r.newClient} onChange={(e) => set(r.id, { newClient: e.target.value })} />
            {templates.length > 0 && (
              <select className="soli-input slim" defaultValue="" onChange={(e) => applyTpl(r.id, e.target.value)}>
                <option value="">Saved service…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <input className="soli-input slim" placeholder="Service" value={r.service} onChange={(e) => set(r.id, { service: e.target.value })} />
            <input className="soli-input slim" type="number" placeholder={CUR} value={r.price} onChange={(e) => set(r.id, { price: e.target.value })} />
            <input className="soli-input slim" type="number" placeholder="min" value={r.dur} onChange={(e) => set(r.id, { dur: e.target.value })} />
            <input className="soli-input slim" type="number" placeholder="tip" value={r.tip} onChange={(e) => set(r.id, { tip: e.target.value })} />
            <select className="soli-input slim" value={r.paySource} onChange={(e) => set(r.id, { paySource: e.target.value })}>
              {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <button className="soli-iconbtn" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : rs))} aria-label="Remove row"><Trash2 size={15} /></button>
        </div>
      ))}

      <button className="soli-ghost" onClick={() => setRows((rs) => [...rs, blank()])}>Add another client</button>

      {filled.length > 0 && (
        <div className="soli-preview good" style={{ marginTop: 14 }}>
          <div className="soli-prevrow"><span>{filled.length} {filled.length === 1 ? "service" : "services"} booked</span><span>{money2(totals.booked)}</span></div>
          {totals.tips > 0 && <div className="soli-prevrow"><span>Tips</span><span>+ {money2(totals.tips)}</span></div>}
          <div className="soli-prevrow main"><span>You keep from today</span><span>{money2(kept)}</span></div>
        </div>
      )}

      <button className="soli-cta" onClick={saveAll} disabled={filled.length === 0}>
        {saved > 0 ? `Saved ${saved} ✓` : `Save ${filled.length || ""} ${filled.length === 1 ? "service" : "services"}`.trim()}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (<div className="soli-field"><label className="soli-label">{label}</label>{children}</div>);
}

/* ------------------------------ PLANNER ---------------------------------- */
/* --------------------------- PRICE SIMULATOR ----------------------------- */
/* Replays the last 90 days at different prices. Only the price changes: the
   same appointments, product costs and chair time are held constant, so the
   difference shown is purely the price change and nothing is invented. */
function PriceSimulator({ logs, rent, taxRate }) {
  const t = taxRate / 100;
  const since = Date.now() - 90 * 864e5;

  const services = useMemo(() => {
    const m = {};
    logs.forEach((l) => {
      if (new Date(l.date).getTime() < since) return;
      const k = l.service;
      const booth = (l.durationMin / 60) * rent;
      const s = m[k] || (m[k] = { name: k, count: 0, revenue: 0, product: 0, booth: 0 });
      s.count++; s.revenue += Number(l.price) || 0;
      s.product += Number(l.productCost) || 0; s.booth += booth;
    });
    return Object.values(m)
      .map((s) => ({ ...s, avgPrice: s.revenue / s.count, profit: s.revenue - s.product - s.booth }))
      .sort((a, b) => b.count - a.count);
  }, [logs, rent, since]);

  const [prices, setPrices] = useState({});
  const priceFor = (s) => {
    const v = prices[s.name];
    return v === undefined || v === "" ? s.avgPrice : Math.max(0, Number(v) || 0);
  };
  const bump = (s, pct) => setPrices((p) => ({ ...p, [s.name]: String(round2(s.avgPrice * (1 + pct / 100))) }));
  const reset = () => setPrices({});

  const totals = useMemo(() => {
    let now = 0, next = 0;
    services.forEach((s) => {
      now += s.profit;
      next += priceFor(s) * s.count - s.product - s.booth;
    });
    return { now: now * (1 - t), next: next * (1 - t) };
  }, [services, prices, t]);

  const diff = totals.next - totals.now;
  const monthly = diff / 3; // 90 days is roughly three months
  const changed = services.some((s) => Math.abs(priceFor(s) - s.avgPrice) > 0.005);

  if (services.length === 0) {
    return (
      <div className="soli-simbox">
        <div className="soli-datahead">What if I raised my prices?</div>
        <p className="soli-help" style={{ marginTop: 0 }}>Log a few services and you can try new prices here to see what they would have earned you.</p>
      </div>
    );
  }

  return (
    <div className="soli-simbox">
      <div className="soli-datahead">What if I raised my prices?</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        Your last 90 days replayed at prices you choose. Everything else stays as it was, so this shows the effect of the price alone.
      </p>

      <div className="soli-simrows">
        {services.map((s) => {
          const np = priceFor(s);
          const delta = (np - s.avgPrice) * s.count * (1 - t) / 3;
          return (
            <div className="soli-simrow" key={s.name}>
              <div className="soli-simname">
                {s.name}
                <small>{s.count}x · now {money2(s.avgPrice)}</small>
              </div>
              <div className="soli-simctrl">
                <input className="soli-input slim" type="number" inputMode="decimal"
                  value={prices[s.name] ?? round2(s.avgPrice)}
                  onChange={(e) => setPrices((p) => ({ ...p, [s.name]: e.target.value }))} />
                <button type="button" className="soli-simbump" onClick={() => bump(s, 10)}>+10%</button>
              </div>
              <div className={"soli-simdelta" + (delta > 0.005 ? " up" : delta < -0.005 ? " down" : "")}>
                {Math.abs(delta) < 0.005 ? "" : (delta > 0 ? "+" : "") + money2(delta) + "/mo"}
              </div>
            </div>
          );
        })}
      </div>

      <div className={"soli-simtotal" + (changed ? " on" : "")}>
        <div className="soli-simtotalrow"><span>Kept over those 90 days</span><b>{money2(totals.now)}</b></div>
        {changed && (
          <>
            <div className="soli-simtotalrow"><span>At your new prices</span><b>{money2(totals.next)}</b></div>
            <div className="soli-simtotalrow main">
              <span>{diff >= 0 ? "Extra" : "Less"} each month</span>
              <b className={diff >= 0 ? "up" : "down"}>{diff >= 0 ? "+" : ""}{money2(monthly)}</b>
            </div>
          </>
        )}
      </div>

      {changed && (
        <>
          <p className="soli-simnote">
            This assumes the same clients book the same work at the new prices. Some may not, so treat it as the best case rather than a forecast. Trying a new price with new clients first is a common way to test it without risking your regulars.
          </p>
          <button className="soli-editbtn" onClick={reset}>Reset prices</button>
        </>
      )}
    </div>
  );
}

/* boothRate is the hourly chair cost used in profit math. It is deliberately
   not called rent here, since this screen already uses `rent` for the monthly
   booth rent the user is planning around. */
function Planner({ plan, savePlan, taxRate, logs = [], boothRate = 0 }) {
  const set = (k, v) => savePlan({ ...plan, [k]: Math.max(0, Number(v) || 0) });
  const t = taxRate / 100;
  const goal = plan.goal, rent = plan.monthlyRent, avg = plan.avgPrice, cap = plan.capacity;

  const preTaxProfitNeeded = t < 1 ? goal / (1 - t) : goal;       // to take home `goal` after taxes
  const revenueNeeded = preTaxProfitNeeded + rent;                 // + rent (product cost adds a little on top)
  const taxNeeded = preTaxProfitNeeded * t;
  const svcMonth = avg > 0 ? Math.ceil(revenueNeeded / avg) : 0;
  const svcWeek = Math.ceil(svcMonth / 4.33);
  const priceAtCap = cap > 0 ? revenueNeeded / (cap * 4.33) : 0;

  return (
    <div className="soli-page soli-narrow">
      <h1 className="soli-h1">What should I charge?</h1>
      <p className="soli-sub">Work backward from the take-home you actually want, and plan the future instead of just tracking the past.</p>

      <div className="soli-row2">
        <Field label={`Monthly take-home goal (${CUR})`}><input className="soli-input" type="number" value={goal} onChange={e => set("goal", e.target.value)} /></Field>
        <Field label={`Monthly booth rent (${CUR})`}><input className="soli-input" type="number" value={rent} onChange={e => set("monthlyRent", e.target.value)} /></Field>
      </div>
      <Field label={`Average price per service (${CUR})`}><input className="soli-input" type="number" value={avg} onChange={e => set("avgPrice", e.target.value)} /></Field>

      <div className="soli-plancard">
        <div className="soli-planrow"><span>To take home</span><b>{money2(goal)}/mo</b></div>
        <div className="soli-planrow sub"><span>Set aside for taxes ({taxRate}%)</span><span>{money2(taxNeeded)}/mo</span></div>
        <div className="soli-planrow sub"><span>Cover booth rent</span><span>{money2(rent)}/mo</span></div>
        <div className="soli-planrow main"><span>You need to bring in</span><b>{money2(revenueNeeded)}/mo</b></div>
      </div>

      <div className="soli-plangoal">
        At {money2(avg)} per service, that's <b>{svcMonth} services a month</b>, about <b>{svcWeek} a week</b>.
        <span className="soli-plannote">(product costs nudge this up a little)</span>
      </div>

      <div className="soli-flip">
        <div className="soli-flriphead">Flip it around</div>
        <Field label="Services I can realistically do per week"><input className="soli-input" type="number" value={cap} onChange={e => set("capacity", e.target.value)} /></Field>
        <div className="soli-flipresult">
          To hit your goal at {cap}/week, charge about <b>{money2(priceAtCap)}</b> per service on average.
        </div>
      </div>

      <PriceSimulator logs={logs} rent={boothRate} taxRate={taxRate} />
    </div>
  );
}

/* ------------------------------- CLIENTS --------------------------------- */
/* Distinct days a client was actually seen, oldest first.

   One appointment often covers several services (a lash fill plus a brow wax),
   and each is logged separately so per-service profit stays accurate. Counting
   those as separate visits would be wrong: the gaps between them are zero,
   which drags a client's median gap to nothing and makes their rhythm
   unreadable. Collapsing to calendar days keeps both numbers honest. */
function visitDays(clientLogs) {
  const days = new Set();
  (clientLogs || []).forEach((l) => {
    const d = new Date(l.date);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  });
  return [...days].sort((a, b) => a - b);
}

/* Works out each client's own rhythm from their visit history, rather than the
   rebook weeks field, which most people leave on the default. Uses the median
   gap so one long break (a holiday, an illness) does not skew their normal.
   Needs three visits, since two gives a single gap and no sense of typical. */
function riskFor(clientLogs) {
  const dates = visitDays(clientLogs);
  if (dates.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const medianGap = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  const usualDays = medianGap / 864e5;
  if (usualDays < 1) return null;
  const sinceDays = (Date.now() - dates[dates.length - 1]) / 864e5;
  const ratio = sinceDays / usualDays;
  // Bounds are checked before grading, so someone long gone cannot fall through
  // and be labelled a mild "watch". Under 1.4x is a normal wobble; past 3.5x
  // they have most likely moved on and calling that "slipping" would mislead.
  if (ratio < 1.4 || ratio >= 3.5) return null;
  const level = ratio >= 2 ? "high" : "watch";
  return { usualDays: Math.round(usualDays), sinceDays: Math.round(sinceDays), ratio, level };
}

function ClientsView({ clients, logs, saveClients, rent }) {
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "", rebookWeeks: 4 });
  const stats = (cid) => {
    const ls = logs.filter(l => l.clientId === cid);
    const profit = ls.reduce((s, l) => s + profitOf(l, rent).profit, 0);
    // Visits are days seen, not services logged, so a bundled appointment
    // counts once rather than inflating someone's loyalty.
    return { visits: visitDays(ls).length, services: ls.length, profit, ls: ls.sort((a, b) => new Date(b.date) - new Date(a.date)) };
  };
  /* Removing a client leaves their services in place, which is right: the money
     was earned and has to stay in your totals and your tax figures. What it does
     mean is those services are no longer attached to anyone, so the choice is
     spelled out with the real numbers rather than a bare "are you sure". */
  const remove = (id) => {
    const c = clients.find((x) => x.id === id);
    const s = stats(id);
    const detail = s.services > 0
      ? `\n\n${c?.name || "This client"} has ${s.services} logged ${s.services === 1 ? "service" : "services"} worth ${money2(s.profit)} in profit.\n\nThose stay in your totals and tax figures, but they will no longer be linked to anyone, and their visit history cannot be recovered.`
      : "";
    if (!confirm(`Remove ${c?.name || "this client"}?${detail}`)) return;
    saveClients(clients.filter((x) => x.id !== id));
    setOpen(null);
  };
  const startEdit = (c) => { setEditing(c.id); setForm({ name: c.name, phone: c.phone || "", notes: c.notes || "", rebookWeeks: c.rebookWeeks || 4 }); };

  // Clients drifting past their own normal rhythm, worst first, weighted by what
  // an average visit from them is worth so the costly ones surface first.
  const slipping = useMemo(() => {
    return clients
      .map((c) => {
        const ls = logs.filter((l) => l.clientId === c.id);
        const risk = riskFor(ls);
        if (!risk) return null;
        // Divide by visits, not services, so "a visit is worth this much"
        // reflects a whole appointment rather than one line of it.
        const days = visitDays(ls).length || 1;
        const perVisit = ls.reduce((s, l) => s + profitOf(l, rent).profit, 0) / days;
        return { ...c, risk, perVisit, visits: days };
      })
      .filter(Boolean)
      .sort((a, b) => (b.risk.ratio * Math.max(b.perVisit, 1)) - (a.risk.ratio * Math.max(a.perVisit, 1)));
  }, [clients, logs, rent]);
  const saveEdit = (id) => {
    saveClients(clients.map(c => c.id === id ? {
      ...c,
      name: form.name.trim() || c.name,
      phone: form.phone.trim(),
      notes: form.notes.trim(),
      rebookWeeks: Math.max(1, Number(form.rebookWeeks) || 4),
    } : c));
    setEditing(null);
  };

  return (
    <div className="soli-page">
      <h1 className="soli-h1">Clients</h1>
      <p className="soli-sub">{clients.length} clients · ranked by lifetime profit</p>
      {clients.length === 0 && <p className="soli-emptyhint" style={{ textAlign: "left", marginTop: 0 }}>No clients yet. They're added automatically when you log a service. Just type a new name on the <b>Log service</b> screen.</p>}

      {slipping.length > 0 && (
        <section className="soli-block soli-watch">
          <div className="soli-blockhead"><AlertTriangle size={18} strokeWidth={1.9} /><h2>Slipping away</h2></div>
          <p className="soli-note">
            Regulars who have gone quiet for longer than they normally do. Based on their own visit history, not a fixed schedule.
          </p>
          {slipping.map((c) => (
            <div className="soli-sliprow" key={c.id}>
              <div>
                <div className="soli-duename">
                  {c.name} {c.risk.level === "high" && <span className="soli-sliptag">overdue</span>}
                </div>
                <div className="soli-duemeta">
                  usually every {c.risk.usualDays} days, last seen {c.risk.sinceDays} days ago
                  {c.perVisit > 0 ? ` · about ${money2(c.perVisit)} a visit` : ""}
                </div>
              </div>
              {c.phone
                ? <a className="soli-textlink" href={"sms:" + c.phone.replace(/[^0-9+]/g, "")}>Text</a>
                : <span className="soli-dueskip">no phone saved</span>}
            </div>
          ))}
        </section>
      )}

      <div className="soli-clientlist">
        {clients.map(c => ({ ...c, s: stats(c.id) })).sort((a, b) => b.s.profit - a.s.profit).map(c => (
          <div key={c.id} className="soli-clientcard" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <div className="soli-clienttop">
              <div><div className="soli-clientname">{c.name}</div><div className="soli-clientmeta">
                {c.s.visits} {c.s.visits === 1 ? "visit" : "visits"}
                {c.s.services > c.s.visits ? ` · ${c.s.services} services` : ""}
                {" · last "}{fmtDate(c.lastVisit)}
              </div></div>
              <div className="soli-clientprofit">{money2(c.s.profit)}<small>lifetime profit</small></div>
            </div>
            {open === c.id && (
              <div className="soli-clientdetail" onClick={e => e.stopPropagation()}>
                {editing === c.id ? (
                  <div>
                    <div className="soli-row2">
                      <Field label="Name"><input className="soli-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
                      <Field label="Phone"><input className="soli-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="555-0100" /></Field>
                    </div>
                    <Field label="Notes"><input className="soli-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Preferences, reminders" /></Field>
                    <Field label="Rebook every (weeks)"><input className="soli-input" type="number" min="1" value={form.rebookWeeks} onChange={e => setForm({ ...form, rebookWeeks: e.target.value })} /></Field>
                    <div className="soli-editactions">
                      <button className="soli-cta sm" onClick={() => saveEdit(c.id)}>Save changes</button>
                      <button className="soli-editbtn" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {c.notes && <p className="soli-clientnotes">{c.notes}</p>}
                    {c.phone && (
                      <p className="soli-clientnotes soli-contactrow">
                        <a href={"tel:" + c.phone.replace(/[^0-9+]/g, "")}>📞 {c.phone}</a>
                        <a className="soli-textlink" href={rebookSms(c.phone, c.name)}>Text</a>
                      </p>
                    )}
                    <p className="soli-clientnotes">↻ Rebook every {c.rebookWeeks || 4} weeks</p>
                    <div className="soli-history">
                      {c.s.ls.map(l => (
                        <div className="soli-histrow" key={l.id}><span>{fmtDate(l.date)} · {l.service} <em>· {srcLabel(l.paySource)}</em></span><span className="soli-histprofit">{money2(profitOf(l, rent).profit)}</span></div>
                      ))}
                    </div>
                    <div className="soli-editactions">
                      <button className="soli-editbtn" onClick={() => startEdit(c)}>Edit client</button>
                      <button className="soli-del" onClick={() => remove(c.id)}><Trash2 size={14} /> Remove</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ INVENTORY -------------------------------- */
function Inventory({ products, saveProducts, specialty, logs = [] }) {
  const [name, setName] = useState(""); const [cost, setCost] = useState("");
  const [amount, setAmount] = useState(""); const [unit, setUnit] = useState("use");
  const [prodSpec, setProdSpec] = useState(specialty || "");
  const [stockEdit, setStockEdit] = useState(null);
  const [stockDraft, setStockDraft] = useState("");

  // Typing what is on hand now resets the baseline; usage counts from that moment.
  const setOnHand = (id, v) => {
    const n = Number(v);
    saveProducts(products.map((p) => p.id === id
      ? (n > 0 ? { ...p, stocked: n, stockedAt: new Date().toISOString() } : { ...p, stocked: 0, stockedAt: null })
      : p));
    setStockEdit(null); setStockDraft("");
  };
  const low = products
    .map((p) => ({ p, s: stockFor(p, logs) }))
    .filter((x) => isLowStock(x.s));
  const add = () => {
    if (!name || !cost) return;
    saveProducts([...products, { id: uid(), name: name.trim(), cost: Number(cost) || 0, amount: Number(amount) || 0, unit: unit || "use", specialty: prodSpec || undefined, stock: 0 }]);
    setName(""); setCost(""); setAmount(""); setUnit("use"); setProdSpec(specialty || "");
  };
  const upd = (id, key, v) => saveProducts(products.map(p => p.id === id ? { ...p, [key]: (key === "name" || key === "unit" || key === "specialty") ? v : Number(v) } : p));
  const del = (id) => saveProducts(products.filter(p => p.id !== id));
  const loadStarters = () => {
    if (!specialty) return;
    const starters = (STARTER_PRODUCTS[specialty] || []).map(([n, c, a, u]) => ({ id: uid(), name: n, cost: c, amount: a, unit: u, specialty, stock: 0 }));
    const have = new Set(products.map(p => p.name.toLowerCase()));
    saveProducts([...products, ...starters.filter(s => !have.has(s.name.toLowerCase()))]);
  };
  return (
    <div className="soli-page">
      <h1 className="soli-h1">Inventory & product costs</h1>
      <p className="soli-sub">What each product costs you. Soli uses this in every profit calc.</p>
      <p className="soli-help" style={{ marginTop: 0, marginBottom: 16 }}>
        Enter the <b>total cost</b> and <b>total amount</b> (e.g. {CUR}10 for a 100g tube, unit "g") and Soli tracks cost per unit. Leave <b>Amount</b> blank for a simple flat cost per use. Tag a product for a specialty, or leave it for everyone.
      </p>
      {specialty && (
        <button type="button" className="soli-tradebtn" style={{ marginBottom: 16 }} onClick={loadStarters}>Load starter products for {specialtyLabel(specialty)}</button>
      )}
      {products.length === 0 && <p className="soli-emptyhint" style={{ textAlign: "left", marginTop: 0, marginBottom: 16 }}>No products yet. Add your supplies below so Soli can fold their cost into every profit calculation.</p>}
      {low.length > 0 && (
        <section className="soli-block soli-watch" style={{ marginBottom: 20 }}>
          <div className="soli-blockhead"><AlertTriangle size={18} strokeWidth={1.9} /><h2>Running low</h2></div>
          <p className="soli-note">Based on what you said was on hand, minus what your logged services have used.</p>
          {low.map(({ p, s }) => (
            <div className="soli-watchrow" key={p.id}>
              <span>
                {p.name}
                <small style={{ display: "block", color: "var(--ink2)", fontSize: 12 }}>
                  {s.remaining <= 0
                    ? "none left"
                    : `${round2(s.remaining)} ${p.unit} left${s.servicesLeft !== null ? `, about ${s.servicesLeft} more ${s.servicesLeft === 1 ? "service" : "services"}` : ""}`}
                </small>
              </span>
              <span className="soli-watchval">{s.remaining <= 0 ? "0" : Math.round(s.pct * 100) + "%"}</span>
            </div>
          ))}
        </section>
      )}

      <div className="soli-invtable">
        <div className="soli-invhead"><span>Product</span><span>Total cost</span><span>Amount</span><span>Unit</span><span>On hand</span><span>For</span><span></span></div>
        {products.map(p => {
          const s = stockFor(p, logs);
          return (
          <div className="soli-invrow" key={p.id}>
            <input className="soli-input slim" value={p.name} onChange={e => upd(p.id, "name", e.target.value)} />
            <input className="soli-input slim" type="number" value={p.cost} onChange={e => upd(p.id, "cost", e.target.value)} />
            <input className="soli-input slim" type="number" placeholder="opt" value={p.amount || ""} onChange={e => upd(p.id, "amount", e.target.value)} />
            <input className="soli-input slim" value={p.unit} onChange={e => upd(p.id, "unit", e.target.value)} />
            {stockEdit === p.id ? (
              <input className="soli-input slim" type="number" autoFocus placeholder={`How much now`}
                value={stockDraft} onChange={(e) => setStockDraft(e.target.value)}
                onBlur={() => setOnHand(p.id, stockDraft)}
                onKeyDown={(e) => { if (e.key === "Enter") setOnHand(p.id, stockDraft); if (e.key === "Escape") { setStockEdit(null); setStockDraft(""); } }} />
            ) : (
              <button type="button" className={"soli-stockbtn" + (isLowStock(s) ? " low" : "")}
                title={s ? `${round2(s.used)} ${p.unit} used since you last set this` : "Set how much you have to start tracking"}
                onClick={() => { setStockEdit(p.id); setStockDraft(s ? String(round2(s.remaining)) : ""); }}>
                {s ? `${round2(s.remaining)} ${p.unit}` : "Track"}
              </button>
            )}
            <select className="soli-input slim" value={p.specialty || ""} onChange={e => upd(p.id, "specialty", e.target.value)}>
              <option value="">Everyone</option>
              {SPECIALTIES.map(s2 => <option key={s2.key} value={s2.key}>{s2.label}</option>)}
            </select>
            <button className="soli-iconbtn" onClick={() => del(p.id)}><Trash2 size={15} /></button>
          </div>
          );
        })}
      </div>
      <div className="soli-addbox">
        <div className="soli-addhead">Add a product</div>
        <div className="soli-row4">
          <input className="soli-input" placeholder="Product name" value={name} onChange={e => setName(e.target.value)} />
          <input className="soli-input" type="number" placeholder={`Total cost ${CUR}`} value={cost} onChange={e => setCost(e.target.value)} />
          <input className="soli-input" type="number" placeholder="Amount (optional)" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className="soli-input" placeholder="Unit (g/ml/use)" value={unit} onChange={e => setUnit(e.target.value)} />
        </div>
        <select className="soli-input" style={{ marginTop: 10 }} value={prodSpec} onChange={e => setProdSpec(e.target.value)}>
          <option value="">For everyone</option>
          {SPECIALTIES.map(s => <option key={s.key} value={s.key}>For {s.label}</option>)}
        </select>
        <button className="soli-cta sm" style={{ marginTop: 10 }} onClick={add}>Add product</button>
      </div>
    </div>
  );
}

/* ------------------------------- SETTINGS -------------------------------- */
function SettingsView({ settings, saveSettings, loadSample, clearAll, isSubscribed, inTrial, trialDaysLeft, onSubscribe, onManage, billingBusy, email, comped, onRedeem, logs = [], clients = [], rent = 0, expenses = [], products = [], plan = {}, onDeleteAccount, onImportServices }) {
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importNote, setImportNote] = useState("");
  const runDelete = async () => {
    setDelBusy(true); setDelErr("");
    const res = await onDeleteAccount();
    if (!res?.ok) { setDelErr(res?.error || "Could not delete the account."); setDelBusy(false); }
  };
  const onLoad = () => { if (confirm("Load sample data? This replaces what's here now with an example set you can explore. Clear it anytime.")) loadSample(); };
  const onClear = () => { if (confirm("Clear all data? This permanently erases your clients, products and logged services. This can't be undone.")) clearAll(); };
  const [pcode, setPcode] = useState(""); const [predeeming, setPredeeming] = useState(false); const [perr, setPerr] = useState("");
  const doRedeem = async () => { setPerr(""); setPredeeming(true); const r = await onRedeem(pcode.trim()); if (!r.ok) setPerr(r.error); setPredeeming(false); };
  const bUnit = settings.boothRentUnit || "hour";
  const setBooth = (patch) => { const next = { ...settings, ...patch }; next.boothRentHourly = boothHourly(next); saveSettings(next); };
  const buckets = settings.buckets || [];
  const setBuckets = (v) => saveSettings({ ...settings, buckets: v });
  const addBucket = (name, pct) => setBuckets([...buckets, { id: uid(), name, pct: Math.max(0, Math.min(100, Number(pct) || 0)) }]);
  const updBucket = (id, key, v) => setBuckets(buckets.map(b => b.id === id ? { ...b, [key]: key === "pct" ? Math.max(0, Math.min(100, Number(v) || 0)) : v } : b));
  const delBucket = (id) => setBuckets(buckets.filter(b => b.id !== id));
  return (
    <div className="soli-page soli-narrow">
      <h1 className="soli-h1">Settings</h1>

      <div className="soli-billing">
        <div className="soli-datahead">Your plan</div>
        {comped ? (
          <>
            <div className="soli-planline"><span className="soli-planbadge on">Complimentary</span><span>Free access</span></div>
            <p className="soli-help">You have complimentary access to Soli Pro. Enjoy, and thank you.</p>
          </>
        ) : isSubscribed ? (
          <>
            <div className="soli-planline"><span className="soli-planbadge on">Soli Pro</span><span>Active · $12/mo</span></div>
            <p className="soli-help">Thanks for subscribing. Manage your card, invoices, or cancel anytime.</p>
            <button className="soli-ghost" onClick={onManage} disabled={billingBusy}>{billingBusy ? "One moment…" : "Manage billing"}</button>
          </>
        ) : (
          <>
            <div className="soli-planline">
              <span className="soli-planbadge">Free trial</span>
              <span>{inTrial ? `${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left` : "Trial ended"}</span>
            </div>
            <p className="soli-help">Keep your numbers, tax jar, and profit tracking going after your trial. Cancel anytime.</p>
            <PlanPicker onSubscribe={onSubscribe} busy={billingBusy} />
            <div className="soli-promo" style={{ marginTop: 10 }}>
              <input className="soli-input" placeholder="Promo code" value={pcode} onChange={e => { setPcode(e.target.value); setPerr(""); }} onKeyDown={e => { if (e.key === "Enter" && pcode.trim()) doRedeem(); }} />
              <button className="soli-ghost" onClick={doRedeem} disabled={predeeming || !pcode.trim()}>{predeeming ? "Checking…" : "Redeem"}</button>
            </div>
            {perr && <p className="soli-help" style={{ color: "var(--clay-d)" }}>{perr}</p>}
          </>
        )}
        {email && <p className="soli-help">Signed in as {email}</p>}
      </div>

      <Field label="Your specialty">
        <select className="soli-input" value={settings.specialty || ""} onChange={e => saveSettings({ ...settings, specialty: e.target.value })}>
          <option value="">Not set (show all products)</option>
          {SPECIALTIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <p className="soli-help">Filters your product list when logging and picks the right starter products. You can always switch to view all.</p>
      </Field>
      <Field label="Currency">
        <select className="soli-input" value={settings.currency || "USD"}
          onChange={e => saveSettings({ ...settings, currency: e.target.value })}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <p className="soli-help">The symbol shown on every figure in Soli. Your Soli subscription is billed separately by Stripe in USD.</p>
      </Field>
      <Field label="Booth rent">
        <div className="soli-seg">
          {[["hour", "Per hour"], ["week", "Per week"], ["month", "Per month"]].map(([k, lbl]) => (
            <button key={k} type="button" className={"soli-segbtn" + (bUnit === k ? " on" : "")} onClick={() => setBooth({ boothRentUnit: k })}>{lbl}</button>
          ))}
        </div>
        <input className="soli-input" type="number" style={{ marginTop: 10 }} placeholder={`Amount (${curSymbol(settings.currency)})`}
          value={bUnit === "hour" ? (settings.boothRentAmount ?? settings.boothRentHourly ?? "") : (settings.boothRentAmount ?? "")}
          onChange={e => setBooth({ boothRentAmount: e.target.value })} />
        {bUnit !== "hour" && (
          <input className="soli-input" type="number" placeholder="Hours you work per week"
            value={settings.boothRentHoursPerWeek || ""} onChange={e => setBooth({ boothRentHoursPerWeek: e.target.value })} />
        )}
        <p className="soli-help">
          {bUnit === "hour"
            ? "The rate behind every profit number. Set 0 if you don't pay booth rent."
            : (Number(settings.boothRentAmount) > 0 && Number(settings.boothRentHoursPerWeek) > 0
              ? `Soli uses ${money2(boothHourly(settings))}/hr in profit math` + (bUnit === "week" ? ` (≈ ${money2(Number(settings.boothRentAmount) * 52 / 12)}/month)` : ` (≈ ${money2(Number(settings.boothRentAmount) * 12 / 52)}/week)`)
              : "Enter the amount and your hours per week, and Soli converts it to an hourly rate for profit math.")}
        </p>
      </Field>
      <Field label="Tax set-aside (%)">
        <input className="soli-input" type="number" value={settings.taxRate}
          onChange={e => saveSettings({ ...settings, taxRate: Number(e.target.value) })} />
        <p className="soli-help">Self-employed? 25 to 30% is a safe starting point (income plus about 15.3% self-employment tax). Ask a tax pro for your exact number.</p>
      </Field>
      <Field label="Weekly recap email">
        <label className="soli-toggle">
          <input type="checkbox" checked={settings.weeklyRecap !== false} onChange={e => saveSettings({ ...settings, weeklyRecap: e.target.checked })} />
          <span>Email me a short summary of what I kept each week.</span>
        </label>
      </Field>

      <PushToggle />

      <ReferralPanel />

      <div className="soli-datatools">
        <div className="soli-datahead">Savings set-asides</div>
        <p className="soli-help" style={{ marginTop: 0 }}>Optional buckets to remind yourself to set aside part of what you keep. These are your own suggestions, not financial advice. Amounts show on your dashboard.</p>
        {buckets.map(b => (
          <div className="soli-bucketrow" key={b.id}>
            <input className="soli-input slim" value={b.name} onChange={e => updBucket(b.id, "name", e.target.value)} />
            <div className="soli-bucketpct"><input className="soli-input slim" type="number" value={b.pct} onChange={e => updBucket(b.id, "pct", e.target.value)} /><span>%</span></div>
            <button className="soli-iconbtn" onClick={() => delBucket(b.id)}><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="soli-bucketadd">
          {[["Taxes", 30], ["Retirement", 10], ["Own business", 20], ["Vacation", 10]].map(([n, p]) => (
            <button key={n} type="button" className="soli-tradebtn" onClick={() => addBucket(n, p)}>+ {n} {p}%</button>
          ))}
          <button type="button" className="soli-tradebtn" onClick={() => addBucket("Savings", 10)}>+ Custom</button>
        </div>
      </div>

      <div className="soli-datatools">
        <div className="soli-datahead">Your data</div>
        <p className="soli-help" style={{ marginTop: 0 }}>
          Everything Soli holds for you, in one place. It saves to your account, so it follows you to any device you sign in on.
        </p>

        {importOpen ? (
          <CsvImport
            clients={clients}
            logs={logs}
            money2={money2}
            onClose={() => setImportOpen(false)}
            onImport={(rows) => {
              const res = onImportServices(rows);
              setImportOpen(false);
              setImportNote(
                `Brought in ${res.services} ${res.services === 1 ? "service" : "services"}` +
                (res.clients ? ` and added ${res.clients} new ${res.clients === 1 ? "client" : "clients"}` : "") + "."
              );
            }}
          />
        ) : (
          <div className="soli-subblock">
            <div className="soli-subhead">Bring in past work</div>
            <p className="soli-help" style={{ marginTop: 0 }}>
              Moving from another app? Import your appointments or payments so your history, trends and tax totals start from the beginning rather than today.
            </p>
            <button className="soli-ghost" onClick={() => { setImportNote(""); setImportOpen(true); }}>Import from a file</button>
            {importNote && <p className="soli-help">{importNote}</p>}
          </div>
        )}

        <TaxExport logs={logs} clients={clients} settings={settings} rent={rent} taxRate={settings.taxRate} expenses={expenses} />

        <DataExport settings={settings} clients={clients} products={products} logs={logs} plan={plan} expenses={expenses} />

        <div className="soli-subblock">
          <div className="soli-subhead">Start over</div>
          <button className="soli-ghost" onClick={onLoad}>Load sample data to explore</button>
          <button className="soli-del" style={{ marginTop: 10 }} onClick={onClear}><Trash2 size={15} /> Clear all data</button>
        </div>
      </div>

      <div className="soli-danger">
        <div className="soli-datahead">Delete your account</div>
        <p className="soli-help" style={{ marginTop: 0 }}>
          Permanently erases your account and everything in it: services, clients, products and settings.
          Any active subscription is canceled first. This cannot be undone, so export anything you want to keep before you start.
        </p>
        {!delOpen ? (
          <button className="soli-del" onClick={() => setDelOpen(true)}><Trash2 size={15} /> Delete my account</button>
        ) : (
          <>
            <label className="soli-label" style={{ marginTop: 6 }}>Type DELETE to confirm</label>
            <input className="soli-input" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />
            {delErr && <p className="soli-help" style={{ color: "var(--clay-d)" }}>{delErr}</p>}
            <div className="soli-refactions">
              <button className="soli-del" disabled={delConfirm.trim() !== "DELETE" || delBusy} onClick={runDelete}>
                {delBusy ? "Deleting…" : "Permanently delete"}
              </button>
              <button className="soli-editbtn" onClick={() => { setDelOpen(false); setDelConfirm(""); setDelErr(""); }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- RECENT LOGS -------------------------------- */
/* Lets a logged service be corrected or removed. Without this a typo stays in
   the numbers permanently, and the only escape is wiping all data. */
function RecentLogs({ logs, clients, rent, updateLog, deleteLog }) {
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({});

  const recent = useMemo(
    () => [...(logs || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12),
    [logs]
  );
  if (recent.length === 0) return null;

  /* An empty id means it was logged without a client, which is normal for a
     walk-in. An id that no longer matches anyone means the client was removed,
     and saying so is clearer than implying the service never had one. */
  const nameOf = (id) => {
    if (!id) return "No client";
    return (clients.find((c) => c.id === id) || {}).name || "Removed client";
  };

  const startEdit = (l) => {
    setOpen(l.id);
    setForm({
      service: l.service, price: String(l.price ?? ""), durationMin: String(l.durationMin ?? ""),
      tip: String(l.tip || ""), productCost: String(l.productCost ?? ""), paySource: l.paySource || "card",
      date: ymd(l.date),
    });
  };
  const commit = (id) => {
    const price = Number(form.price) || 0;
    const durationMin = Number(form.durationMin) || 0;
    if (!form.service.trim() || durationMin <= 0) return;
    updateLog(id, {
      service: form.service.trim(), price, durationMin,
      tip: Number(form.tip) || 0, productCost: Number(form.productCost) || 0,
      paySource: form.paySource,
      date: dateFromInput(form.date),
    });
    setOpen(null);
  };
  const remove = (l) => {
    if (confirm(`Delete "${l.service}" for ${nameOf(l.clientId)}? This cannot be undone.`)) {
      deleteLog(l.id);
      setOpen(null);
    }
  };

  return (
    <section className="soli-block" style={{ marginTop: 24 }}>
      <div className="soli-blockhead"><Bell size={18} strokeWidth={1.9} /><h2>Recent services</h2></div>
      <p className="soli-note">Tap one to fix a typo or remove it. Corrections update every number in Soli.</p>
      {recent.map((l) => (
        <div className="soli-recentrow" key={l.id}>
          {open === l.id ? (
            <div className="soli-recentedit">
              <Field label="Service"><input className="soli-input" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></Field>
              <div className="soli-row2">
                <Field label={`Price (${CUR})`}><input className="soli-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
                <Field label="Minutes"><input className="soli-input" type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
              </div>
              <div className="soli-row2">
                <Field label={`Tip (${CUR})`}><input className="soli-input" type="number" value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })} /></Field>
                <Field label={`Product cost (${CUR})`}><input className="soli-input" type="number" value={form.productCost} onChange={(e) => setForm({ ...form, productCost: e.target.value })} /></Field>
              </div>
              <Field label="Date"><input className="soli-input" type="date" value={form.date || ""} max={ymd(new Date().toISOString())} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Paid by">
                <div className="soli-seg">
                  {SOURCES.map((s) => (
                    <button key={s.id} type="button" className={"soli-segbtn" + (form.paySource === s.id ? " on" : "")} onClick={() => setForm({ ...form, paySource: s.id })}>{s.label}</button>
                  ))}
                </div>
              </Field>
              <div className="soli-editactions">
                <button className="soli-cta sm" onClick={() => commit(l.id)}>Save changes</button>
                <button className="soli-editbtn" onClick={() => setOpen(null)}>Cancel</button>
                <button className="soli-del" onClick={() => remove(l)}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ) : (
            <button className="soli-recentbtn" onClick={() => startEdit(l)}>
              <span className="soli-recentmain">
                <span className="soli-recentsvc">{l.service}</span>
                <span className="soli-recentmeta">{fmtDate(l.date)} · {nameOf(l.clientId)} · {srcLabel(l.paySource)}</span>
              </span>
              <span className="soli-recentamt">
                {money2(l.price)}
                <small>{money2(profitOf(l, rent).profit)} kept</small>
              </span>
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

/* ------------------------------- EXPENSES -------------------------------- */
/* Overhead the business carries regardless of any single service. Deliberately
   kept out of profitOf so per-service comparisons stay meaningful, and folded
   in only at the business level (dashboard totals and the tax summary). */
function ExpensesView({ expenses, saveExpenses, ready }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState(null);

  const add = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    saveExpenses([{ id: uid(), date: new Date(date + "T12:00:00").toISOString(), category, note: note.trim(), amount: round2(amt) }, ...expenses]);
    setNote(""); setAmount(""); setDate(today);
  };
  const upd = (id, key, v) => saveExpenses(expenses.map((e) => e.id === id ? { ...e, [key]: key === "amount" ? round2(Number(v) || 0) : v } : e));
  const del = (id) => saveExpenses(expenses.filter((e) => e.id !== id));
  const repeat = (e) => saveExpenses([{ ...e, id: uid(), date: new Date().toISOString() }, ...expenses]);

  const sorted = useMemo(() => [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)), [expenses]);
  const thisMonth = useMemo(() => {
    const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return expenses.filter((e) => new Date(e.date).getTime() >= start).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [expenses]);
  const thisYear = useMemo(() => {
    const y = new Date().getFullYear();
    return expenses.filter((e) => new Date(e.date).getFullYear() === y).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [expenses]);

  if (!ready) {
    return (
      <div className="soli-page">
        <h1 className="soli-h1">Expenses</h1>
        <p className="soli-sub">Track the costs that are not tied to one service.</p>
        <div className="soli-empty">
          <span className="soli-emptymark"><Receipt size={26} strokeWidth={1.8} /></span>
          <h2>Almost ready</h2>
          <p>Expenses need one quick database update before they can save. Once that is done, this page starts working straight away.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="soli-page">
      <h1 className="soli-h1">Expenses</h1>
      <p className="soli-sub">Rent, supplies, mileage, insurance and anything else the business pays for.</p>
      <p className="soli-help" style={{ marginTop: 0, marginBottom: 16 }}>
        These are business costs, not per-service costs, so they do not change your profit per service. They come off your totals and feed the year-end tax summary. Product used on a client belongs in <b>Inventory</b> instead.
      </p>

      <div className="soli-cards" style={{ marginBottom: 20 }}>
        <Stat label="This month" value={money2(thisMonth)} tone="cost" />
        <Stat label="This year" value={money2(thisYear)} tone="cost" />
      </div>

      <div className="soli-addbox" style={{ marginBottom: 20 }}>
        <div className="soli-addhead">Add an expense</div>
        <div className="soli-exprow">
          <input className="soli-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="soli-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="soli-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input className="soli-input" type="number" inputMode="decimal" placeholder={`Amount ${CUR}`} value={amount}
            onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        </div>
        <button className="soli-cta sm" onClick={add} disabled={!Number(amount)}>Add expense</button>
      </div>

      {sorted.length === 0 ? (
        <p className="soli-emptyhint" style={{ textAlign: "left" }}>No expenses yet. Add your booth rent to start, since it is usually the biggest one.</p>
      ) : (
        <div className="soli-invtable">
          <div className="soli-exphead"><span>Date</span><span>Category</span><span>Note</span><span>Amount</span><span></span></div>
          {sorted.map((e) => (
            <div className="soli-exprowline" key={e.id}>
              {editing === e.id ? (
                <>
                  <input className="soli-input slim" type="date" value={new Date(e.date).toISOString().slice(0, 10)}
                    onChange={(ev) => upd(e.id, "date", new Date(ev.target.value + "T12:00:00").toISOString())} />
                  <select className="soli-input slim" value={e.category} onChange={(ev) => upd(e.id, "category", ev.target.value)}>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="soli-input slim" value={e.note || ""} onChange={(ev) => upd(e.id, "note", ev.target.value)} />
                  <input className="soli-input slim" type="number" value={e.amount} onChange={(ev) => upd(e.id, "amount", ev.target.value)} />
                  <button className="soli-editbtn" onClick={() => setEditing(null)}>Done</button>
                </>
              ) : (
                <>
                  <span className="soli-expdate">{fmtDate(e.date)}</span>
                  <span>{e.category}</span>
                  <span className="soli-expnote">{e.note || ""}</span>
                  <span className="soli-expamt">{money2(e.amount)}</span>
                  <span className="soli-expactions">
                    <button className="soli-linkbtn" onClick={() => setEditing(e.id)}>Edit</button>
                    <button className="soli-linkbtn" onClick={() => repeat(e)} title="Add the same expense again, dated today">Repeat</button>
                    <button className="soli-iconbtn" onClick={() => del(e.id)}><Trash2 size={15} /></button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- DATA EXPORT -------------------------------- */
/* A full copy of everything, so the data in Soli is genuinely the user's and
   they can leave with it. The JSON keeps every field exactly as stored; the
   CSVs are for reading and for handing to someone else. */
function DataExport({ settings, clients, products, logs, plan, expenses }) {
  const [note, setNote] = useState("");

  const stamp = ymd(new Date().toISOString());

  const exportAll = async () => {
    const payload = {
      soliExport: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        clients: clients.length, products: products.length,
        services: logs.length, expenses: expenses.length,
      },
      settings, plan, clients, products, logs, expenses,
    };
    try {
      const how = await saveFile(`soli-backup-${stamp}.json`, JSON.stringify(payload, null, 2));
      if (how === "cancelled") { setNote(""); return; }
      setNote(
        (how === "shared" ? "Choose where to keep it. " : "") +
        `Saved everything: ${logs.length} services, ${clients.length} clients, ${expenses.length} expenses.`
      );
    } catch {
      setNote("Could not save the file. Try again, or use a different browser.");
    }
  };

  const exportClients = () => {
    const head = ["Name", "Phone", "Notes", "Rebook every (weeks)", "Last visit", "Visits", "Lifetime revenue"];
    const body = clients.map((c) => {
      const ls = logs.filter((l) => l.clientId === c.id);
      const revenue = ls.reduce((s, l) => s + (Number(l.price) || 0) + (Number(l.tip) || 0), 0);
      return [c.name, c.phone || "", c.notes || "", c.rebookWeeks || "",
        c.lastVisit ? ymd(c.lastVisit) : "", visitDays(ls).length, round2(revenue)];
    });
    download(`soli-clients-${stamp}.csv`, toCsv([head, ...body]));
    setNote(`Saved ${clients.length} clients.`);
  };

  const exportExpenses = () => {
    const head = ["Date", "Category", "Note", "Amount"];
    const body = [...expenses]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((e) => [ymd(e.date), e.category, e.note || "", round2(e.amount)]);
    download(`soli-expenses-${stamp}.csv`, toCsv([head, ...body]));
    setNote(`Saved ${expenses.length} expenses.`);
  };

  const nothingYet = logs.length === 0 && clients.length === 0 && expenses.length === 0;

  return (
    <div className="soli-subblock">
      <div className="soli-subhead">Backups</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        Your records belong to you. Take a copy whenever you like, or before making big changes.
      </p>
      {nothingYet ? (
        <p className="soli-help">Nothing to download yet. Log a service first.</p>
      ) : (
        <>
          <div className="soli-refactions">
            <button className="soli-cta sm" onClick={exportClients} disabled={clients.length === 0}>Clients spreadsheet</button>
            <button className="soli-ghost" onClick={exportExpenses} disabled={expenses.length === 0}>Expenses spreadsheet</button>
          </div>
          <p className="soli-help">
            Spreadsheets open in Excel or Numbers. For your services and totals, use the year-end summary above.
          </p>

          <button className="soli-ghost" style={{ marginTop: 6 }} onClick={exportAll}>Full backup file</button>
          {note && <p className="soli-help">{note}</p>}
          <p className="soli-help">
            The backup is a JSON file: it holds every field Soli stores so nothing is lost, but it is meant for safekeeping rather than reading. Soli cannot load one back in yet, so treat it as a copy rather than a restore.
          </p>
        </>
      )}
    </div>
  );
}

/* ----------------------------- TAX EXPORT -------------------------------- */
/* Note on tips: profitOf deliberately excludes them so services can be compared
   fairly. Tips are still income, so the tax figures here add them back. Using
   the dashboard's profit number for taxes would understate earnings. */
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/* Saves a generated file, working around three real browser quirks:

   - an anchor that is never added to the page is ignored by Safari and Firefox,
     so it has to be attached before the click and removed after
   - octet-stream is used instead of the true type, because Safari renders JSON
     and CSV inline rather than saving them
   - iOS ignores the download attribute on blob URLs entirely, so the share
     sheet is the only way to get the file into Files or iCloud there */
async function saveFile(name, text) {
  const blob = new Blob([text], { type: "application/octet-stream" });

  if (isIOS()) {
    try {
      const file = new File([blob], name, { type: "application/octet-stream" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return "shared";
      }
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // fall through and try the anchor
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

// CSVs keep the byte order mark so Excel opens accented names correctly.
const download = (name, text) => saveFile(name, "﻿" + text);
const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/* Turn a date input's YYYY-MM-DD into a timestamp. Anchored at midday so a
   timezone shift can never push the entry onto the day before or after, which
   would land visits in the wrong week or month. Today keeps the current time. */
const dateFromInput = (s) => {
  if (!s) return new Date().toISOString();
  return s === ymd(new Date().toISOString())
    ? new Date().toISOString()
    : new Date(s + "T12:00:00").toISOString();
};
const round2 = (n) => Math.round(n * 100) / 100;

function TaxExport({ logs, clients, settings, rent, taxRate, expenses = [] }) {
  const years = useMemo(() => {
    const set = new Set([
      ...(logs || []).map((l) => new Date(l.date).getFullYear()),
      ...(expenses || []).map((e) => new Date(e.date).getFullYear()),
    ]);
    return [...set].sort((a, b) => b - a);
  }, [logs, expenses]);
  const [year, setYear] = useState(years[0] || new Date().getFullYear());
  useEffect(() => { if (years.length && !years.includes(year)) setYear(years[0]); }, [years, year]);

  const nameOf = (id) => (clients.find((c) => c.id === id) || {}).name || "";
  const rows = useMemo(() => (logs || []).filter((l) => new Date(l.date).getFullYear() === year), [logs, year]);

  const expRows = useMemo(
    () => (expenses || []).filter((e) => new Date(e.date).getFullYear() === year),
    [expenses, year]
  );

  const t = useMemo(() => {
    let revenue = 0, tips = 0, product = 0, booth = 0, minutes = 0;
    rows.forEach((l) => {
      const b = (l.durationMin / 60) * rent;
      revenue += Number(l.price) || 0;
      tips += Number(l.tip) || 0;
      product += Number(l.productCost) || 0;
      booth += b;
      minutes += Number(l.durationMin) || 0;
    });

    // Group logged overhead by category.
    const byCat = {};
    expRows.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
    const overhead = Object.values(byCat).reduce((s, v) => s + v, 0);
    const rentPaid = byCat[RENT_CATEGORY] || 0;

    // Booth time is an allocation used for per-service pricing, not a real
    // second payment. If actual rent has been logged, counting both would
    // deduct the same cost twice, so the allocation is dropped here.
    const rentLogged = rentPaid > 0;
    const boothCounted = rentLogged ? 0 : booth;

    const gross = revenue + tips;            // tips are income
    const deductions = product + boothCounted + overhead;
    const net = gross - deductions;
    return {
      revenue, tips, product, booth, minutes, gross, net,
      byCat, overhead, rentLogged, boothCounted, deductions,
      setAside: net * (taxRate / 100),
    };
  }, [rows, expRows, rent, taxRate]);

  if (years.length === 0) {
    return (
      <div className="soli-subblock">
        <div className="soli-subhead">Year-end summary</div>
        <p className="soli-help" style={{ marginTop: 0 }}>Log some services and your year-end summary and accountant export will appear here.</p>
      </div>
    );
  }

  const cur = settings.currency || "USD";

  const exportServices = () => {
    const head = ["Date", "Client", "Service", "Payment method", "Currency", "Price", "Tip", "Product cost", "Booth time cost", "Net (excl. tip)", "Minutes"];
    const body = rows
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((l) => {
        const b = (l.durationMin / 60) * rent;
        return [ymd(l.date), nameOf(l.clientId), l.service, srcLabel(l.paySource), cur,
          round2(l.price), round2(Number(l.tip) || 0), round2(l.productCost), round2(b),
          round2(l.price - l.productCost - b), l.durationMin];
      });
    download(`soli-services-${year}.csv`, toCsv([head, ...body]));
  };

  const exportSummary = () => {
    const out = [
      ["Soli year-end summary", String(year)],
      ["Currency", cur],
      ["Generated", ymd(new Date().toISOString())],
      [],
      ["INCOME"],
      ["Service revenue", round2(t.revenue)],
      ["Tips", round2(t.tips)],
      ["Gross income", round2(t.gross)],
      [],
      ["DEDUCTIONS (from your entries)"],
      ["Product used on clients", round2(t.product)],
      ...EXPENSE_CATEGORIES.filter((c) => t.byCat[c]).map((c) => [c, round2(t.byCat[c])]),
      ...(t.rentLogged ? [] : [["Booth time allocated to services", round2(t.boothCounted)]]),
      ["Total deductions", round2(t.deductions)],
      [],
      ["Net profit before tax", round2(t.net)],
      [`Set aside at your ${taxRate}% rate`, round2(t.setAside)],
      [],
      ["Services logged", rows.length],
      ["Hours in chair", round2(t.minutes / 60)],
      ["Expense entries", expRows.length],
      [],
      ["Note", "Prepared from figures entered by the user. Not tax advice and not a filed return."],
      t.rentLogged
        ? ["Note", `Booth rent uses the ${money2(t.byCat[RENT_CATEGORY])} actually logged as an expense. The hourly booth-time allocation used for per-service pricing (${money2(t.booth)}) is excluded here so the same cost is not deducted twice.`]
        : ["Note", `No booth rent was logged as an expense, so booth time is estimated as hours worked times the hourly rate in Settings (${money2(t.booth)}). If you pay rent, log the actual amounts under Expenses for a more accurate figure.`],
      ["Note", "Only costs you have entered are included. Anything not logged, such as mileage or insurance, is missing from this summary."],
    ];
    download(`soli-tax-summary-${year}.csv`, toCsv(out));
  };

  return (
    <div className="soli-subblock">
      <div className="soli-subhead">Year-end summary</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        A year of your numbers, ready to hand to an accountant. Tips are counted as income here, even though they stay out of the per-service profit comparisons.
      </p>

      <select className="soli-input" style={{ marginBottom: 12 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <div className="soli-taxgrid">
        <div><span>Gross income</span><b>{money2(t.gross)}</b></div>
        <div><span>Deductions</span><b className="cost">{money2(t.deductions)}</b></div>
        <div><span>Net before tax</span><b className="profit">{money2(t.net)}</b></div>
        <div><span>Set aside ({taxRate}%)</span><b>{money2(t.setAside)}</b></div>
      </div>

      {t.rentLogged && (
        <p className="soli-help">
          Using the {money2(t.byCat[RENT_CATEGORY])} of booth rent you logged, rather than the {money2(t.booth)} hourly allocation, so the same cost is not counted twice.
        </p>
      )}

      <div className="soli-refactions" style={{ marginTop: 12 }}>
        <button className="soli-cta sm" onClick={exportSummary}>Download summary</button>
        <button className="soli-ghost" onClick={exportServices}>Download services</button>
      </div>

      <p className="soli-help">
        Prepared from what you entered, so it is only as accurate as your logs. It is not tax advice or a filed return. Booth time is your hours times your hourly rate. If you pay flat rent, give your accountant the amount actually paid. Costs Soli does not track, like supplies, mileage or insurance, are not included.
      </p>
    </div>
  );
}

/* ------------------------------- REFERRAL -------------------------------- */
function ReferralPanel() {
  const [code, setCode] = useState("");
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/referral")
      .then((r) => r.json())
      .then((d) => { if (d?.code) { setCode(d.code); setCount(d.count || 0); } else if (d?.error) setErr(d.error); })
      .catch(() => setErr("Could not load your referral link."));
  }, []);

  const link = code ? `https://soli.beauty/?ref=${code}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setErr("Copy failed. Select the link and copy it manually."); }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Soli", text: "Soli shows what you actually keep after product, booth rent and taxes. Try it free:", url: link });
      else copy();
    } catch { /* user dismissed the share sheet */ }
  };

  return (
    <div className="soli-datatools">
      <div className="soli-datahead">Invite a friend</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        Share your link. They get an extra 30 days free, and you get a free month too, added to your trial or credited to your bill.
      </p>
      {err && <p className="soli-help" style={{ color: "var(--clay-d)" }}>{err}</p>}
      {code ? (
        <>
          <div className="soli-reflink">{link}</div>
          <div className="soli-refactions">
            <button className="soli-cta sm" onClick={share}>Share link</button>
            <button className="soli-ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="soli-help">
            {count === 0 ? "No one has joined from your link yet." : `${count} ${count === 1 ? "person has" : "people have"} joined from your link.`}
          </p>
        </>
      ) : !err ? <p className="soli-help">Loading your link…</p> : null}
    </div>
  );
}

/* ------------------------------ PLAN PICKER ------------------------------ */
/* Prices come from Stripe via /api/plans so the app can never show a figure
   different from what is charged. If the annual price is missing, this quietly
   falls back to a single monthly button. */
function PlanPicker({ onSubscribe, busy }) {
  const [plans, setPlans] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => { if (!off) setPlans(d); })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, []);

  if (failed || (plans && !plans.monthly && !plans.annual)) {
    return <button className="soli-cta sm" onClick={() => onSubscribe("monthly")} disabled={busy}>{busy ? "One moment…" : "Subscribe"}</button>;
  }
  if (!plans) return <button className="soli-cta sm" disabled>Loading plans…</button>;

  const m = plans.monthly, a = plans.annual;
  return (
    <div className="soli-plans">
      {m && (
        <button className="soli-planopt" onClick={() => onSubscribe("monthly")} disabled={busy}>
          <span className="soli-planname">Monthly</span>
          <span className="soli-planprice">{m.label}<small>/mo</small></span>
        </button>
      )}
      {a && (
        <button className="soli-planopt best" onClick={() => onSubscribe("annual")} disabled={busy}>
          <span className="soli-planname">
            Yearly
            {plans.savingPct > 0 && <em className="soli-planbadge2">save {plans.savingPct}%</em>}
          </span>
          <span className="soli-planprice">{a.label}<small>/yr</small></span>
          {plans.perMonth && <span className="soli-planfoot">works out to {plans.perMonth}/mo</span>}
        </button>
      )}
    </div>
  );
}

/* ------------------------------- PAYWALL --------------------------------- */
function Paywall({ email, onSubscribe, onSignOut, busy, onRedeem }) {
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [err, setErr] = useState("");
  const redeem = async () => {
    setErr(""); setRedeeming(true);
    const r = await onRedeem(code.trim());
    if (!r.ok) { setErr(r.error); setRedeeming(false); } // on success the app unmounts the paywall
  };
  return (
    <div className="soli-root soli-center">
      <Styles />
      <div className="soli-paywall">
        <span className="soli-logomark" style={{ width: 56, height: 56 }}><Sun size={26} strokeWidth={1.8} /></span>
        <h1>Your free trial has ended</h1>
        <p>Subscribe to keep your real take-home, tax jar, profit-per-hour, and every client and number you've logged.</p>
        <PlanPicker onSubscribe={onSubscribe} busy={busy} />
        <p className="soli-paynote">Your data is safe and waiting. Subscribing brings it right back.</p>
        {!showCode ? (
          <button className="soli-linkbtn" style={{ marginTop: 2 }} onClick={() => setShowCode(true)}>Have a promo code?</button>
        ) : (
          <div className="soli-promo">
            <input className="soli-input" placeholder="Enter your code" value={code} onChange={e => { setCode(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter" && code.trim()) redeem(); }} />
            <button className="soli-ghost" onClick={redeem} disabled={redeeming || !code.trim()}>{redeeming ? "Checking…" : "Redeem"}</button>
          </div>
        )}
        {err && <p className="soli-paynote" style={{ color: "var(--clay-d)" }}>{err}</p>}
        <button className="soli-navbtn soli-signout" style={{ margin: "6px auto 0" }} onClick={onSignOut}><LogOut size={16} /> Sign out</button>
        {email && <p className="soli-paynote">Signed in as {email}</p>}
      </div>
    </div>
  );
}

/* -------------------------------- STYLES --------------------------------- */
function Styles() {
  return (<style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.soli-root{--bg:#F6EFE4;--surface:#FFFDF9;--surface2:#FBF5EB;--ink:#2B2118;--ink2:#6E5E4C;--line:#E7DBC8;
  --clay:#BC6B4C;--clay-d:#A4583B;--sage:#6E7A56;--sage-d:#5A6646;--profit:#5E7142;--cost:#9A6A54;--gold:#C9A24B;
  font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;line-height:1.45;
  background-image:radial-gradient(circle at 12% 0%,rgba(201,162,75,.10),transparent 42%),radial-gradient(circle at 90% 8%,rgba(188,107,76,.08),transparent 40%)}
*{box-sizing:border-box}
.soli-center{display:flex;align-items:center;justify-content:center;height:100vh}
.soli-loadmark{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--clay);color:#fff;animation:spin 3s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.soli-header{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:16px 26px;background:rgba(255,253,249,.82);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.soli-brand{display:flex;align-items:center;gap:10px}
.soli-logomark{width:32px;height:32px;border-radius:50%;background:var(--clay);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(188,107,76,.35)}
.soli-wordmark{font-family:'Fraunces',serif;font-weight:600;font-size:25px;letter-spacing:-.5px}
.soli-tag{font-size:11.5px;color:var(--ink2);font-style:italic;border-left:1px solid var(--line);padding-left:10px;margin-left:2px}
.soli-nav{display:flex;gap:4px;flex-wrap:wrap}
.soli-navbtn{display:flex;align-items:center;gap:7px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;color:var(--ink2);padding:8px 13px;border-radius:9px;transition:.15s}
.soli-navbtn:hover{background:var(--surface2);color:var(--ink)}
.soli-navbtn.active{background:var(--ink);color:var(--bg)}
.soli-signout{margin-left:6px;border-left:1px solid var(--line);border-radius:0 9px 9px 0;color:var(--clay-d)}
.soli-signout:hover{background:#F6E5DA;color:var(--clay-d)}
.soli-main{max-width:920px;margin:0 auto;padding:30px 22px 80px}
.soli-page{animation:rise .4s ease both}
.soli-narrow{max-width:560px;margin:0 auto}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.soli-h1{font-family:'Fraunces',serif;font-weight:600;font-size:34px;margin:0 0 4px;letter-spacing:-.6px}
.soli-sub{color:var(--ink2);margin:0 0 24px;font-size:14.5px}
.soli-dashhead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px}
.soli-rangeseg{display:inline-flex;background:var(--surface2);border:1px solid var(--line);border-radius:11px;padding:3px}
.soli-rangebtn{border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink2);padding:6px 12px;border-radius:8px;transition:.12s}
.soli-rangebtn:hover{color:var(--ink)}
.soli-rangebtn.on{background:var(--ink);color:var(--bg)}
.soli-monthchart{display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:8px}
.soli-monthcol{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;min-width:0}
.soli-monthval{font-size:9.5px;font-weight:600;color:var(--ink2);height:14px;white-space:nowrap}
.soli-monthbarwrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
.soli-monthbar{width:70%;max-width:26px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--sage),var(--sage-d));transition:.2s;cursor:default}
.soli-monthcol:hover .soli-monthbar{background:linear-gradient(180deg,var(--clay),var(--clay-d))}
.soli-monthlabel{font-size:10.5px;color:var(--ink2);margin-top:6px}

.soli-hero{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-bottom:14px}
@media(max-width:560px){.soli-hero{grid-template-columns:1fr}.soli-tag{display:none}}
.soli-heroblock{background:linear-gradient(150deg,#5E7142,#475431);color:#F4F0E4;border-radius:18px;padding:20px 22px;display:flex;flex-direction:column}
.soli-herolabel{font-size:12.5px;display:flex;align-items:center;gap:6px;color:#D6DBC2;margin-bottom:8px}
.soli-heroval{font-family:'Fraunces',serif;font-size:34px;font-weight:600;line-height:1}
.soli-herosub{font-size:11.5px;opacity:.8;margin-top:6px}
.soli-herodelta{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;margin-top:9px;padding:3px 10px;border-radius:20px;width:fit-content;background:rgba(255,255,255,.15)}
.soli-herodelta.up{color:#cfe6ae}
.soli-herodelta.down{color:#f2bda5}
.soli-herojar{background:linear-gradient(150deg,#C9A24B,#A9863A);color:#fff;border-radius:18px;padding:20px 22px;display:flex;flex-direction:column}
.soli-jarlabel{font-size:12.5px;display:flex;align-items:center;gap:6px;opacity:.92;margin-bottom:8px}
.soli-jarval{font-family:'Fraunces',serif;font-size:30px;font-weight:600;line-height:1}

.soli-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}
@media(max-width:680px){.soli-cards{grid-template-columns:repeat(2,1fr)}}
.soli-stat{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:15px 16px}
.soli-statlabel{font-size:11.5px;color:var(--ink2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
.soli-statval{font-family:'Fraunces',serif;font-size:21px;font-weight:600}
.soli-stat.profit .soli-statval{color:var(--profit)}
.soli-stat.cost .soli-statval{color:var(--cost)}

.soli-block{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px 24px;margin-bottom:18px}
.soli-blockhead{display:flex;align-items:center;gap:9px;color:var(--clay-d)}
.soli-blockhead h2{font-family:'Fraunces',serif;font-size:18px;font-weight:600;margin:0;color:var(--ink)}
.soli-note{font-size:13px;color:var(--ink2);margin:8px 0 16px}

.soli-srcgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
@media(max-width:560px){.soli-srcgrid{grid-template-columns:repeat(2,1fr)}}
.soli-srccell{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:12px 13px;display:flex;flex-direction:column;gap:4px}
.soli-srclabel{font-size:11.5px;color:var(--ink2)}
.soli-srcval{font-family:'Fraunces',serif;font-size:18px;font-weight:600}
.soli-srcnote{margin-top:13px;font-size:12.5px;color:var(--clay-d);background:#F6E5DA;border-radius:10px;padding:10px 13px}

.soli-bars{display:flex;flex-direction:column;gap:15px}
.soli-barlabel{display:flex;justify-content:space-between;font-size:14px;font-weight:500;margin-bottom:6px}
.soli-barval{font-family:'Fraunces',serif;color:var(--sage-d);font-weight:600}
.soli-bartrack{height:9px;background:var(--surface2);border-radius:6px;overflow:hidden}
.soli-barfill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--sage),var(--sage-d));transition:width .7s cubic-bezier(.2,.8,.2,1)}
.soli-barmeta{font-size:12px;color:var(--ink2);margin-top:5px}

.soli-watch{background:linear-gradient(160deg,#FBEFE6,#F8E7DB);border-color:#EBD3C2}
.soli-watchrow{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #EDD8C8;font-size:14px}
.soli-watchrow:first-of-type{border-top:none}
.soli-watchval{font-family:'Fraunces',serif;font-weight:600;color:var(--clay-d)}

.soli-duerow{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.soli-duerow:first-of-type{border-top:none}
.soli-dueactions{display:flex;align-items:center;gap:9px}
.soli-textlink{display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;color:#fff;background:var(--sage-d);padding:5px 12px;border-radius:20px;text-decoration:none;transition:.15s}
.soli-textlink:hover{background:#4a5539}
.soli-contactrow{display:flex;align-items:center;gap:12px}
.soli-contactrow a:first-child{color:var(--clay-d);text-decoration:none;font-weight:500}
.soli-contactrow a:first-child:hover{text-decoration:underline}
.soli-duename{font-weight:600;font-size:14.5px}.soli-duemeta{font-size:12.5px;color:var(--ink2)}
.soli-pill{font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:20px}
.soli-pill.late{background:#F3DACE;color:var(--clay-d)}.soli-pill.soon{background:#E4E8D6;color:var(--sage-d)}

.soli-cta{width:100%;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;background:var(--clay);color:#fff;padding:15px;border-radius:13px;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:9px;transition:.15s;box-shadow:0 6px 16px rgba(188,107,76,.28)}
.soli-cta:hover{background:var(--clay-d);transform:translateY(-1px)}
.soli-cta:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;transform:none}
.soli-cta.sm{font-size:14px;padding:12px;box-shadow:none}

.soli-field{margin-bottom:18px}
.soli-label{display:block;font-size:13px;font-weight:600;margin-bottom:7px;color:var(--ink)}
.soli-input{width:100%;font-family:inherit;font-size:14.5px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:12px 13px;margin-bottom:8px;outline:none;transition:.15s}
.soli-input:focus{border-color:var(--clay);box-shadow:0 0 0 3px rgba(188,107,76,.12)}
.soli-input.slim{padding:8px 10px;margin:0;font-size:13.5px}
/* Grid and flex children default to min-width:auto, which refuses to shrink
   below their content. Native date and number inputs report a wide intrinsic
   size, so on a phone they hold their column open and crowd the field beside
   them. Letting them shrink is what keeps narrow layouts tidy. */
.soli-row2 > *, .soli-row3 > *, .soli-row4 > *, .soli-exprow > *,
.soli-invrow > *, .soli-invhead > *, .soli-weekrow > *, .soli-weekhead > *,
.soli-exprowline > *, .soli-exphead > *, .soli-improw > *, .soli-bucketrow > * { min-width: 0 }
.soli-input, .soli-qty, .soli-stockbtn { max-width: 100% }
.soli-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.soli-row3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}
@media(max-width:540px){.soli-row3{grid-template-columns:1fr}}
.soli-row4{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px}
@media(max-width:540px){.soli-row4{grid-template-columns:1fr 1fr}}

.soli-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
@media(max-width:540px){.soli-seg{grid-template-columns:repeat(2,1fr)}}
.soli-segbtn{font-family:inherit;font-size:12.5px;border:1px solid var(--line);background:var(--surface);color:var(--ink2);border-radius:10px;padding:10px 6px;cursor:pointer;transition:.12s}
.soli-segbtn:hover{border-color:var(--clay)}
.soli-segbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}

.soli-prodgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:540px){.soli-prodgrid{grid-template-columns:1fr}}
.soli-prodpick{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:7px 10px}
.soli-prodname{font-size:13px;display:flex;flex-direction:column}.soli-prodname small{color:var(--ink2);font-size:11px}
.soli-qty{width:56px;text-align:center;font-family:inherit;border:1px solid var(--line);border-radius:8px;padding:6px;font-size:13px;outline:none}
.soli-qty:focus{border-color:var(--clay)}

.soli-preview{border-radius:14px;padding:16px 18px;margin:6px 0 18px;border:1px solid}
.soli-preview.good{background:#EDF0E2;border-color:#D3DBBC}
.soli-preview.bad{background:#F6E0D5;border-color:#E8C4B0}
.soli-prevrow{display:flex;justify-content:space-between;font-size:13.5px;color:var(--ink2);padding:3px 0}
.soli-prevrow.tax{color:var(--clay-d)}
.soli-prevrow.main{font-family:'Fraunces',serif;font-size:19px;font-weight:600;color:var(--ink);border-top:1px solid rgba(0,0,0,.08);margin-top:6px;padding-top:9px}
.soli-prevrow.main span:last-child{color:var(--profit)}
.soli-prevrow.sub{font-size:12px;justify-content:flex-end;padding-top:2px}

.soli-plancard{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin:6px 0 16px}
.soli-planrow{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;color:var(--ink2);padding:5px 0}
.soli-planrow b{font-family:'Fraunces',serif;color:var(--ink);font-size:16px}
.soli-planrow.sub{font-size:12.5px}
.soli-planrow.main{border-top:1px solid var(--line);margin-top:7px;padding-top:11px;font-size:15px;color:var(--ink)}
.soli-planrow.main b{font-size:21px;color:var(--clay-d)}
.soli-plangoal{background:linear-gradient(150deg,#EDF0E2,#E3E8D2);border:1px solid #D3DBBC;border-radius:14px;padding:16px 18px;font-size:15px;line-height:1.5}
.soli-plangoal b{font-family:'Fraunces',serif;color:var(--sage-d)}
.soli-plannote{display:block;font-size:11.5px;color:var(--ink2);margin-top:5px}
.soli-flip{margin-top:18px;background:var(--surface2);border:1px dashed var(--line);border-radius:16px;padding:18px}
.soli-flriphead{font-family:'Fraunces',serif;font-weight:600;font-size:15px;margin-bottom:12px}
.soli-flipresult{font-size:14.5px;line-height:1.5}
.soli-flipresult b{font-family:'Fraunces',serif;font-size:18px;color:var(--clay-d)}

.soli-clientlist{display:flex;flex-direction:column;gap:11px}
.soli-clientcard{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:16px 18px;cursor:pointer;transition:.15s}
.soli-clientcard:hover{border-color:var(--clay)}
.soli-clienttop{display:flex;justify-content:space-between;align-items:center}
.soli-clientname{font-family:'Fraunces',serif;font-size:17px;font-weight:600}
.soli-clientmeta{font-size:12.5px;color:var(--ink2)}
.soli-clientprofit{font-family:'Fraunces',serif;font-size:19px;font-weight:600;color:var(--profit);text-align:right;display:flex;flex-direction:column}
.soli-clientprofit small{font-size:10.5px;color:var(--ink2);font-family:'Hanken Grotesk';font-weight:400}
.soli-clientdetail{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.soli-clientnotes{font-size:13.5px;color:var(--ink2);margin:0 0 8px}
.soli-history{display:flex;flex-direction:column;gap:6px;margin:10px 0}
.soli-histrow{display:flex;justify-content:space-between;font-size:13px;color:var(--ink2)}
.soli-histrow em{font-style:normal;opacity:.7}
.soli-histprofit{color:var(--profit);font-weight:600}
.soli-del{display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid #E8C4B0;color:var(--clay-d);font-family:inherit;font-size:12.5px;padding:7px 12px;border-radius:9px;cursor:pointer;margin-top:8px}
.soli-del.big{margin-top:24px;width:100%;justify-content:center;padding:12px}
.soli-editactions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;align-items:center}
.soli-editactions .soli-cta{width:auto;margin-top:0}
.soli-editactions .soli-del{margin-top:0}
.soli-editbtn{display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid var(--line);color:var(--ink2);font-family:inherit;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:9px;cursor:pointer;transition:.15s}
.soli-editbtn:hover{border-color:var(--clay);color:var(--ink)}

.soli-invtable{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:8px 12px;margin-bottom:20px;overflow-x:auto}
.soli-invhead,.soli-invrow{display:grid;grid-template-columns:1.6fr .9fr .9fr .8fr 1fr 1.1fr 34px;gap:8px;align-items:center;min-width:640px}
/* Seven columns cannot work on a phone. Each product becomes a card: name on
   its own line, then the numbers two-up, with labels so the fields stay clear. */
@media(max-width:720px){
  .soli-invtable{overflow-x:visible;padding:8px}
  .soli-invhead{display:none}
  .soli-invrow{grid-template-columns:1fr 1fr;min-width:0;gap:8px;padding:14px 4px;border-bottom:1px solid var(--line)}
  .soli-invrow:last-child{border-bottom:none}
  .soli-invrow > *:nth-child(1){grid-column:1 / -1}
  .soli-invrow > .soli-iconbtn{grid-column:1 / -1;justify-content:flex-start;margin-top:2px}
  .soli-invcell{display:flex;flex-direction:column;gap:4px}
  .soli-invcell > span{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--ink2)}
}
.soli-import{margin-bottom:20px}
.soli-importtoggle{width:100%;border:1px dashed var(--line);background:var(--surface2);color:var(--clay-d);font-family:inherit;font-size:13.5px;font-weight:600;padding:11px;border-radius:11px;cursor:pointer;transition:.15s}
.soli-importtoggle:hover{border-color:var(--clay)}
.soli-importta{width:100%;font-family:'SFMono-Regular',ui-monospace,Menlo,monospace;font-size:13px;color:var(--ink);background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:11px;margin-bottom:12px;outline:none;resize:vertical}
.soli-importta:focus{border-color:var(--clay)}
.soli-themebtn{padding:8px 11px}
.soli-trade{margin-bottom:20px;background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:16px}
.soli-tradelabel{font-size:13.5px;font-weight:600;margin-bottom:11px}
.soli-traderow{display:flex;flex-wrap:wrap;gap:8px}
.soli-tradebtn{font-family:inherit;font-size:13.5px;font-weight:600;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:20px;padding:9px 16px;cursor:pointer;transition:.15s}
.soli-tradebtn:hover{border-color:var(--clay);background:#F6E5DA}

/* ---- dark mode ---- */
[data-theme="dark"] .soli-root{
  --bg:#181410;--surface:#241f19;--surface2:#2d2720;--ink:#F2E9DB;--ink2:#b4a68f;--line:#3a332b;
  --clay:#cb7d5b;--clay-d:#e29a75;--sage:#8b996f;--sage-d:#a2b081;--profit:#a4b77f;--cost:#cf9a7d;--gold:#d8b45f;
  background-image:radial-gradient(circle at 12% 0%,rgba(216,180,95,.07),transparent 42%),radial-gradient(circle at 90% 8%,rgba(203,125,91,.06),transparent 40%)}
[data-theme="dark"] .soli-header{background:rgba(24,20,16,.85)}
[data-theme="dark"] .soli-navbtn.active{color:#181410}
[data-theme="dark"] .soli-segbtn.on{color:#181410}
[data-theme="dark"] .soli-watch{background:linear-gradient(160deg,#2e241d,#291f19);border-color:#453529}
[data-theme="dark"] .soli-watchrow{border-top-color:#3f3025}
[data-theme="dark"] .soli-pill.late{background:#4a2f24;color:#eab199}
[data-theme="dark"] .soli-pill.soon{background:#333a29;color:#c4d0a1}
[data-theme="dark"] .soli-preview.good{background:#252f1e;border-color:#3d4b2d}
[data-theme="dark"] .soli-preview.bad{background:#3a271e;border-color:#5a3a2b}
[data-theme="dark"] .soli-preview.main{border-top-color:rgba(255,255,255,.12)}
[data-theme="dark"] .soli-srcnote{background:#33241c;color:#e29a75}
[data-theme="dark"] .soli-plangoal{background:linear-gradient(150deg,#252f1e,#212a1b);border-color:#3d4b2d}
[data-theme="dark"] .soli-tradebtn:hover{background:#33241c}
[data-theme="dark"] .soli-del{border-color:#5a3a2b}
.soli-invhead{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);padding:8px 4px;border-bottom:1px solid var(--line)}
.soli-invrow{padding:6px 0}
.soli-iconbtn{background:none;border:none;cursor:pointer;color:var(--ink2);display:flex;justify-content:center}
.soli-iconbtn:hover{color:var(--clay-d)}
.soli-addbox{background:var(--surface2);border:1px dashed var(--line);border-radius:15px;padding:18px}
.soli-addhead{font-weight:600;font-size:14px;margin-bottom:12px}
.soli-help{font-size:12px;color:var(--ink2);margin-top:8px}
.soli-linkbtn{background:none;border:none;padding:0;cursor:pointer;font-family:inherit;font-size:inherit;font-weight:600;color:var(--clay-d)}
.soli-linkbtn:hover{text-decoration:underline}
.soli-promo{display:flex;gap:8px;align-items:stretch}
.soli-promo .soli-input{margin:0}
.soli-promo .soli-ghost{width:auto;white-space:nowrap;padding:12px 18px}
.soli-weektable{overflow-x:auto}
.soli-weekhead,.soli-weekrow{display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr .9fr;gap:8px;align-items:center;min-width:440px}
/* On a phone the five columns cannot fit without sideways scrolling, which is
   fiddly to read. Each week becomes a small card instead, with the column name
   shown beside its figure so nothing loses meaning. */
@media(max-width:620px){
  .soli-weektable{overflow-x:visible}
  .soli-weekhead{display:none}
  .soli-weekrow{grid-template-columns:1fr 1fr;min-width:0;gap:6px 12px;padding:14px 2px}
  .soli-weekname{grid-column:1 / -1;margin-bottom:2px}
  .soli-weekrow > span[data-label]{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13.5px}
  .soli-weekrow > span[data-label]::before{content:attr(data-label);color:var(--ink2);font-size:11.5px;text-transform:uppercase;letter-spacing:.4px}
}
.soli-weekhead{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);padding:8px 4px;border-bottom:1px solid var(--line)}
.soli-weekrow{padding:11px 4px;border-bottom:1px solid var(--line);font-size:14px}
.soli-weekrow:last-child{border-bottom:none}
.soli-weekname{display:flex;flex-direction:column;font-weight:500}
.soli-weekname small{font-weight:400;color:var(--ink2);font-size:11.5px}
.soli-weekcost{color:var(--cost)}
.soli-weekkept{font-family:'Fraunces',serif;font-weight:600;color:var(--profit)}
.soli-bucketrow{display:grid;grid-template-columns:1fr 92px 34px;gap:8px;align-items:center;margin-bottom:8px}
.soli-bucketpct{display:flex;align-items:center;gap:5px}
.soli-bucketpct .soli-input{margin:0}
.soli-bucketpct span{color:var(--ink2);font-size:13px}
.soli-bucketadd{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.soli-recentrow{border-top:1px solid var(--line)}
.soli-recentrow:first-of-type{border-top:none}
.soli-recentbtn{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;padding:12px 2px;color:var(--ink)}
.soli-recentbtn:hover{background:var(--surface2)}
.soli-recentmain{display:flex;flex-direction:column;gap:2px;min-width:0}
.soli-recentsvc{font-size:14.5px;font-weight:600}
.soli-recentmeta{font-size:12px;color:var(--ink2)}
.soli-recentamt{display:flex;flex-direction:column;align-items:flex-end;font-family:'Fraunces',serif;font-size:15px;font-weight:600;white-space:nowrap}
.soli-recentamt small{font-family:'Hanken Grotesk',sans-serif;font-size:11px;font-weight:400;color:var(--profit)}
.soli-recentedit{padding:14px 0}
.soli-batch{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:20px}
.soli-batchhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:2px}
.soli-batchhead b{font-family:'Fraunces',serif;font-size:17px;font-weight:600}
.soli-batchrow{display:flex;align-items:flex-start;gap:9px;padding:11px 0;border-top:1px solid var(--line)}
.soli-batchnum{flex:none;width:22px;height:22px;border-radius:50%;background:var(--surface2);border:1px solid var(--line);color:var(--ink2);font-size:11.5px;font-weight:600;display:flex;align-items:center;justify-content:center;margin-top:5px}
.soli-batchfields{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:7px;min-width:0}
@media(max-width:560px){.soli-batchfields{grid-template-columns:repeat(2,1fr)}}
.soli-install{display:flex;align-items:center;gap:12px;background:var(--surface2);border:1px solid var(--line);border-radius:13px;padding:12px 14px;margin-bottom:20px}
.soli-installtext{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.soli-installtext b{font-size:13.5px}
.soli-installtext span{font-size:12.5px;color:var(--ink2)}
.soli-installbtn{flex:none;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:var(--clay);color:#fff;padding:9px 16px;border-radius:10px}
.soli-installbtn:hover{background:var(--clay-d)}
.soli-installx{flex:none;background:none;border:none;cursor:pointer;font-size:20px;line-height:1;color:var(--ink2);padding:0 2px}
.soli-installx:hover{color:var(--ink)}
.soli-taxgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.soli-taxgrid>div{background:var(--surface2);border:1px solid var(--line);border-radius:11px;padding:11px 13px;display:flex;flex-direction:column;gap:3px}
.soli-taxgrid span{font-size:11.5px;color:var(--ink2)}
.soli-taxgrid b{font-family:'Fraunces',serif;font-size:17px;font-weight:600}
.soli-taxgrid b.cost{color:var(--cost)}
.soli-taxgrid b.profit{color:var(--profit)}
.soli-reflink{background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:11px 13px;font-size:13px;color:var(--ink);word-break:break-all;margin-bottom:10px;font-family:'SFMono-Regular',ui-monospace,Menlo,monospace}
.soli-refactions{display:flex;gap:10px;flex-wrap:wrap}
.soli-refactions .soli-cta{width:auto;margin-top:0}
.soli-refactions .soli-ghost{width:auto}
.soli-sharebtn{display:inline-flex;align-items:center;gap:8px;margin-bottom:20px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--clay-d);background:var(--surface);border:1px solid var(--line);padding:10px 16px;border-radius:11px;transition:.15s}
.soli-sharebtn:hover{border-color:var(--clay);background:#F6E5DA}
[data-theme="dark"] .soli-sharebtn:hover{background:#33241c}
/* Portaled to body, so it sits outside .soli-root and must carry the palette
   and font itself rather than inheriting them. */
.soli-sheet{--bg:#F6EFE4;--surface:#FFFDF9;--surface2:#FBF5EB;--ink:#2B2118;--ink2:#6E5E4C;--line:#E7DBC8;
  --clay:#BC6B4C;--clay-d:#A4583B;--sage:#6E7A56;--sage-d:#5A6646;--profit:#5E7142;--cost:#9A6A54;--gold:#C9A24B;
  font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--ink);line-height:1.45;
  position:fixed;inset:0;z-index:60;background:rgba(30,22,16,.55);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
[data-theme="dark"] .soli-sheet{--bg:#181410;--surface:#241f19;--surface2:#2d2720;--ink:#F2E9DB;--ink2:#b4a68f;--line:#3a332b;
  --clay:#cb7d5b;--clay-d:#e29a75;--sage:#8b996f;--sage-d:#a2b081;--profit:#a4b77f;--cost:#cf9a7d;--gold:#d8b45f}
.soli-sheet *{box-sizing:border-box}
.soli-sheetbox{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:22px;max-height:92vh;overflow-y:auto}
.soli-sheethead{display:flex;align-items:center;justify-content:space-between;gap:12px}
.soli-sheethead h2{font-family:'Fraunces',serif;font-size:20px;font-weight:600;margin:0}
.soli-sheetx{background:none;border:none;cursor:pointer;font-size:26px;line-height:1;color:var(--ink2);padding:0 4px}
.soli-sheetx:hover{color:var(--ink)}
.soli-sharepreview{display:block;width:100%;max-width:230px;margin:14px auto 0;border-radius:12px;border:1px solid var(--line)}
.soli-toggle{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:13.5px;color:var(--ink2);line-height:1.45}
.soli-toggle input{width:18px;height:18px;flex:none;margin-top:1px;accent-color:var(--clay);cursor:pointer}
.soli-appfoot{max-width:920px;margin:0 auto;padding:20px 22px 40px;text-align:center;font-size:13px;color:var(--ink2)}
.soli-appfoot a{color:var(--clay-d);font-weight:600;text-decoration:none}
.soli-appfoot a:hover{text-decoration:underline}

.soli-empty{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:42px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.soli-emptymark{width:60px;height:60px;border-radius:50%;background:var(--clay);color:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:6px;box-shadow:0 6px 16px rgba(188,107,76,.3)}
.soli-empty h2{font-family:'Fraunces',serif;font-size:22px;font-weight:600;margin:0}
.soli-empty p{color:var(--ink2);font-size:14px;margin:0 0 10px;max-width:400px;line-height:1.5}
.soli-empty .soli-cta{max-width:320px}
.soli-emptyhint{margin-top:16px;font-size:12.5px;color:var(--ink2);text-align:center;line-height:1.5}

.soli-datatools{margin-top:26px;padding-top:20px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px}
.soli-sliprow{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-top:1px solid #EDD8C8}
.soli-sliprow:first-of-type{border-top:none}
[data-theme="dark"] .soli-sliprow{border-top-color:#3f3025}
.soli-sliptag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#fff;background:var(--clay);padding:2px 7px;border-radius:20px;vertical-align:middle;margin-left:6px}
.soli-dueskip{font-size:12px;color:var(--ink2)}
.soli-stockbtn{font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:8px 6px;cursor:pointer;transition:.15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.soli-stockbtn:hover{border-color:var(--clay)}
.soli-stockbtn.low{background:#F6E5DA;border-color:#E8C4B0;color:var(--clay-d)}
[data-theme="dark"] .soli-stockbtn.low{background:#3a271e;border-color:#5a3a2b;color:#e29a75}
.soli-mapgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
.soli-mapgrid > *{min-width:0}
.soli-mapitem{display:flex;flex-direction:column;gap:5px;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ink2)}
.soli-mapitem .soli-input{margin:0}
.soli-importwarn{background:#F6E5DA;border:1px solid #E8C4B0;color:var(--clay-d);border-radius:12px;padding:12px 14px;margin:12px 0;font-size:13px;line-height:1.5}
[data-theme="dark"] .soli-importwarn{background:#3a271e;border-color:#5a3a2b;color:#e8b79c}
.soli-importwarn .soli-tradebtn.on{background:var(--clay);color:#fff;border-color:var(--clay)}
.soli-imptable{max-height:340px;overflow-y:auto;overflow-x:auto;border:1px solid var(--line);border-radius:12px;padding:8px}
.soli-improw{display:grid;grid-template-columns:24px 130px 1.2fr 1.4fr 80px 70px 110px;gap:8px;align-items:center;padding:5px 2px;min-width:700px}
.soli-improw > *{min-width:0}
.soli-improw .soli-input{margin:0}
.soli-improw.dupe{opacity:.5}
.soli-improw.bad{background:#F6E5DA;border-radius:8px}
[data-theme="dark"] .soli-improw.bad{background:#3a271e}
.soli-impnote{font-size:11px;color:var(--clay-d);white-space:nowrap}
@media(max-width:720px){
  /* The review table cannot shrink to a phone without becoming unreadable, so
     it scrolls sideways inside its own box rather than stretching the page. */
  .soli-imptable{max-height:420px}
}
.soli-exprow{display:grid;grid-template-columns:150px 1.2fr 1.4fr 130px;gap:10px;margin-bottom:10px}
@media(max-width:640px){.soli-exprow{grid-template-columns:1fr 1fr}}
.soli-exprow .soli-input{margin:0}
.soli-exphead,.soli-exprowline{display:grid;grid-template-columns:96px 1.3fr 1.4fr 110px 150px;gap:8px;align-items:center;min-width:600px}
.soli-exphead{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);padding:8px 4px;border-bottom:1px solid var(--line)}
.soli-exprowline{padding:9px 4px;border-bottom:1px solid var(--line);font-size:13.5px}
.soli-exprowline:last-child{border-bottom:none}
.soli-expdate{color:var(--ink2);font-size:12.5px}
.soli-expnote{color:var(--ink2)}
.soli-expamt{font-family:'Fraunces',serif;font-weight:600;color:var(--cost)}
.soli-expactions{display:flex;align-items:center;gap:10px;justify-content:flex-end}
/* Phone tab bar. Hidden on wider screens, where the header nav fits fine. */
.soli-tabbar{display:none}
.soli-sheet-bottom{align-items:flex-end;padding:0}
.soli-moresheet{width:100%;background:var(--surface);border-top:1px solid var(--line);border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));max-height:80vh;overflow-y:auto}
.soli-morelist{display:flex;flex-direction:column;gap:2px;margin-top:6px}
.soli-moreitem{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;color:var(--ink);padding:13px 8px;border-radius:11px}
.soli-moreitem:hover{background:var(--surface2)}
.soli-moreitem.active{background:var(--ink);color:var(--bg)}
.soli-moreitem.danger{color:var(--clay-d)}
@media(max-width:760px){
  .soli-nav{display:none}
  .soli-header{padding:12px 18px}
  .soli-main{padding-bottom:96px}
  .soli-tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;
    background:rgba(255,253,249,.94);backdrop-filter:blur(10px);border-top:1px solid var(--line);
    padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .soli-tabbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
    background:none;border:none;cursor:pointer;font-family:inherit;font-size:10.5px;font-weight:600;
    color:var(--ink2);padding:7px 2px;border-radius:11px}
  .soli-tabbtn.active{color:var(--clay-d)}
  .soli-tabbtn.primary{color:#fff;background:var(--clay);margin:0 4px;box-shadow:0 4px 12px rgba(188,107,76,.3)}
  .soli-tabbtn.primary.active{color:#fff;background:var(--clay-d)}
}
[data-theme="dark"] .soli-tabbar{background:rgba(24,20,16,.94)}

.soli-another{margin-top:12px;background:var(--surface2);border:1px dashed var(--line);border-radius:12px;padding:13px 15px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--ink2)}
.soli-another button{border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:9px;white-space:nowrap}
.soli-another button:hover{background:#000}
[data-theme="dark"] .soli-another button:hover{background:#F2E9DB}
.soli-simbox{margin-top:22px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px}
.soli-simrows{display:flex;flex-direction:column;gap:10px;margin:14px 0}
.soli-simrow{display:grid;grid-template-columns:1fr 148px 96px;gap:10px;align-items:center}
@media(max-width:560px){.soli-simrow{grid-template-columns:1fr 132px;grid-template-areas:"name ctrl" "delta delta";row-gap:4px}
  .soli-simname{grid-area:name}.soli-simctrl{grid-area:ctrl}.soli-simdelta{grid-area:delta;text-align:left}}
.soli-simname{font-size:14px;font-weight:500;display:flex;flex-direction:column;min-width:0}
.soli-simname small{font-weight:400;color:var(--ink2);font-size:11.5px}
.soli-simctrl{display:flex;align-items:center;gap:6px}
.soli-simctrl .soli-input{margin:0;width:78px}
.soli-simbump{border:1px solid var(--line);background:var(--surface2);color:var(--ink2);font-family:inherit;font-size:11.5px;font-weight:600;padding:7px 8px;border-radius:8px;cursor:pointer;white-space:nowrap}
.soli-simbump:hover{border-color:var(--clay);color:var(--clay-d)}
.soli-simdelta{font-size:12.5px;font-weight:600;text-align:right;color:var(--ink2)}
.soli-simdelta.up{color:var(--sage-d)}
.soli-simdelta.down{color:var(--clay-d)}
.soli-simtotal{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.soli-simtotal.on{background:linear-gradient(150deg,#EDF0E2,#E3E8D2);border-color:#D3DBBC}
[data-theme="dark"] .soli-simtotal.on{background:linear-gradient(150deg,#252f1e,#212a1b);border-color:#3d4b2d}
.soli-simtotalrow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:13.5px;color:var(--ink2);padding:3px 0}
.soli-simtotalrow b{font-family:'Fraunces',serif;font-size:16px;color:var(--ink)}
.soli-simtotalrow.main{border-top:1px solid rgba(0,0,0,.10);margin-top:6px;padding-top:9px;font-size:14.5px;color:var(--ink)}
[data-theme="dark"] .soli-simtotalrow.main{border-top-color:rgba(255,255,255,.12)}
.soli-simtotalrow.main b{font-size:21px}
.soli-simtotalrow b.up{color:var(--profit)}
.soli-simtotalrow b.down{color:var(--clay-d)}
.soli-simnote{font-size:12px;color:var(--ink2);line-height:1.5;margin:12px 0 10px}
.soli-onboard{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:20px}
.soli-onboardtop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.soli-onboardtitle{font-family:'Fraunces',serif;font-size:17px;font-weight:600}
.soli-onboardcount{font-size:12.5px;color:var(--ink2);margin-top:1px}
.soli-onboardtrack{height:6px;background:var(--surface2);border-radius:4px;overflow:hidden;margin:11px 0 14px}
.soli-onboardfill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--sage),var(--sage-d));transition:width .5s cubic-bezier(.2,.8,.2,1)}
.soli-onboardlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.soli-onboardstep{display:flex;align-items:flex-start;gap:11px}
.soli-onboardmark{flex:none;width:21px;height:21px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;margin-top:1px}
.soli-onboardstep.done .soli-onboardmark{background:var(--sage-d);border-color:var(--sage-d)}
.soli-onboardstep.next .soli-onboardmark{border-color:var(--clay)}
.soli-onboardbody{flex:1;min-width:0}
.soli-onboardname{font-size:14px;font-weight:500}
.soli-onboardstep.done .soli-onboardname{color:var(--ink2);text-decoration:line-through}
.soli-onboardwhy{font-size:12.5px;color:var(--ink2);margin-top:3px;line-height:1.45}
.soli-onboardcta{flex:none;border:none;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;background:var(--clay);color:#fff;padding:8px 13px;border-radius:9px;white-space:nowrap;transition:.15s}
.soli-onboardcta:hover{background:var(--clay-d)}
.soli-goal{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:20px}
.soli-goal.met{border-color:#D3DBBC;background:linear-gradient(150deg,#EDF0E2,#E6EBD8)}
[data-theme="dark"] .soli-goal.met{background:linear-gradient(150deg,#252f1e,#212a1b);border-color:#3d4b2d}
.soli-goaltop{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.soli-goallabel{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2)}
.soli-goaledit{display:flex;align-items:center;gap:8px}
.soli-goaledit .soli-input{margin:0;width:120px;padding:7px 10px;font-size:14px}
.soli-goaledit .soli-cta{width:auto;margin:0;padding:8px 14px;box-shadow:none}
.soli-goalnums{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.soli-goalval{font-family:'Fraunces',serif;font-size:28px;font-weight:600;line-height:1.1}
.soli-goalpct{font-family:'Fraunces',serif;font-size:17px;font-weight:600;color:var(--sage-d)}
.soli-goaltrack{height:10px;background:var(--surface2);border-radius:6px;overflow:hidden;margin:10px 0 9px}
.soli-goalfill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--sage),var(--sage-d));transition:width .7s cubic-bezier(.2,.8,.2,1)}
.soli-goal.met .soli-goalfill{background:linear-gradient(90deg,var(--gold),#A9863A)}
.soli-goalfoot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12.5px;color:var(--ink2)}
.soli-goalmet{font-weight:600;color:var(--sage-d)}
.soli-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
@media(max-width:420px){.soli-plans{grid-template-columns:1fr}}
.soli-planopt{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;cursor:pointer;font-family:inherit;text-align:left;background:var(--surface);color:var(--ink);border:1.5px solid var(--line);border-radius:14px;padding:14px 15px;transition:.15s}
.soli-planopt:hover{border-color:var(--clay);background:#F6E5DA}
[data-theme="dark"] .soli-planopt:hover{background:#33241c}
.soli-planopt.best{border-color:var(--clay);background:#F6E5DA}
[data-theme="dark"] .soli-planopt.best{background:#33241c}
.soli-planopt:disabled{opacity:.55;cursor:not-allowed}
.soli-planname{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--ink2)}
.soli-planbadge2{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:var(--clay);color:#fff;padding:2px 7px;border-radius:20px}
.soli-planprice{font-family:'Fraunces',serif;font-size:24px;font-weight:600;line-height:1.15}
.soli-planprice small{font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:12.5px;font-weight:500;color:var(--ink2);margin-left:2px}
.soli-planfoot{font-size:11.5px;color:var(--ink2)}
.soli-danger{margin-top:26px;background:#FBEFE9;border:1px solid #E8C4B0;border-radius:14px;padding:16px 18px}
.soli-danger .soli-datahead{color:var(--clay-d)}
.soli-danger .soli-del{width:100%;justify-content:center;padding:12px;margin-top:8px}
.soli-danger .soli-del:disabled{opacity:.45;cursor:not-allowed}
[data-theme="dark"] .soli-danger{background:#2e211b;border-color:#5a3a2b}
.soli-datahead{font-weight:600;font-size:14px;margin-bottom:2px}
/* Sub-blocks let one section hold several related jobs without each one
   looking like a separate feature competing for attention. */
.soli-subblock{padding-top:16px;margin-top:16px;border-top:1px solid var(--line)}
.soli-subblock:first-of-type{padding-top:4px;margin-top:4px;border-top:none}
.soli-subhead{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);margin-bottom:8px}
.soli-ghost{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink2);font-family:inherit;font-size:14px;font-weight:600;padding:12px;border-radius:11px;cursor:pointer;transition:.15s}
.soli-ghost:hover{border-color:var(--clay);color:var(--ink)}
.soli-datatools .soli-del{width:100%;justify-content:center;padding:12px;margin-top:0}
.soli-tplsave{margin-top:10px}
.soli-tpl{margin-bottom:20px}
.soli-tpllabel{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);margin-bottom:9px}
.soli-tplrow{display:flex;flex-wrap:wrap;gap:8px}
.soli-tplchip{display:inline-flex;align-items:stretch;border:1px solid var(--line);background:var(--surface2);border-radius:20px;overflow:hidden}
.soli-tplchip:hover{border-color:var(--clay)}
.soli-tplapply{border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);padding:8px 6px 8px 14px}
.soli-tplx{border:none;background:none;cursor:pointer;color:var(--ink2);font-size:16px;line-height:1;padding:0 11px 0 4px}
.soli-tplx:hover{color:var(--clay-d)}
.soli-voice{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.soli-voicebtn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;background:var(--surface);color:var(--ink);border:1px solid var(--line);padding:10px 16px;border-radius:11px;transition:.15s}
.soli-voicebtn:hover{border-color:var(--clay)}
.soli-voicebtn.on{background:var(--clay);color:#fff;border-color:var(--clay)}
.soli-voicebtn:disabled{cursor:default}
.soli-voicedot{width:9px;height:9px;border-radius:50%;background:var(--clay);display:none}
.soli-voicebtn.on .soli-voicedot{display:inline-block;background:#fff;animation:voicepulse 1s ease-in-out infinite}
@keyframes voicepulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
.soli-voicemsg{font-size:12.5px;color:var(--ink2)}

.soli-trialbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(150deg,#C9A24B,#A9863A);color:#fff;border-radius:14px;padding:12px 16px;margin-bottom:20px;font-size:13.5px;font-weight:500}
.soli-trialbar span{display:inline-flex;align-items:center;gap:7px}
.soli-trialbar button{border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;background:#fff;color:var(--clay-d);padding:8px 14px;border-radius:9px;transition:.15s}
.soli-trialbar button:hover{background:#FFF4E9}
.soli-trialbar button:disabled{opacity:.6;cursor:not-allowed}
.soli-trialbar.grace{background:linear-gradient(150deg,#BC6B4C,#A4583B)}
.soli-trialbar.grace button{color:var(--clay-d)}

.soli-billing{background:var(--surface2);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:22px}
.soli-planline{display:flex;align-items:center;gap:10px;font-size:14.5px;font-weight:600;margin-bottom:4px}
.soli-planbadge{font-size:11.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:4px 10px;border-radius:20px;background:#E4E8D6;color:var(--sage-d)}
.soli-planbadge.on{background:var(--profit);color:#fff}
.soli-billing .soli-cta,.soli-billing .soli-ghost{margin-top:10px}

.soli-paywall{max-width:440px;text-align:center;padding:28px 26px;display:flex;flex-direction:column;align-items:center;gap:6px}
.soli-paywall .soli-logomark{margin-bottom:10px}
.soli-paywall h1{font-family:'Fraunces',serif;font-size:27px;font-weight:600;margin:0 0 4px;letter-spacing:-.5px}
.soli-paywall p{color:var(--ink2);font-size:14.5px;margin:0 0 6px;line-height:1.5}
.soli-payprice{font-family:'Fraunces',serif;font-size:20px;color:var(--ink);margin:8px 0 6px}
.soli-payprice b{font-size:32px;color:var(--clay-d)}
.soli-paywall .soli-cta{max-width:320px}
.soli-paynote{font-size:12.5px;color:var(--ink2);margin-top:10px}
`}</style>);
}
