import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/* Permanently deletes the signed-in user's account and data.
   Order matters: cancel billing first, because a deleted account that still has
   a live subscription would keep being charged with no way to sign in and stop it. */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const admin = createAdminClient();

    const { data: row } = await admin
      .from("user_state")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // 1. Stop any billing. Never leave a charge running on a deleted account.
    const customerId = row?.stripe_customer_id;
    if (customerId) {
      try {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
        for (const s of subs.data) {
          if (["active", "trialing", "past_due", "unpaid", "paused"].includes(s.status)) {
            await stripe.subscriptions.cancel(s.id);
          }
        }
      } catch (e) {
        // If billing cannot be stopped, refuse to delete rather than orphan a
        // paying customer who can no longer reach their own billing portal.
        console.error("account delete: could not cancel subscription", e);
        return NextResponse.json(
          { error: "We could not cancel your subscription automatically. Please cancel in Manage billing first, or email trysoli.beauty@gmail.com and we will handle it." },
          { status: 500 }
        );
      }
    }

    // 2. Delete the login. user_state has "on delete cascade" against auth.users,
    //    so the data goes with it in one step. Deleting the row separately first
    //    could leave data gone but the login alive if the second call failed.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error(delErr.message);

    // 3. Belt and braces: clear any row the cascade somehow left behind.
    try { await admin.from("user_state").delete().eq("user_id", user.id); } catch { /* already gone */ }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Log the real reason for alerting, but never show internals to the user.
    console.error("account delete error:", e);
    return NextResponse.json(
      { error: "Something went wrong on our side and your account was not deleted. Please try again, or email trysoli.beauty@gmail.com and we will take care of it." },
      { status: 500 }
    );
  }
}
