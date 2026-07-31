import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, PRICE_ID } from "@/lib/stripe";

export const runtime = "nodejs";

const REWARD_DAYS = 30;
// Unambiguous alphabet: no O/0/I/1, so codes survive being read aloud or
// typed off a phone screen.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/* Give the referrer a month. Someone mid-trial gets 30 more days; a paying
   subscriber gets an account credit worth one month, since extending a trial
   they are no longer on would be worth nothing to them. */
async function rewardReferrer(admin, row) {
  const subscribed = row.subscription_status === "active" || row.subscription_status === "trialing";

  if (subscribed && row.stripe_customer_id) {
    try {
      const price = await stripe.prices.retrieve(PRICE_ID);
      const amount = price?.unit_amount || 0;
      if (amount > 0) {
        await stripe.customers.createBalanceTransaction(row.stripe_customer_id, {
          amount: -amount, // negative is a credit against future invoices
          currency: price.currency || "usd",
          description: "Soli referral reward: one month",
        });
        return "credit";
      }
    } catch (e) {
      console.error("referral credit failed, falling back to trial days:", e?.message);
    }
  }

  const base = Math.max(Date.now(), new Date(row.trial_ends_at || 0).getTime() || 0);
  await admin
    .from("user_state")
    .update({ trial_ends_at: new Date(base + REWARD_DAYS * 864e5).toISOString() })
    .eq("user_id", row.user_id);
  return "days";
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
      .select("referral_code, referral_count")
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

    return NextResponse.json({ code, count: row?.referral_count || 0 });
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

    const { data: referrer } = await admin
      .from("user_state")
      .select("user_id, trial_ends_at, subscription_status, stripe_customer_id, referral_count")
      .eq("referral_code", entered)
      .maybeSingle();
    if (!referrer) return NextResponse.json({ error: "That link isn't valid." }, { status: 400 });

    // Reward the new user first: a longer runway to actually try Soli.
    const myBase = Math.max(Date.now(), new Date(me.trial_ends_at || 0).getTime() || 0);
    const { error: claimErr } = await admin
      .from("user_state")
      .update({
        referred_by: entered,
        trial_ends_at: new Date(myBase + REWARD_DAYS * 864e5).toISOString(),
      })
      .eq("user_id", user.id)
      .is("referred_by", null); // guards against a double claim
    if (claimErr) throw claimErr;

    const rewardKind = await rewardReferrer(admin, referrer);
    await admin
      .from("user_state")
      .update({ referral_count: (referrer.referral_count || 0) + 1 })
      .eq("user_id", referrer.user_id);

    return NextResponse.json({ ok: true, rewardDays: REWARD_DAYS, rewardKind });
  } catch (e) {
    console.error("referral claim error:", e);
    return NextResponse.json({ error: "Could not apply that link." }, { status: 500 });
  }
}
