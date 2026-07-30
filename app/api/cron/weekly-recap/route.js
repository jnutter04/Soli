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

function recapHtml({ sym, kept, booked, count, perHr, topService, rangeLabel, tips }) {
  return `<!doctype html><html><body style="margin:0;background:#F6EFE4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B2118">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="font-family:Georgia,serif;font-weight:700;font-size:26px;color:#2B2118;margin-bottom:6px">Soli</div>
    <div style="background:#FFFDF9;border:1px solid #E7DBC8;border-radius:18px;padding:26px 24px">
      <div style="font-size:14px;color:#6E5E4C;margin-bottom:14px">Your week &middot; ${rangeLabel}</div>
      <div style="background:linear-gradient(150deg,#5E7142,#475431);color:#F4F0E4;border-radius:14px;padding:20px">
        <div style="font-size:13px;color:#D6DBC2;margin-bottom:6px">You kept</div>
        <div style="font-family:Georgia,serif;font-size:38px;font-weight:700;line-height:1">${money(sym, kept)}</div>
        <div style="font-size:12px;opacity:.85;margin-top:6px">after product, booth rent &amp; taxes${tips > 0 ? ", plus " + money(sym, tips) + " in tips" : ""}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;color:#3a2f24">
        <tr><td style="padding:7px 0;border-bottom:1px solid #EEE4D4">Services</td><td style="text-align:right;border-bottom:1px solid #EEE4D4">${count}</td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #EEE4D4">Booked</td><td style="text-align:right;border-bottom:1px solid #EEE4D4">${money(sym, booked)}</td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #EEE4D4">Profit per hour</td><td style="text-align:right;border-bottom:1px solid #EEE4D4">${money(sym, perHr)}</td></tr>
        ${topService ? `<tr><td style="padding:7px 0">Top earner</td><td style="text-align:right">${topService}</td></tr>` : ""}
      </table>
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

  const { data: rows, error } = await admin.from("user_state").select("user_id, logs, settings");
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
      if (wk.length === 0) { skipped++; continue; } // only recap active weeks

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
          subject: `Your Soli week: ${money(sym, kept)} kept`,
          html: recapHtml({ sym, kept, booked, count: wk.length, perHr, topService, rangeLabel, tips }),
        }),
      });
      if (res.ok) sent++; else failed++;
    } catch { failed++; }
  }

  return NextResponse.json({ sent, skipped, failed });
}
