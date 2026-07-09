import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/* Reconcile the signed-in user's subscription status directly from Stripe.
   This is the source of truth, so it works even if a webhook was missed or
   misconfigured (e.g. right after switching to live mode). */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { data: row } = await supabase
      .from("user_state")
      .select("stripe_customer_id, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row?.stripe_customer_id) return NextResponse.json({ status: row?.subscription_status ?? null });

    const subs = await stripe.subscriptions.list({
      customer: row.stripe_customer_id,
      status: "all",
      limit: 5,
    });

    // Pick the "best" subscription so an old canceled one can't mask an active one.
    const rank = { active: 5, trialing: 4, past_due: 3, unpaid: 2, incomplete: 1, canceled: 0 };
    let best = null;
    for (const s of subs.data) {
      if (!best || (rank[s.status] ?? -1) > (rank[best.status] ?? -1)) best = s;
    }
    const status = best ? best.status : null;

    if (status !== row.subscription_status) {
      await supabase.from("user_state").update({ subscription_status: status }).eq("user_id", user.id);
    }

    return NextResponse.json({ status });
  } catch (e) {
    console.error("subscription sync error:", e);
    return NextResponse.json({ error: e.message || "Sync failed." }, { status: 500 });
  }
}
