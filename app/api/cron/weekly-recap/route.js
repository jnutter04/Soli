import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYM = { USD: "$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$" };
const money = (sym, n) => sym + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Mirror of the app's booth-rent conversion (kept local so the cron never imports client code).
function boothHourly(s) {
  const unit = s.boothRentUnit || "hour";
  const amt = Number(s.boothRentAmount);
  const hpw = Number(s.boothRentHoursPerWeek) || 0;
  if (unit === "week" && amt > 0 && hpw > 0) return amt / hpw;
  if (unit === "month" && amt > 0 && hpw > 0) return (amt * 12 / 52) / hpw;
  if (unit === "hour" && s.boothRentAmount !== undefined && s.boothRentAmount !== "") return amt || 0;
  return Number(s.boothRentHourly) || 0;
}
function weekStartMs(d) { const dt = new Date(d); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dt.getTime(); }

/* Clients past their rebook window. Mirrors the dashboard's logic, but only
   counts genuinely-due clients (not "due soon") and ignores anyone more than
   60 days overdue, who has most likely moved on rather than forgotten. */
function dueClients(clients) {
  const now = Date.now();
  return (clients || [])
    .filter((c) => c && c.lastVisit)
    .map((c) => {
      const weeks = Number(c.rebookWeeks) || 4;
      const dueAt = new Date(c.lastVisit).getTime() + weeks * 7 * 864e5;
      return { name: c.name, phone: c.phone, overdue: Math.floor((now - dueAt) / 864e5) };
    })
    .filter((c) => c.overdue >= 0 && c.overdue <= 60)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 8);
}

const digits = (p) => String(p || "").replace(/[^0-9+]/g, "");
const smsLink = (phone, name) =>
  `sms:${digits(phone)}?&body=${encodeURIComponent(`Hi ${String(name || "").split(" ")[0]}! It has been a little while since your last visit. Want me to get you back on the books?`)}`;

function rebookSection(due) {
  if (!due.length) return "";
  const rows = due.map((c) => {
    const when = c.overdue === 0 ? "due today" : `${c.overdue} day${c.overdue === 1 ? "" : "s"} overdue`;
    const action = c.phone
      ? `<a href="${smsLink(c.phone, c.name)}" style="color:#A4583B;text-decoration:none;font-weight:700">Text them &rarr;</a>`
      : `<span style="color:#9c8a72">no phone saved</span>`;
    return `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #EEE4D4">
        <div style="font-weight:600">${c.name}</div>
        <div style="font-size:12px;color:#6E5E4C">${when}</div>
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #EEE4D4;text-align:right;font-size:13.5px">${action}</td>
    </tr>`;
  }).join("");
  return `<div style="margin-top:22px;background:#FBF5EB;border:1px solid #E7DBC8;border-radius:14px;padding:18px 16px">
    <div style="font-family:Georgia,serif;font-size:17px;font-weight:700;margin-bottom:4px">Time to rebook</div>
    <div style="font-size:13px;color:#6E5E4C;margin-bottom:8px">${due.length} client${due.length === 1 ? " is" : "s are"} past their usual window. A quick text is usually all it takes.</div>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
  </div>`;
}

function recapHtml({ sym, kept, booked, count, perHr, topService, rangeLabel, tips, hadWork, rebook }) {
  return `<!doctype html><html><body style="margin:0;background:#F6EFE4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B2118">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="font-family:Georgia,serif;font-weight:700;font-size:26px;color:#2B2118;margin-bottom:6px">Soli</div>
    <div style="background:#FFFDF9;border:1px solid #E7DBC8;border-radius:18px;padding:26px 24px">
      <div style="font-size:14px;color:#6E5E4C;margin-bottom:14px">Your week &middot; ${rangeLabel}</div>
      ${hadWork ? `<div style="background:linear-gradient(150deg,#5E7142,#475431);color:#F4F0E4;border-radius:14px;padding:20px">
        <div style="font-size:13px;color:#D6DBC2;margin-bottom:6px">You kept</div>
        <div style="font-family:Georgia,serif;font-size:38px;font-weight:700;line-height:1">${money(sym, kept)}</div>
        <div style="font-size:12px;opacity:.85;margin-top:6px">after product, booth rent &amp; taxes${tips > 0 ? ", plus " + money(sym, tips) + " in tips" : ""}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;color:#3a2f24">
        <tr><td style="padding:7px 0;border-bottom:1px solid #EEE4D4">Services</td><td style="text-align:right;border-bottom:1px solid #EEE4D4">${count}</td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #EEE4D4">Booked</td><td style="text-align:right;border-bottom:1px solid #EEE4D4">${money(sym, booked)}</td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #EEE4D4">Profit per hour</td><td style="text-align:right;border-bottom:1px solid #EEE4D4">${money(sym, perHr)}</td></tr>
        ${topService ? `<tr><td style="padding:7px 0">Top earner</td><td style="text-align:right">${topService}</td></tr>` : ""}
      </table>` : `<div style="background:#FBF5EB;border:1px solid #E7DBC8;border-radius:14px;padding:18px;font-size:14px;color:#3a2f24;line-height:1.5">
        No services logged last week. Nothing to add up, but a few clients are ready to come back.
      </div>`}
      ${rebook}
      <a href="https://soli.beauty/app" style="display:block;text-align:center;margin-top:20px;background:#BC6B4C;color:#fff;text-decoration:none;font-weight:700;padding:13px;border-radius:12px">Open Soli &rarr;</a>
    </div>
    <div style="font-size:12px;color:#9c8a72;text-align:center;margin-top:16px">You're getting this because weekly recaps are on. Turn them off anytime in Soli &rarr; Settings.</div>
  </div></body></html>`;
}

export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

  const admin = createAdminClient();

  // Build user_id -> email map.
  const emails = {};
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    (data?.users || []).forEach((u) => { if (u.email) emails[u.id] = u.email; });
    if (!data || (data.users || []).length < 200) break;
  }

  const { data: rows, error } = await admin.from("user_state").select("user_id, logs, settings, clients");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const thisWeek = weekStartMs(Date.now());
  const start = thisWeek - 7 * 864e5, end = thisWeek;
  const rangeLabel = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " to " +
    new Date(end - 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  let sent = 0, skipped = 0, failed = 0;
  for (const row of rows || []) {
    try {
      const email = emails[row.user_id];
      const s = row.settings || {};
      if (!email || s.weeklyRecap === false) { skipped++; continue; }
      const rent = boothHourly(s), t = (Number(s.taxRate) || 0) / 100, sym = SYM[s.currency] || "$";
      const wk = (row.logs || []).filter((l) => { const ts = new Date(l.date).getTime(); return ts >= start && ts < end; });
      const due = dueClients(row.clients);
      // Worth an email if there is a week to recap OR clients to win back.
      if (wk.length === 0 && due.length === 0) { skipped++; continue; }

      let booked = 0, profit = 0, tips = 0, hours = 0; const svc = {};
      wk.forEach((l) => {
        const booth = (l.durationMin / 60) * rent;
        const p = l.price - l.productCost - booth;
        booked += l.price; profit += p; tips += Number(l.tip) || 0; hours += l.durationMin / 60;
        svc[l.service] = (svc[l.service] || 0) + p;
      });
      const kept = profit * (1 - t) + tips;
      const perHr = hours > 0 ? profit / hours : 0;
      const topService = Object.entries(svc).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Soli <no-reply@soli.beauty>",
          to: email,
          subject: wk.length > 0
            ? `Your Soli week: ${money(sym, kept)} kept`
            : `${due.length} client${due.length === 1 ? " is" : "s are"} ready to rebook`,
          html: recapHtml({
            sym, kept, booked, count: wk.length, perHr, topService, rangeLabel, tips,
            hadWork: wk.length > 0, rebook: rebookSection(due),
          }),
        }),
      });
      if (res.ok) sent++; else failed++;
    } catch { failed++; }
  }

  return NextResponse.json({ sent, skipped, failed });
}
