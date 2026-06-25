"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, PlusCircle, Users, Package, Settings as SettingsIcon,
  Calculator, TrendingUp, AlertTriangle, Bell, Trash2, Sun, PiggyBank, Wallet, Banknote
} from "lucide-react";

/* ----------------------------- storage layer ----------------------------- */
/* Persists to localStorage in the browser; falls back to in-memory on the
   server (during SSR) so first render is safe. */
const mem = {};
const store = {
  async get(key, fb) {
    try {
      if (typeof window === "undefined") return key in mem ? mem[key] : fb;
      const r = window.localStorage.getItem(key);
      return r != null ? JSON.parse(r) : fb;
    } catch { return fb; }
  },
  async set(key, v) {
    try {
      if (typeof window === "undefined") { mem[key] = v; return; }
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch (e) { console.error(e); }
  },
};

/* ------------------------------- helpers --------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const money = (n) => "$" + (Math.round(n)).toLocaleString();
const money2 = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  return { booth, profit, perHour: profit / (log.durationMin / 60), margin: profit / log.price };
}

/* ----------------------------- defaults ---------------------------------- */
/* Sensible starting values for the editable config/calculator inputs. These
   are NOT sample data. Clients, products and logged services all start empty
   so each user works entirely from their own real numbers. */
const DEFAULT_SETTINGS = { boothRentHourly: 12, taxRate: 30 };
const DEFAULT_PLAN = { goal: 3000, monthlyRent: 1400, avgPrice: 90, capacity: 18 };

/* ================================ APP ==================================== */
export default function Soli() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dash");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [plan, setPlan] = useState(DEFAULT_PLAN);

  useEffect(() => {
    (async () => {
      const inited = await store.get("soli:init3", false);
      let s = DEFAULT_SETTINGS, c = [], pr = [], lg = [], pl = DEFAULT_PLAN;
      if (!inited) {
        // First run: start with a clean, empty slate so every user enters
        // their own real numbers rather than inheriting sample data.
        await store.set("soli:settings", DEFAULT_SETTINGS);
        await store.set("soli:clients", []);
        await store.set("soli:products", []);
        await store.set("soli:logs", []);
        await store.set("soli:plan", DEFAULT_PLAN);
        await store.set("soli:init3", true);
      } else {
        s = await store.get("soli:settings", DEFAULT_SETTINGS);
        c = await store.get("soli:clients", []);
        pr = await store.get("soli:products", []);
        lg = await store.get("soli:logs", []);
        pl = await store.get("soli:plan", DEFAULT_PLAN);
      }

      // "Try it with sample data" deep-link from the landing page (/app?demo=1).
      // Seeds at most once, ever, and only when there's no data yet, so it can
      // never overwrite real work, even if the link is revisited or reloaded.
      const wantsDemo = typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("demo") === "1";
      const demoSeeded = await store.get("soli:demoSeeded", false);
      if (wantsDemo && lg.length === 0 && !demoSeeded) {
        const seed = buildSeed();
        s = seed.settings; c = seed.clients; pr = seed.products; lg = seed.logs; pl = seed.plan;
        await store.set("soli:settings", s); await store.set("soli:clients", c);
        await store.set("soli:products", pr); await store.set("soli:logs", lg);
        await store.set("soli:plan", pl);
        await store.set("soli:demoSeeded", true);
      }

      setSettings(s); setClients(c); setProducts(pr); setLogs(lg); setPlan(pl);
      if (wantsDemo && typeof window !== "undefined") {
        window.history.replaceState({}, "", "/app");
      }
      setLoading(false);
    })();
  }, []);

  const saveLogs = (v) => { setLogs(v); store.set("soli:logs", v); };
  const saveClients = (v) => { setClients(v); store.set("soli:clients", v); };
  const saveProducts = (v) => { setProducts(v); store.set("soli:products", v); };
  const saveSettings = (v) => { setSettings(v); store.set("soli:settings", v); };
  const savePlan = (v) => { setPlan(v); store.set("soli:plan", v); };

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

  const rent = settings.boothRentHourly;
  const taxRate = settings.taxRate;

  const nav = [
    { id: "dash", label: "Dashboard", Icon: LayoutDashboard },
    { id: "log", label: "Log service", Icon: PlusCircle },
    { id: "plan", label: "What to charge", Icon: Calculator },
    { id: "clients", label: "Clients", Icon: Users },
    { id: "inv", label: "Inventory", Icon: Package },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  if (loading) return (
    <div className="soli-root soli-center"><Styles /><div className="soli-loadmark"><Sun size={26} strokeWidth={1.6} /></div></div>
  );

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
        </nav>
      </header>

      <main className="soli-main">
        {tab === "dash" && <Dashboard logs={logs} clients={clients} rent={rent} taxRate={taxRate} setTab={setTab} />}
        {tab === "log" && <LogService clients={clients} products={products} saveClients={saveClients}
          logs={logs} saveLogs={saveLogs} rent={rent} taxRate={taxRate} />}
        {tab === "plan" && <Planner plan={plan} savePlan={savePlan} taxRate={taxRate} />}
        {tab === "clients" && <ClientsView clients={clients} logs={logs} saveClients={saveClients} rent={rent} />}
        {tab === "inv" && <Inventory products={products} saveProducts={saveProducts} />}
        {tab === "settings" && <SettingsView settings={settings} saveSettings={saveSettings} loadSample={loadSample} clearAll={clearAll} />}
      </main>
    </div>
  );
}

/* ------------------------------ DASHBOARD -------------------------------- */
function Dashboard({ logs, clients, rent, taxRate, setTab }) {
  const month = logs.filter(l => new Date(l.date) >= new Date(Date.now() - 30 * 864e5));
  const t = taxRate / 100;
  const totals = month.reduce((a, l) => {
    const { booth, profit } = profitOf(l, rent);
    a.rev += l.price; a.prod += l.productCost; a.booth += booth; a.profit += profit; return a;
  }, { rev: 0, prod: 0, booth: 0, profit: 0 });
  const setAside = totals.profit * t;
  const takeHome = totals.profit - setAside;

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
    return Object.values(m).map(s => ({ ...s, perHour: s.profit / s.hours, avg: s.profit / s.count }))
      .sort((a, b) => b.perHour - a.perHour);
  }, [month, rent]);
  const maxPH = Math.max(...byService.map(s => s.perHour), 1);
  const watch = byService.filter(s => s.perHour < rent * 2.5);

  const due = clients.map(c => {
    const dueDate = new Date(new Date(c.lastVisit).getTime() + c.rebookWeeks * 7 * 864e5);
    return { ...c, overdue: Math.round((Date.now() - dueDate) / 864e5) };
  }).filter(c => c.overdue >= -3).sort((a, b) => b.overdue - a.overdue);

  if (logs.length === 0) {
    return (
      <div className="soli-page">
        <h1 className="soli-h1">Welcome to Soli</h1>
        <p className="soli-sub">Your numbers will appear here as soon as you start logging your own work.</p>
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
      <h1 className="soli-h1">Last 30 days</h1>
      <p className="soli-sub">{month.length} services · booth {money2(rent)}/hr · taxes set at {taxRate}%</p>

      {/* take-home hero */}
      <div className="soli-hero">
        <div className="soli-heroblock">
          <span className="soli-herolabel"><Wallet size={14} /> Your real take-home</span>
          <span className="soli-heroval">{money2(takeHome)}</span>
          <span className="soli-herosub">after product, booth rent & taxes</span>
        </div>
        <div className="soli-herojar">
          <span className="soli-jarlabel"><PiggyBank size={14} /> Tax jar</span>
          <span className="soli-jarval">{money2(setAside)}</span>
          <span className="soli-herosub">set this aside, don't spend it</span>
        </div>
      </div>

      <div className="soli-cards">
        <Stat label="Revenue" value={money2(totals.rev)} tone="neutral" />
        <Stat label="Product" value={"– " + money2(totals.prod)} tone="cost" />
        <Stat label="Booth time" value={"– " + money2(totals.booth)} tone="cost" />
        <Stat label="Pre-tax profit" value={money2(totals.profit)} tone="profit" />
      </div>

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
        <div className="soli-bars">
          {byService.map(s => (
            <div className="soli-barrow" key={s.name}>
              <div className="soli-barlabel"><span>{s.name}</span><span className="soli-barval">{money2(s.perHour)}/hr</span></div>
              <div className="soli-bartrack"><div className="soli-barfill" style={{ width: (s.perHour / maxPH) * 100 + "%" }} /></div>
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
            <span className={"soli-pill " + (c.overdue > 0 ? "late" : "soon")}>{c.overdue > 0 ? c.overdue + "d overdue" : "due soon"}</span>
          </div>
        ))}
      </section>

      <button className="soli-cta" onClick={() => setTab("log")}><PlusCircle size={18} /> Log a service</button>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (<div className={"soli-stat " + tone}><div className="soli-statlabel">{label}</div><div className="soli-statval">{value}</div></div>);
}

/* ------------------------------ LOG SERVICE ------------------------------ */
function LogService({ clients, products, saveClients, logs, saveLogs, rent, taxRate }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [newClient, setNewClient] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [dur, setDur] = useState("");
  const [paySource, setPaySource] = useState("card");
  const [qty, setQty] = useState({});
  const [saved, setSaved] = useState(false);

  const productCost = products.reduce((s, p) => s + (Number(qty[p.id]) || 0) * p.cost, 0);
  const priceN = Number(price) || 0, durN = Number(dur) || 0;
  const pv = durN > 0 ? profitOf({ price: priceN, productCost, durationMin: durN }, rent) : null;
  const setAside = pv ? pv.profit * (taxRate / 100) : 0;
  const takeHome = pv ? pv.profit - setAside : 0;

  const submit = () => {
    if (!service || !priceN || !durN) return;
    let cid = clientId, cl = clients;
    if (newClient.trim()) {
      cid = uid();
      cl = [...clients, { id: cid, name: newClient.trim(), phone: "", notes: "", rebookWeeks: 4, lastVisit: new Date().toISOString() }];
      saveClients(cl);
    } else if (cid) {
      saveClients(clients.map(c => c.id === cid ? { ...c, lastVisit: new Date().toISOString() } : c));
    }
    saveLogs([{ id: uid(), clientId: cid, service: service.trim(), price: priceN, durationMin: durN,
      paySource, productCost: Math.round(productCost * 100) / 100, date: new Date().toISOString() }, ...logs]);
    setSaved(true); setService(""); setPrice(""); setDur(""); setQty({}); setNewClient(""); setPaySource("card");
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="soli-page soli-narrow">
      <h1 className="soli-h1">Log a service</h1>
      <p className="soli-sub">Takes 20 seconds. Soli handles the profit, tax & take-home math.</p>

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
        <Field label="Price charged ($)"><input className="soli-input" type="number" inputMode="decimal" placeholder="120" value={price} onChange={e => setPrice(e.target.value)} /></Field>
        <Field label="Time in chair (min)"><input className="soli-input" type="number" inputMode="numeric" placeholder="120" value={dur} onChange={e => setDur(e.target.value)} /></Field>
      </div>

      <Field label="How did they pay?">
        <div className="soli-seg">
          {SOURCES.map(s => (
            <button key={s.id} className={"soli-segbtn" + (paySource === s.id ? " on" : "")} onClick={() => setPaySource(s.id)}>{s.label}</button>
          ))}
        </div>
      </Field>

      <Field label="Product used (set quantities)">
        {products.length === 0 && <p className="soli-help">No products yet. Add your supplies under <b>Inventory</b> to auto-track product cost. You can still log a service without them.</p>}
        <div className="soli-prodgrid">
          {products.map(p => (
            <div className="soli-prodpick" key={p.id}>
              <span className="soli-prodname">{p.name}<small>{money2(p.cost)}/{p.unit}</small></span>
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
          <div className="soli-prevrow sub"><span>{money2(pv.perHour)}/hr · {Math.round(pv.margin * 100)}% margin</span></div>
        </div>
      )}

      <button className="soli-cta" onClick={submit} disabled={!service || !priceN || !durN}>{saved ? "Saved ✓" : "Save service"}</button>
    </div>
  );
}

function Field({ label, children }) {
  return (<div className="soli-field"><label className="soli-label">{label}</label>{children}</div>);
}

/* ------------------------------ PLANNER ---------------------------------- */
function Planner({ plan, savePlan, taxRate }) {
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
        <Field label="Monthly take-home goal ($)"><input className="soli-input" type="number" value={goal} onChange={e => set("goal", e.target.value)} /></Field>
        <Field label="Monthly booth rent ($)"><input className="soli-input" type="number" value={rent} onChange={e => set("monthlyRent", e.target.value)} /></Field>
      </div>
      <Field label="Average price per service ($)"><input className="soli-input" type="number" value={avg} onChange={e => set("avgPrice", e.target.value)} /></Field>

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
    </div>
  );
}

/* ------------------------------- CLIENTS --------------------------------- */
function ClientsView({ clients, logs, saveClients, rent }) {
  const [open, setOpen] = useState(null);
  const stats = (cid) => {
    const ls = logs.filter(l => l.clientId === cid);
    const profit = ls.reduce((s, l) => s + profitOf(l, rent).profit, 0);
    return { visits: ls.length, profit, ls: ls.sort((a, b) => new Date(b.date) - new Date(a.date)) };
  };
  const remove = (id) => { saveClients(clients.filter(c => c.id !== id)); setOpen(null); };

  return (
    <div className="soli-page">
      <h1 className="soli-h1">Clients</h1>
      <p className="soli-sub">{clients.length} clients · ranked by lifetime profit</p>
      {clients.length === 0 && <p className="soli-emptyhint" style={{ textAlign: "left", marginTop: 0 }}>No clients yet. They're added automatically when you log a service. Just type a new name on the <b>Log service</b> screen.</p>}
      <div className="soli-clientlist">
        {clients.map(c => ({ ...c, s: stats(c.id) })).sort((a, b) => b.s.profit - a.s.profit).map(c => (
          <div key={c.id} className="soli-clientcard" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <div className="soli-clienttop">
              <div><div className="soli-clientname">{c.name}</div><div className="soli-clientmeta">{c.s.visits} visits · last {fmtDate(c.lastVisit)}</div></div>
              <div className="soli-clientprofit">{money2(c.s.profit)}<small>lifetime profit</small></div>
            </div>
            {open === c.id && (
              <div className="soli-clientdetail" onClick={e => e.stopPropagation()}>
                {c.notes && <p className="soli-clientnotes">{c.notes}</p>}
                {c.phone && <p className="soli-clientnotes">📞 {c.phone}</p>}
                <div className="soli-history">
                  {c.s.ls.map(l => (
                    <div className="soli-histrow" key={l.id}><span>{fmtDate(l.date)} · {l.service} <em>· {srcLabel(l.paySource)}</em></span><span className="soli-histprofit">{money2(profitOf(l, rent).profit)}</span></div>
                  ))}
                </div>
                <button className="soli-del" onClick={() => remove(c.id)}><Trash2 size={14} /> Remove client</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ INVENTORY -------------------------------- */
function Inventory({ products, saveProducts }) {
  const [name, setName] = useState(""); const [cost, setCost] = useState(""); const [unit, setUnit] = useState("use");
  const add = () => { if (!name || !cost) return; saveProducts([...products, { id: uid(), name: name.trim(), cost: Number(cost), stock: 0, unit: unit || "use" }]); setName(""); setCost(""); setUnit("use"); };
  const upd = (id, key, v) => saveProducts(products.map(p => p.id === id ? { ...p, [key]: key === "name" || key === "unit" ? v : Number(v) } : p));
  const del = (id) => saveProducts(products.filter(p => p.id !== id));
  return (
    <div className="soli-page">
      <h1 className="soli-h1">Inventory & product costs</h1>
      <p className="soli-sub">What each product costs you. Soli uses this in every profit calc.</p>
      {products.length === 0 && <p className="soli-emptyhint" style={{ textAlign: "left", marginTop: 0, marginBottom: 16 }}>No products yet. Add your supplies below so Soli can fold their cost into every profit calculation.</p>}
      <div className="soli-invtable">
        <div className="soli-invhead"><span>Product</span><span>Cost</span><span>Per</span><span>Stock</span><span></span></div>
        {products.map(p => (
          <div className="soli-invrow" key={p.id}>
            <input className="soli-input slim" value={p.name} onChange={e => upd(p.id, "name", e.target.value)} />
            <input className="soli-input slim" type="number" value={p.cost} onChange={e => upd(p.id, "cost", e.target.value)} />
            <input className="soli-input slim" value={p.unit} onChange={e => upd(p.id, "unit", e.target.value)} />
            <input className="soli-input slim" type="number" value={p.stock} onChange={e => upd(p.id, "stock", e.target.value)} />
            <button className="soli-iconbtn" onClick={() => del(p.id)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="soli-addbox">
        <div className="soli-addhead">Add a product</div>
        <div className="soli-row3">
          <input className="soli-input" placeholder="Product name" value={name} onChange={e => setName(e.target.value)} />
          <input className="soli-input" type="number" placeholder="Cost $" value={cost} onChange={e => setCost(e.target.value)} />
          <input className="soli-input" placeholder="per (use/set)" value={unit} onChange={e => setUnit(e.target.value)} />
        </div>
        <button className="soli-cta sm" onClick={add}>Add product</button>
      </div>
    </div>
  );
}

/* ------------------------------- SETTINGS -------------------------------- */
function SettingsView({ settings, saveSettings, loadSample, clearAll }) {
  const onLoad = () => { if (confirm("Load sample data? This replaces what's here now with an example set you can explore. Clear it anytime.")) loadSample(); };
  const onClear = () => { if (confirm("Clear all data? This permanently erases your clients, products and logged services. This can't be undone.")) clearAll(); };
  return (
    <div className="soli-page soli-narrow">
      <h1 className="soli-h1">Settings</h1>
      <Field label="Booth rent, cost per hour ($)">
        <input className="soli-input" type="number" value={settings.boothRentHourly}
          onChange={e => saveSettings({ ...settings, boothRentHourly: Number(e.target.value) })} />
        <p className="soli-help">The engine behind every profit number. Set it to your real chair/booth cost, or 0 if you don't pay rent.</p>
      </Field>
      <Field label="Tax set-aside (%)">
        <input className="soli-input" type="number" value={settings.taxRate}
          onChange={e => saveSettings({ ...settings, taxRate: Number(e.target.value) })} />
        <p className="soli-help">Self-employed? 25 to 30% is a safe starting point (income plus about 15.3% self-employment tax). Ask a tax pro for your exact number.</p>
      </Field>

      <div className="soli-datatools">
        <div className="soli-datahead">Your data</div>
        <button className="soli-ghost" onClick={onLoad}>Load sample data to explore</button>
        <button className="soli-del" onClick={onClear}><Trash2 size={15} /> Clear all data</button>
      </div>
      <p className="soli-help">Your data saves automatically in this browser and persists between visits.</p>
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
.soli-main{max-width:920px;margin:0 auto;padding:30px 22px 80px}
.soli-page{animation:rise .4s ease both}
.soli-narrow{max-width:560px;margin:0 auto}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.soli-h1{font-family:'Fraunces',serif;font-weight:600;font-size:34px;margin:0 0 4px;letter-spacing:-.6px}
.soli-sub{color:var(--ink2);margin:0 0 24px;font-size:14.5px}

.soli-hero{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-bottom:14px}
@media(max-width:560px){.soli-hero{grid-template-columns:1fr}.soli-tag{display:none}}
.soli-heroblock{background:linear-gradient(150deg,#5E7142,#475431);color:#F4F0E4;border-radius:18px;padding:20px 22px;display:flex;flex-direction:column}
.soli-herolabel{font-size:12.5px;display:flex;align-items:center;gap:6px;color:#D6DBC2;margin-bottom:8px}
.soli-heroval{font-family:'Fraunces',serif;font-size:34px;font-weight:600;line-height:1}
.soli-herosub{font-size:11.5px;opacity:.8;margin-top:6px}
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
.soli-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.soli-row3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}
@media(max-width:540px){.soli-row3{grid-template-columns:1fr}}

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

.soli-invtable{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:8px 12px;margin-bottom:20px;overflow-x:auto}
.soli-invhead,.soli-invrow{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 36px;gap:8px;align-items:center;min-width:430px}
.soli-invhead{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);padding:8px 4px;border-bottom:1px solid var(--line)}
.soli-invrow{padding:6px 0}
.soli-iconbtn{background:none;border:none;cursor:pointer;color:var(--ink2);display:flex;justify-content:center}
.soli-iconbtn:hover{color:var(--clay-d)}
.soli-addbox{background:var(--surface2);border:1px dashed var(--line);border-radius:15px;padding:18px}
.soli-addhead{font-weight:600;font-size:14px;margin-bottom:12px}
.soli-help{font-size:12px;color:var(--ink2);margin-top:8px}

.soli-empty{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:42px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.soli-emptymark{width:60px;height:60px;border-radius:50%;background:var(--clay);color:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:6px;box-shadow:0 6px 16px rgba(188,107,76,.3)}
.soli-empty h2{font-family:'Fraunces',serif;font-size:22px;font-weight:600;margin:0}
.soli-empty p{color:var(--ink2);font-size:14px;margin:0 0 10px;max-width:400px;line-height:1.5}
.soli-empty .soli-cta{max-width:320px}
.soli-emptyhint{margin-top:16px;font-size:12.5px;color:var(--ink2);text-align:center;line-height:1.5}

.soli-datatools{margin-top:26px;padding-top:20px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px}
.soli-datahead{font-weight:600;font-size:14px;margin-bottom:2px}
.soli-ghost{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink2);font-family:inherit;font-size:14px;font-weight:600;padding:12px;border-radius:11px;cursor:pointer;transition:.15s}
.soli-ghost:hover{border-color:var(--clay);color:var(--ink)}
.soli-datatools .soli-del{width:100%;justify-content:center;padding:12px;margin-top:0}
`}</style>);
}
