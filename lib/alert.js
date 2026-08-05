/* Server-side error alerting. Emails the operator when something breaks, so a
   bug is found here before a paying customer finds it.

   Deliberately fail-safe: if alerting itself fails (no key, Resend down), it
   logs and returns instead of throwing, so it can never take down a request. */

const WINDOW_MS = 10 * 60 * 1000; // per-fingerprint cooldown

/* Two budgets, because these callers carry very different weight.

   Trusted means the report came from our own server code or from a signed-in
   browser. Untrusted means anyone at all: /api/report-error takes anonymous
   reports so a broken login or landing page still reaches us, which also means
   a stranger can post to it in a loop. A separate, much smaller allowance keeps
   that from crowding out real alerts or running up the mail bill.

   Worth being plain about the limit: these counters live in module memory, and
   each serverless instance has its own. They throttle a loop from one source
   well, but they are not a true global ceiling, so the untrusted budget is set
   low enough that a fan-out across instances still stays cheap. */
const MAX_PER_WINDOW = 12;
const MAX_UNTRUSTED_PER_WINDOW = 3;

const seen = new Map(); // fingerprint -> last sent ms
const windows = { trusted: { start: 0, count: 0 }, untrusted: { start: 0, count: 0 } };

function shouldSend(fingerprint, trusted) {
  const now = Date.now();
  const w = trusted ? windows.trusted : windows.untrusted;
  if (now - w.start > WINDOW_MS) { w.start = now; w.count = 0; }
  if (w.count >= (trusted ? MAX_PER_WINDOW : MAX_UNTRUSTED_PER_WINDOW)) return false;

  /* The fingerprint holds the message, which an untrusted caller chooses. Vary
     it and every report looks new, so for those the cooldown cannot be relied
     on and the window count above is what actually holds the line. */
  const last = seen.get(fingerprint);
  if (last && now - last < WINDOW_MS) return false; // already alerted recently
  seen.set(fingerprint, now);
  w.count++;
  if (seen.size > 500) seen.clear(); // bound memory
  return true;
}

const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

/* Send an alert email. Returns true if sent, false if skipped or unavailable. */
export async function sendAlert({ source, message, detail, url, userId, trusted = true }) {
  try {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.ALERT_EMAIL;
    if (!key || !to) return false;

    const fingerprint = `${source}|${String(message).slice(0, 200)}`;
    if (!shouldSend(fingerprint, trusted)) return false;

    const when = new Date().toISOString();
    const html = `<!doctype html><html><body style="margin:0;background:#F6EFE4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B2118">
      <div style="max-width:560px;margin:0 auto;padding:24px 20px">
        <div style="font-family:Georgia,serif;font-weight:700;font-size:22px;margin-bottom:10px">Soli alert</div>
        <div style="background:#FFFDF9;border:1px solid #E7DBC8;border-radius:16px;padding:20px">
          <div style="background:#F6E0D5;border:1px solid #E8C4B0;border-radius:10px;padding:12px 14px;color:#A4583B;font-weight:700;font-size:15px">${esc(message)}</div>
          <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:13.5px;color:#3a2f24">
            <tr><td style="padding:6px 0;color:#6E5E4C;width:90px">Source</td><td>${esc(source)}</td></tr>
            ${url ? `<tr><td style="padding:6px 0;color:#6E5E4C">URL</td><td>${esc(url)}</td></tr>` : ""}
            ${userId ? `<tr><td style="padding:6px 0;color:#6E5E4C">User</td><td>${esc(userId)}</td></tr>` : ""}
            <tr><td style="padding:6px 0;color:#6E5E4C">Time</td><td>${esc(when)}</td></tr>
          </table>
          ${detail ? `<pre style="margin-top:14px;background:#FBF5EB;border:1px solid #E7DBC8;border-radius:10px;padding:12px;font-size:12px;white-space:pre-wrap;word-break:break-word;color:#3a2f24">${esc(String(detail).slice(0, 2500))}</pre>` : ""}
        </div>
        <div style="font-size:11.5px;color:#9c8a72;text-align:center;margin-top:14px">Repeat alerts are muted for 10 minutes.</div>
      </div></body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Soli alerts <no-reply@soli.beauty>",
        to,
        subject: `Soli: ${String(message).slice(0, 90)}`,
        html,
      }),
    });
    return true;
  } catch (e) {
    console.error("sendAlert failed:", e?.message);
    return false;
  }
}
