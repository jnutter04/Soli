import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/* Stores or removes a browser's push subscription for the signed-in user.
   Subscriptions are per device, so one person can have a phone and a laptop.
   Matching on the endpoint keeps re-subscribing from creating duplicates. */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { subscription, action } = await request.json().catch(() => ({}));
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Missing subscription." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: row, error: readErr } = await admin
      .from("user_state").select("push_subs").eq("user_id", user.id).maybeSingle();
    if (readErr) {
      return NextResponse.json({ error: "notifications_not_ready" }, { status: 503 });
    }

    const current = Array.isArray(row?.push_subs) ? row.push_subs : [];
    const others = current.filter((s) => s?.endpoint !== subscription.endpoint);
    const next = action === "unsubscribe" ? others : [...others, subscription];

    const { error: writeErr } = await admin
      .from("user_state").update({ push_subs: next }).eq("user_id", user.id);
    if (writeErr) return NextResponse.json({ error: "notifications_not_ready" }, { status: 503 });

    return NextResponse.json({ ok: true, devices: next.length });
  } catch (e) {
    console.error("push subscribe error:", e);
    return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  }
}
