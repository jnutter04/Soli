import { boothHourly } from "./service.js";

/* Working out what a trial produced, and writing the warning email about it.

   Pure and free of server imports so the cron route and the tests can both use
   it. warnDays is here too, because which day the email fires on is the part
   most likely to be got wrong and is worth pinning down in a test. */

const SYM = { USD: "$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$" };
const money = (sym, n) => sym + Math.round(n).toLocaleString("en-US");


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

/* Days remaining, rounded the same way the in-app countdown rounds so the
   email and the screen can never disagree. */
export function daysLeft(trialEndsAt, now = Date.now()) {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now;
  if (!isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 864e5));
}

/* The days a warning goes out. Exact days mean a daily run passes each number
   once, so no "already warned" flag is needed. */
export const WARN_ON = [3, 1];
export const shouldWarn = (days) => WARN_ON.includes(days);

export { SYM, money, boothHourly, trialSummary, numbersBlock, emailHtml };
