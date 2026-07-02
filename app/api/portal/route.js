import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { data: row } = await supabase
      .from("user_state")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account yet." }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${origin}/app`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("portal error:", e);
    return NextResponse.json({ error: e.message || "Could not open billing." }, { status: 500 });
  }
}
