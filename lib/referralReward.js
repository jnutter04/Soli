/* Paying a referral.

   The reward used to land the moment a code was entered, which meant a
   throwaway email was worth a month. For a referrer who already subscribes
   that is not trial time, it is a real credit against a real invoice, so a
   handful of fake signups paid for a year of Soli.

   So the referrer is paid only once the referred account shows a person is
   using it. The referred person still gets their extra days immediately: that
   is the reason to sign up, and trial time on an account that may never convert
   costs nothing real. */

import { stripe, PRICE_ID } from "./stripe.js";

export const REWARD_DAYS = 30;
export const QUALIFY_SERVICES = 5;

/* Five logged services cannot be faked cheaply. It means opening the app on
   separate occasions and entering real prices, durations and product costs;
   anyone willing to do that repeatedly has become an actual user, which is a
   fine outcome. Subscribing counts on its own, since the reward then comes out
   of revenue just received. */
export function qualifies(referred) {
  const sub = referred?.subscription_status;
  if (sub === "active" || sub === "trialing") return true;
  return (referred?.logs?.length || 0) >= QUALIFY_SERVICES;
}

/* Give the referrer a month. Someone mid-trial gets 30 more days; a paying
   subscriber gets an account credit worth one month, since extending a trial
   they are no longer on would be worth nothing to them. */
export async function rewardReferrer(admin, row) {
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
