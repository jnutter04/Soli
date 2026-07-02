import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Reflect a Stripe subscription onto the user's row (by Stripe customer id).
async function syncSubscription(admin, sub) {
  const status = sub.status; // active, trialing, past_due, canceled, ...
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  await admin
    .from("user_state")
    .update({ subscription_status: status, current_period_end: periodEnd })
    .eq("stripe_customer_id", sub.customer);
}

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const customerId = session.customer;
        // Make sure the customer id is stored, then sync the new subscription.
        if (userId && customerId) {
          await admin
            .from("user_state")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", userId);
        }
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(admin, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(admin, event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Webhook handling error:", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
