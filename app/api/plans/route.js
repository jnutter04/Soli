import { NextResponse } from "next/server";
import { stripe, PRICE_ID, PRICE_ID_ANNUAL } from "@/lib/stripe";

export const runtime = "nodejs";

/* Reads the live prices from Stripe rather than hardcoding them, so the app can
   never advertise a figure different from what the customer is actually charged.
   If the annual price is not configured, only monthly comes back and the UI
   simply does not offer a yearly option. */
const fmt = (amount, currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format((amount || 0) / 100);

async function load(id, plan) {
  if (!id) return null;
  try {
    const p = await stripe.prices.retrieve(id);
    if (!p || p.active === false) return null;
    const amount = p.unit_amount;
    const currency = p.currency;
    const interval = p.recurring?.interval || (plan === "annual" ? "year" : "month");
    return { plan, amount, currency, interval, label: fmt(amount, currency) };
  } catch {
    return null;
  }
}

export async function GET() {
  const [monthly, annual] = await Promise.all([
    load(PRICE_ID, "monthly"),
    load(PRICE_ID_ANNUAL, "annual"),
  ]);

  // Only claim a saving when both prices are real and the maths genuinely works.
  let savingPct = null, perMonth = null;
  if (monthly?.amount > 0 && annual?.amount > 0 && monthly.currency === annual.currency) {
    const yearlyIfMonthly = monthly.amount * 12;
    if (annual.amount < yearlyIfMonthly) {
      savingPct = Math.round(((yearlyIfMonthly - annual.amount) / yearlyIfMonthly) * 100);
    }
    perMonth = fmt(Math.round(annual.amount / 12), annual.currency);
  }

  return NextResponse.json({ monthly, annual, savingPct, perMonth });
}
