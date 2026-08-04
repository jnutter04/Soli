import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, pushReady } from "@/lib/push";

export const runtime = "nodejs";

/* Sends a notification to the signed-in user's own devices, right now.

   The scheduled nudge only fires when there is something worth saying, which
   is right for users but leaves no way to check the setup actually works. This
   gives an immediate, self-serve confirmation without waiting for a real
   trigger, and only ever messages the person who asked for it. */
export async function POST() {
  try {
    if (!pushReady()) {
      return NextResponse.json({ error: "Notifications are not configured on the server yet." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    let admin;
    try { admin = createAdminClient(); }
    catch { return NextResponse.json({ error: "Notifications are not configured on the server yet." }, { status: 503 }); }

    const { data: row, error } = await admin
      .from("user_state").select("push_subs").eq("user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Notifications are not set up yet." }, { status: 503 });

    const subs = Array.isArray(row?.push_subs) ? row.push_subs : [];
    if (subs.length === 0) {
      return NextResponse.json({ error: "No devices are set up yet. Turn notifications on first." }, { status: 400 });
    }

    const payload = {
      title: "Notifications are working",
      body: "This is a test from Soli. Real nudges only arrive when there is something worth telling you.",
      url: "/app",
      tag: "soli-test",
    };

    let sent = 0, pruned = 0;
    const alive = [];
    for (const sub of subs) {
      const res = await sendPush(sub, payload);
      if (res === "ok") { alive.push(sub); sent++; }
      else if (res === "gone") pruned++;
      else alive.push(sub);
    }
    if (alive.length !== subs.length) {
      await admin.from("user_state").update({ push_subs: alive }).eq("user_id", user.id);
    }

    if (sent === 0) {
      return NextResponse.json({ error: "Could not reach this device. Try turning notifications off and on again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sent, pruned });
  } catch (e) {
    console.error("push test error:", e);
    return NextResponse.json({ error: "Could not send the test." }, { status: 500 });
  }
}
