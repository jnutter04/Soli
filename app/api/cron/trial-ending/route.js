import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysLeft, shouldWarn, trialSummary, emailHtml } from "@/lib/trialEmail";

export const runtime = "nodejs";
export const maxDuration = 60;



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

      const days = daysLeft(row.trial_ends_at, now);
      if (!shouldWarn(days)) { skipped++; continue; }

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
