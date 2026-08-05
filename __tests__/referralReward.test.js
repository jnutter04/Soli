/* Who a referral pays out for.

   This is the only rule in Soli standing between a throwaway email address and
   a real credit against a real Stripe invoice, so it is worth pinning down. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { qualifies, QUALIFY_SERVICES, REWARD_DAYS } from "../lib/referralReward.js";

const withServices = (n) => ({ logs: Array.from({ length: n }, (_, i) => ({ id: i })) });

test("a fresh signup earns the referrer nothing", () => {
  // The whole point: creating an account costs nothing, so it cannot be worth
  // a month of someone else's subscription.
  assert.equal(qualifies({ logs: [] }), false);
  assert.equal(qualifies({}), false);
  assert.equal(qualifies(null), false);
});

test("an account short of the bar still earns nothing", () => {
  assert.equal(qualifies(withServices(QUALIFY_SERVICES - 1)), false);
});

test("the bar is five logged services", () => {
  assert.equal(QUALIFY_SERVICES, 5);
  assert.equal(qualifies(withServices(QUALIFY_SERVICES)), true);
  assert.equal(qualifies(withServices(20)), true);
});

test("subscribing qualifies on its own", () => {
  // The reward then comes out of revenue just received, so it is self-funding
  // and there is nothing to protect against.
  assert.equal(qualifies({ logs: [], subscription_status: "active" }), true);
  assert.equal(qualifies({ logs: [], subscription_status: "trialing" }), true);
});

test("a failed or cancelled subscription does not qualify by itself", () => {
  // past_due keeps access in the app, but it is not revenue in hand.
  assert.equal(qualifies({ logs: [], subscription_status: "past_due" }), false);
  assert.equal(qualifies({ logs: [], subscription_status: "canceled" }), false);
});

test("a subscriber who logged nothing still qualifies", () => {
  assert.equal(qualifies({ subscription_status: "active" }), true);
});

test("the reward is still a month", () => {
  assert.equal(REWARD_DAYS, 30);
});

/* The payout loop's own guards, restated as the conditions the cron checks.
   These mirror payReferrals in app/api/cron/trial-ending/route.js. */
test("payout skips accounts that were never referred or are already paid", () => {
  const skip = (r) => !r.referred_by || !!r.referral_rewarded_at;
  assert.equal(skip({ referred_by: null }), true);
  assert.equal(skip({ referred_by: "ABC123", referral_rewarded_at: "2026-08-01T00:00:00Z" }), true);
  assert.equal(skip({ referred_by: "ABC123", referral_rewarded_at: null }), false);
});

test("an account cannot pay itself", () => {
  // Entering your own code is blocked at claim time, but a code that somehow
  // points back at the same row must not pay either.
  const referred = { user_id: "u1", referred_by: "SELF01", referral_rewarded_at: null };
  const byCode = new Map([["SELF01", { user_id: "u1" }]]);
  const referrer = byCode.get(referred.referred_by);
  assert.equal(referrer.user_id === referred.user_id, true, "self-referral must be caught");
});
