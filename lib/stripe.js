import Stripe from "stripe";

/* Server-side Stripe client. STRIPE_SECRET_KEY is set in the environment
   (Vercel + local .env.local) and is never exposed to the browser. */
// Fallback keeps `next build` from crashing when the key isn't set locally;
// real requests on Vercel use the real STRIPE_SECRET_KEY.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_build_only");

export const PRICE_ID = process.env.STRIPE_PRICE_ID;
