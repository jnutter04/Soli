import Stripe from "stripe";

/* Server-side Stripe client. STRIPE_SECRET_KEY is set in the environment
   (Vercel + local .env.local) and is never exposed to the browser. */
// Fallback keeps `next build` from crashing when the key isn't set locally;
// real requests on Vercel use the real STRIPE_SECRET_KEY.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_build_only");

export const PRICE_ID = process.env.STRIPE_PRICE_ID;
export const PRICE_ID_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL;

/* Resolve a plan choice to a Stripe price. Falls back to monthly so a missing
   annual price can never send someone to a broken checkout. */
export function priceFor(plan) {
  return plan === "annual" && PRICE_ID_ANNUAL ? PRICE_ID_ANNUAL : PRICE_ID;
}
