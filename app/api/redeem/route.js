import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/* Redeems a comp/promo code for free (complimentary) access. Valid codes live
   in the COMP_CODES env var (comma-separated). On success we set `comped` on
   the user's row via the admin client, so the Stripe reconcile never clears it. */
export async function POST(request) {
  try {
    const { code } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const valid = (process.env.COMP_CODES || "")
      .split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
    const entered = String(code || "").trim().toLowerCase();
    if (!entered || !valid.includes(entered)) {
      return NextResponse.json({ error: "That code isn't valid." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("user_state").update({ comped: true }).eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("redeem error:", e);
    return NextResponse.json({ error: e.message || "Could not redeem that code." }, { status: 500 });
  }
}
