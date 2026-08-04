/* Turning an exported booking or payments file into Soli services.

   Every platform names its columns differently and there is no standard, so
   this guesses from the header row and hands control back to the user rather
   than pretending it got it right. Anything it cannot work out is left blank
   for a person to fill in, because a wrong number quietly corrupts months of
   take-home figures. */

/* Splits CSV text, honouring quoted fields, escaped quotes and newlines
   inside quotes. Handles both comma and semicolon files, which European
   exports commonly use. */
export function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!src.trim()) return [];

  // Pick the delimiter that appears more often outside quotes on the first line.
  const firstLine = src.split("\n")[0];
  let commas = 0, semis = 0, inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === ",") commas++;
    else if (!inQ && ch === ";") semis++;
  }
  const delim = semis > commas ? ";" : ",";

  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.filter((r) => r.some((f) => String(f).trim() !== ""));
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* Header names seen across the common booking and payment exports. Order
   matters: the first match wins, so the more specific names come first. */
const FIELD_HINTS = {
  date: ["date", "datetime", "appointmentdate", "starttime", "startdate", "createdat", "transactiondate", "paidat", "when", "day"],
  client: ["client", "clientname", "customer", "customername", "guest", "patient", "contact", "name"],
  service: ["service", "servicename", "item", "itemname", "description", "treatment", "appointmenttype", "product"],
  price: ["price", "amount", "total", "grosssales", "servicetotal", "subtotal", "netsales", "charged", "revenue", "totalmoney"],
  tip: ["tip", "tips", "gratuity", "tipamount"],
  duration: ["duration", "durationminutes", "minutes", "length", "servicetime", "mins"],
  paySource: ["paymentmethod", "payment", "paymenttype", "source", "tender", "cardbrand", "method"],
};

/* Guesses which column holds which field. Returns an index per field, or -1. */
export function detectColumns(header) {
  const cols = header.map(norm);
  const used = new Set();
  const out = {};
  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    let found = -1;
    // Exact match first, then contains, so "tipamount" beats "amount" for tip.
    for (const hint of hints) {
      const exact = cols.findIndex((c, i) => c === hint && !used.has(i));
      if (exact !== -1) { found = exact; break; }
    }
    if (found === -1) {
      for (const hint of hints) {
        const partial = cols.findIndex((c, i) => c.includes(hint) && !used.has(i));
        if (partial !== -1) { found = partial; break; }
      }
    }
    if (found !== -1) used.add(found);
    out[field] = found;
  }
  return out;
}

/* Money like "$1,234.56", "1.234,56", "(12.00)" for a refund, or "12,00". */
export function parseMoney(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-]/g, "").replace(/[^0-9.,]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal one.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // A lone comma is a decimal separator only when it splits 1-2 trailing digits.
    const after = s.length - lastComma - 1;
    s = after > 0 && after <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseDuration(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // "1:30" style
  const clock = s.match(/^(\d+):([0-5]\d)$/);
  if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
  let total = 0, matched = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (h) { total += parseFloat(h[1]) * 60; matched = true; }
  const m = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (m) { total += parseInt(m[1], 10); matched = true; }
  if (matched) return Math.round(total);
  const plain = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isFinite(plain) ? Math.round(plain) : null;
}

/* Dates are the easiest thing to get quietly wrong, because 03/04 is March 4th
   in the US and April 3rd almost everywhere else. Unambiguous formats are read
   directly; ambiguous ones are reported so the UI can ask which order to use. */
export function parseDate(raw, dayFirst = false) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO: 2026-03-04 or 2026-03-04T10:00
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, mo, d] = iso;
    return { date: mk(+y, +mo, +d), ambiguous: false };
  }

  // Slash or dot separated: 03/04/2026, 3-4-26
  const parts = s.match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (parts) {
    let [, a, b, c] = parts.map(Number);
    if (String(parts[1]).length === 4) return { date: mk(a, b, c), ambiguous: false }; // yyyy/mm/dd
    if (c < 100) c += c < 70 ? 2000 : 1900;
    // A value over 12 can only be the day, which settles the order.
    if (a > 12) return { date: mk(c, b, a), ambiguous: false };
    if (b > 12) return { date: mk(c, a, b), ambiguous: false };
    // a and b are both 12 or under, so the order is genuinely undecidable from
    // the value alone. Default to month first (US exports) and flag it so the
    // user can flip the whole file if their platform writes day first.
    return dayFirst
      ? { date: mk(c, b, a), ambiguous: true }   // day/month/year
      : { date: mk(c, a, b), ambiguous: true };  // month/day/year
  }

  // Named months: "4 Mar 2026", "March 4, 2026"
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return { date: mk(d.getFullYear(), d.getMonth() + 1, d.getDate()), ambiguous: false };
  }
  return null;
}

// Midday, so a timezone shift cannot move a visit onto the neighbouring day.
function mk(y, m, d) {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

const PAY_HINTS = [
  [/cash/i, "cash"],
  [/venmo|zelle|cash\s*app|paypal/i, "venmo"],
  [/card|visa|master|amex|credit|debit|stripe|square|chip|swipe|contactless|apple\s*pay|google\s*pay/i, "card"],
];
export function parsePaySource(raw) {
  const s = String(raw || "");
  for (const [re, val] of PAY_HINTS) if (re.test(s)) return val;
  return s.trim() ? "other" : "card";
}

/* Builds review rows from the file. Nothing is written to the account here:
   the user checks and edits these first. */
export function buildRows(table, map, dayFirst = false) {
  const [, ...body] = table;
  const pick = (row, idx) => (idx >= 0 && idx < row.length ? row[idx] : "");
  const rows = [];
  let ambiguousDates = 0;

  body.forEach((raw, i) => {
    const d = parseDate(pick(raw, map.date), dayFirst);
    if (d?.ambiguous) ambiguousDates++;
    const price = parseMoney(pick(raw, map.price));
    const service = String(pick(raw, map.service) || "").trim();
    const client = String(pick(raw, map.client) || "").trim();

    // A row with neither a service nor an amount carries nothing usable.
    if (!service && price == null) return;

    rows.push({
      id: `r${i}`,
      include: true,
      date: d?.date || null,
      client,
      service: service || "Service",
      price: price == null ? "" : Math.abs(price),
      tip: parseMoney(pick(raw, map.tip)) ?? "",
      durationMin: parseDuration(pick(raw, map.duration)) ?? "",
      paySource: parsePaySource(pick(raw, map.paySource)),
      isRefund: price != null && price < 0,
    });
  });

  return { rows, ambiguousDates };
}

/* Identifies a service well enough to spot one already imported. Deliberately
   ignores duration and tip, since those are the fields people correct by hand
   and a re-import should still recognise the same visit. */
export function fingerprint(l, clientName) {
  const day = l.date ? String(l.date).slice(0, 10) : "";
  const name = String(clientName || "").trim().toLowerCase();
  const svc = String(l.service || "").trim().toLowerCase();
  const price = Math.round((Number(l.price) || 0) * 100);
  return `${day}|${name}|${svc}|${price}`;
}
