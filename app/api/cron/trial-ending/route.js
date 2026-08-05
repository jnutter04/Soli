import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYM = { USD: "$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$" };
const money = (sym, n) => sym + Math.round(n).toLocaleString("en-US");

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

/* What the trial actually produced for them. The strongest argument for paying
   is their own number, so the email leads with work they did rather than with
   a pitch. Someone who logged nothing gets different copy: there is no total
   worth showing, and pretending otherwise would read as a form letter. */
function trialSummary(row) {
  const s = row.settings || {};
  const rent = boothHourly(s);
  const sym = SYM[s.currency] || "$";
  const logs = row.logs || [];
  let profit = 0, hours = 0;
  logs.forEach((l) => {
    profit += l.price - l.productCost - (l.durationMin / 60) * rent;
    hours += l.durationMin / 60;
  });
  const taxRate = (Number(s.taxRate) || 0) / 100;
  return {
    sym,
    services: logs.length,
    clients: (row.clients || []).length,
    profit,
    tax: profit > 0 ? profit * taxRate : 0,
    // A rate needs time on the clock. No hours logged means there is no rate to quote.
    perHour: hours > 0 ? profit / hours : null,
  };
}

function numbersBlock(t) {
  if (t.services === 0) return "";
  const cells = [
    [money(t.sym, t.profit), "kept after costs"],
    [String(t.services), t.services === 1 ? "service logged" : "services logged"],
  ];
  if (t.perHour !== null) cells.push([money(t.sym, t.perHour) + "/hr", "your real rate"]);
  else if (t.clients > 0) cells.push([String(t.clients), t.clients === 1 ? "client tracked" : "clients tracked"]);

  const tds = cells.map(([big, small]) => `
    <td style="text-align:center;padding:0 6px" width="${Math.floor(100 / cells.length)}%">
      <div style="font-family:Georgia,serif;font-size:23px;font-weight:700;color:#2B2118">${big}</div>
      <div style="font-size:11.5px;color:#6E5E4C;margin-top:3px">${small}</div>
    </td>`).join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF5EB;border:1px solid #E7DBC8;border-radius:14px;padding:18px 10px;margin:20px 0">
    <tr>${tds}</tr>
  </table>
  ${t.tax > 0 ? `<div style="font-size:13px;color:#6E5E4C;text-align:center;margin:-8px 0 18px">Roughly ${money(t.sym, t.tax)} of that is tax you'll owe, not spending money.</div>` : ""}`;
}

function emailHtml({ days, endLabel, t }) {
  const when = days === 1 ? "tomorrow" : `in ${days} days`;
  const worked = t.services > 0;

  const lead = worked
    ? `Your free trial ends ${when}, on ${endLabel}. Here is what Soli worked out while you had it:`
    : `Your free trial ends ${when}, on ${endLabel}, and you haven't logged a service yet. One service takes about twenty seconds, and it is enough to show you what you actually keep after product, booth rent and tax.`;

  return `<!doctype html><html><body style="margin:0;background:#F6EFE4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2B2118">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px">
    <div style="background:#FFFDF9;border:1px solid #E7DBC8;border-radius:18px;padding:26px 22px">
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;margin-bottom:10px">Your trial ends ${when}</div>
      <div style="font-size:14.5px;line-height:1.55;color:#3d3226">${lead}</div>

      ${numbersBlock(t)}

      <div style="font-size:14.5px;line-height:1.55;color:#3d3226;margin-top:${worked ? 0 : 14}px">
        On ${endLabel}, Soli locks until you subscribe. ${worked ? "Nothing is deleted" : "Nothing you add between now and then is lost"}: every service, client and number stays exactly where it is, and subscribing brings it straight back.
      </div>

      <a href="https://www.soli.beauty/app" style="display:block;text-align:center;margin-top:22px;background:#BC6B4C;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px">${worked ? "Keep Soli &rarr;" : "Log a service &rarr;"}</a>
      <div style="font-size:12.5px;color:#6E5E4C;text-align:center;margin-top:12px">$12 a month. Cancel whenever you like.</div>
    </div>
    <div style="font-size:12px;color:#9c8a72;text-align:center;margin-top:16px">You're getting this once because your trial is ending. It isn't a newsletter, and there is nothing to unsubscribe from.</div>
  </div></body></html>`;
}

/* Warns people before the paywall lands instead of after.

   Sent on the day exactly 3 days remain, and again at 1 day. Picking exact
   days means no "already warned" flag is needed: a daily run passes through
   each number once. A missed run would skip that number rather than repeat
   it, which is why there are two chances rather than one. */
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

  const admin = createAdminClient();

  const emails = {};
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    (data?.users || []).forEach((u) => { if (u.email) emails[u.id] = u.email; });
    if (!data || (data.users || []).length < 200) break;
  }

  // `comped` was added later than the rest, so fall back if it isn't there yet.
  const cols = "user_id, trial_ends_at, subscription_status, settings, logs, clients";
  let { data: rows, error } = await admin.from("user_state").select(cols + ", comped");
  if (error) ({ data: rows, error } = await admin.from("user_state").select(cols));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  for (const row of rows || []) {
    try {
      const email = emails[row.user_id];
      if (!email || row.comped) { skipped++; continue; }

      // Anyone already paying, or mid payment-retry, has no wall coming.
      const sub = row.subscription_status;
      if (sub === "active" || sub === "trialing" || sub === "past_due") { skipped++; continue; }

      if (!row.trial_ends_at) { skipped++; continue; }
      const msLeft = new Date(row.trial_ends_at).getTime() - now;
      // Same rounding the in-app countdown uses, so the two never disagree.
      const days = Math.max(0, Math.ceil(msLeft / 864e5));
      if (days !== 3 && days !== 1) { skipped++; continue; }

      const endLabel = new Date(row.trial_ends_at)
        .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const t = trialSummary(row);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Soli <no-reply@soli.beauty>",
          to: [email],
          subject: days === 1 ? "Your Soli trial ends tomorrow" : `Your Soli trial ends ${endLabel}`,
          html: emailHtml({ days, endLabel, t }),
        }),
      });
      if (res.ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
