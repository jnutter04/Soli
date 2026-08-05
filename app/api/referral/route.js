import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REWARD_DAYS } from "@/lib/referralReward";

export const runtime = "nodejs";

// Unambiguous alphabet: no O/0/I/1, so codes survive being read aloud or
// typed off a phone screen.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/* Returns the signed-in user's referral code and stats, creating a code on
   first call. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("user_state")
      .select("referral_code")
      .eq("user_id", user.id)
      .maybeSingle();

    let code = row?.referral_code;
    if (!code) {
      // Retry on the unique constraint in the unlikely event of a collision.
      for (let i = 0; i < 5 && !code; i++) {
        const candidate = makeCode();
        const { error } = await admin
          .from("user_state")
          .update({ referral_code: candidate })
          .eq("user_id", user.id);
        if (!error) code = candidate;
      }
    }

    /* Counted from the accounts that actually used the code rather than from a
       stored tally. Two people signing up at once each read the old total and
       wrote the same new one, so a running counter lost referrals; this cannot.
       referral_count is left in the table but no longer read or written.

       Split into paid and pending, because a reward now arrives days after the
       friend joins. Without showing the pending ones the panel would look like
       nothing happened, and a referral scheme that appears broken stops being
       shared. */
    let count = 0, pending = 0;
    if (code) {
      const { data: joined, error: joinErr } = await admin
        .from("user_state")
        .select("referral_rewarded_at")
        .eq("referred_by", code);

      if (joinErr) {
        // Before the migration there is no paid/pending split to show, so fall
        // back to a plain count rather than reporting nobody joined.
        const { count: total } = await admin
          .from("user_state")
          .select("user_id", { count: "exact", head: true })
          .eq("referred_by", code);
        count = total || 0;
      } else {
        count = (joined || []).filter((r) => r.referral_rewarded_at).length;
        pending = (joined || []).length - count;
      }
    }

    return NextResponse.json({ code, count, pending });
  } catch (e) {
    console.error("referral GET error:", e);
    return NextResponse.json({ error: "Could not load your referral link." }, { status: 500 });
  }
}

/* Claims a referral code for the signed-in user. Runs once per account. */
export async function POST(request) {
  try {
    const { code } = await request.json();
    const entered = String(code || "").trim().toUpperCase();
    if (!entered) return NextResponse.json({ error: "No code given." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const admin = createAdminClient();

    const { data: me } = await admin
      .from("user_state")
      .select("user_id, referred_by, referral_code, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!me) return NextResponse.json({ error: "Account not ready yet." }, { status: 400 });
    if (me.referred_by) return NextResponse.json({ ok: true, already: true });
    if (me.referral_code === entered) {
      return NextResponse.json({ error: "You can't use your own link." }, { status: 400 });
    }

    // Only checked to be real. Who they are matters at payout time, not now.
    const { data: referrer } = await admin
      .from("user_state")
      .select("user_id")
      .eq("referral_code", entered)
      .maybeSingle();
    if (!referrer) return NextResponse.json({ error: "That link isn't valid." }, { status: 400 });

    // Reward the new user first: a longer runway to actually try Soli.
    const myBase = Math.max(Date.now(), new Date(me.trial_ends_at || 0).getTime() || 0);
    const { data: claimed, error: claimErr } = await admin
      .from("user_state")
      .update({
        referred_by: entered,
        trial_ends_at: new Date(myBase + REWARD_DAYS * 864e5).toISOString(),
      })
      .eq("user_id", user.id)
      .is("referred_by", null) // guards against a double claim
      .select("user_id");
    if (claimErr) throw claimErr;

    /* The guard above only protects the claim, not what follows it. An update
       that matches nothing is not an error, so without this check two requests
       arriving together both sail on and reward the referrer twice, which for a
       subscriber is twice a real invoice credit. Zero rows means someone else
       already claimed this account, and the reward has been paid once. */
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: true, already: true });

    /* The referrer is not paid here. Signing up costs nothing, so paying on
       signup paid for throwaway accounts; the daily job pays once this account
       shows a person is behind it. See lib/referralReward.js. */
    return NextResponse.json({ ok: true, rewardDays: REWARD_DAYS });
  } catch (e) {
    console.error("referral claim error:", e);
    return NextResponse.json({ error: "Could not apply that link." }, { status: 500 });
  }
}
