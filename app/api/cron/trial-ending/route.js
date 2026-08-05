import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysLeft, shouldWarn, trialSummary, emailHtml } from "@/lib/trialEmail";
import { qualifies, rewardReferrer } from "@/lib/referralReward";

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

  /* Columns are tried richest first and stepped down.

     Both `comped` and the referral columns arrived after the table did, and a
     deploy can land before its migration is run. Asking for a column that does
     not exist fails the whole query, which would take the trial warnings down
     with it, so a missing column costs only the feature that needs it. */
  const BASE = "user_id, trial_ends_at, subscription_status, stripe_customer_id, settings, logs, clients";
  const REF = ", referral_code, referred_by, referral_rewarded_at";
  let rows = null, canPayReferrals = false;
  for (const [cols, withReferrals] of [
    [BASE + REF + ", comped", true],
    [BASE + REF, true],
    [BASE + ", comped", false],
    [BASE, false],
  ]) {
    const { data, error } = await admin.from("user_state").select(cols);
    if (!error) { rows = data; canPayReferrals = withReferrals; break; }
  }
  if (!rows) return NextResponse.json({ error: "Could not read accounts." }, { status: 500 });

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

  const referrals = canPayReferrals
    ? await payReferrals(admin, rows || [])
    : { skipped: "referral columns not migrated yet" };
  return NextResponse.json({ ok: true, sent, skipped, failed, referrals });
}

/* Pays referrers whose friend has since shown they are real.

   Runs here rather than on its own schedule because this job already loads
   every row once a day, and a fourth cron entry is a fourth thing to go wrong
   quietly. */
async function payReferrals(admin, rows) {
  // Codes are unique, so one pass builds the lookup the payouts need.
  const byCode = new Map();
  rows.forEach((r) => { if (r.referral_code) byCode.set(r.referral_code, r); });

  let paid = 0, waiting = 0, failed = 0;
  for (const referred of rows) {
    if (!referred.referred_by || referred.referral_rewarded_at) continue;
    if (!qualifies(referred)) { waiting++; continue; }

    const referrer = byCode.get(referred.referred_by);
    // The referrer's account is gone, so there is nobody left to pay.
    if (!referrer || referrer.user_id === referred.user_id) continue;

    try {
      /* Stamped before paying, and only if it is still unstamped. A crash
         between the two loses a reward, which is recoverable by hand; paying
         first and crashing before the stamp would pay again tomorrow, and every
         tomorrow after that. */
      const { data: stamped } = await admin
        .from("user_state")
        .update({ referral_rewarded_at: new Date().toISOString() })
        .eq("user_id", referred.user_id)
        .is("referral_rewarded_at", null)
        .select("user_id");
      if (!stamped || stamped.length === 0) continue; // another run got there first

      await rewardReferrer(admin, referrer);
      paid++;
    } catch (e) {
      console.error("referral payout failed:", e?.message);
      failed++;
    }
  }
  return { paid, waiting, failed };
}
