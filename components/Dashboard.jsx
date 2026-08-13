"use client";

/* The dashboard, and the two cards that only ever appear on it.

   Lifted out of the app page so it can be rendered on its own. It could not be
   before: every view lived in one four thousand line file with no exports, so
   nothing could import a screen to check it still renders. A release went out
   that threw on every dashboard render and the tests, all of which examined
   pure functions, passed without complaint. See __tests__/views.test.js. */

import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle, Banknote, Bell, PiggyBank, PlusCircle,
  Share2, Sun, TrendingUp, Wallet,
} from "lucide-react";
import ShareCard from "@/components/ShareCard";
import { shouldOfferShare } from "@/lib/milestones";
import { money, money2, round2, fmtDate } from "@/lib/format";
import { SOURCES, profitOf, rebookSms } from "@/lib/service";

export default function Dashboard({ logs, clients, rent, taxRate, setTab, buckets = [], plan = {}, savePlan, settings = {}, templates = [], onHideOnboarding, onMilestoneSeen }) {
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
    a.rev += l.price; a.prod += l.productCost; a.booth += booth; a.profit += profit; a.tips += (Number(l.tip) || 0);
    a.mins += Number(l.durationMin) || 0; return a;
  }, { rev: 0, prod: 0, booth: 0, profit: 0, tips: 0, mins: 0 });
  const totalHours = totals.mins / 60;
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
      const k = dd.getFullYear() + "-" + dd.getMonth();
      out.push({ key: k, label: dd.toLocaleDateString(undefined, { month: "short" }), val: m[k] || 0 });
    }
    return out;
  }, [logs, rent, t]);

  /* A record worth mentioning, checked rather than assumed, and offered once.
     Must come after byMonth: it reads it, and a const referenced above its own
     declaration throws at render rather than at build, which is exactly how
     this shipped broken the first time. */
  const milestone = useMemo(
    () => shouldOfferShare({
      months: byMonth.map((mo) => ({ key: mo.key, value: mo.val })),
      promptedFor: settings.sharePromptedFor,
    }),
    [byMonth, settings.sharePromptedFor]
  );
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
          <p>Log your first service and Soli shows what you actually keep, after product, booth rent &amp; tax. Everything here is built from your own numbers.</p>
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
          <span className="soli-herolabel"><Wallet size={14} /> What you kept</span>
          <span className="soli-heroval">{money2(pocketed)}</span>
          <span className="soli-herosub">after product, booth rent &amp; tax{totalTips > 0 ? ", tips included" : ""}</span>
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

      {milestone && (
        <div className="soli-milestone">
          <div>
            <b>Best month you have logged.</b>
            <span>{money(milestone.value)} kept, {money(milestone.beatBy)} more than your previous best.</span>
          </div>
          <div className="soli-milestoneacts">
            <button className="soli-cta sm" onClick={() => setShareOpen(true)}>
              <Share2 size={15} strokeWidth={1.9} /> Share it
            </button>
            <button className="soli-ghost sm" onClick={() => onMilestoneSeen?.(milestone.key)}>Not now</button>
          </div>
        </div>
      )}

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
        milestone={milestone}
        statLeft={{ label: "Services", value: String(month.length) }}
        statRight={{ label: "Kept per hour", value: totalHours > 0 ? money2(pocketed / totalHours) : "n/a" }}
      />

      {/* Four separate totals used to sit here: revenue, product, booth time and
          pre-tax profit. Each was true, none said how it related to the big
          number above, and pre-tax profit was visibly larger than it, which
          invites the only question that matters: which one is my money?

          One chain instead. Every line is a step from what came in to what is
          left, so the figures read as one story rather than four claims. */}
      <section className="soli-chain">
        <div className="soli-chainhead">How that adds up</div>

        <div className="soli-chainrow">
          <span>Money in from services</span><b>{money2(totals.rev)}</b>
        </div>
        <div className="soli-chainrow out">
          <span>Product used on clients</span><b>{"− " + money2(totals.prod)}</b>
        </div>
        <div className="soli-chainrow out">
          {/* Spelling out the sum removes the usual objection, that this is not
              a bill anyone actually paid. It is chair time priced at their own
              rate, and saying so is the difference between a figure someone
              trusts and one they argue with. */}
          <span>Booth rent{rent > 0
            ? ` (${round2(totalHours)}h at ${money2(rent)}/hr)`
            : " (not set yet)"}</span>
          <b>{"− " + money2(totals.booth)}</b>
        </div>
        <div className="soli-chainrow sub">
          <span>Before tax</span><b>{money2(totals.profit)}</b>
        </div>
        <div className="soli-chainrow out">
          <span>Tax to set aside ({taxRate}%)</span><b>{"− " + money2(setAside)}</b>
        </div>
        {totalTips > 0 && (
          <div className="soli-chainrow in">
            <span>Tips</span><b>{"+ " + money2(totalTips)}</b>
          </div>
        )}
        <div className="soli-chainrow total">
          <span>What you kept</span><b>{money2(pocketed)}</b>
        </div>
      </section>

      {/* take-home by month (the year view) */}
      <section className="soli-block">
        <div className="soli-blockhead"><TrendingUp size={18} strokeWidth={1.9} /><h2>What you kept, by month</h2></div>
        <p className="soli-note">What you kept each month, on the same basis as the figure above. Tap or hover a bar for the amount.</p>
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
        <p className="soli-note">Based on service price only. Tips are excluded here so the ranking stays fair, and counted in what you kept above.</p>
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
      why: "Every figure is built on these, so what Soli says you kept is only yours once they are set.",
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
      why: "This is where what you actually keep appears. It takes about twenty seconds.",
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
            <input className="soli-input" type="number" autoFocus aria-label="Monthly take-home goal" value={draft} onChange={(e) => setDraft(e.target.value)}
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
            <input className="soli-input" type="number" autoFocus aria-label="Monthly take-home goal" value={draft} onChange={(e) => setDraft(e.target.value)}
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
