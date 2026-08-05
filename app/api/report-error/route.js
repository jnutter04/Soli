import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAlert } from "@/lib/alert";

export const runtime = "nodejs";

/* Receives client-side crashes from the browser and alerts the operator.
   Always answers 200 so a reporting failure never cascades into more errors
   in the user's browser. Payload is truncated and the sender is not trusted. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body?.message || "Unknown client error").slice(0, 300);
    const detail = String(body?.stack || "").slice(0, 3000);
    const url = String(body?.url || "").slice(0, 300);

    let userId = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch { /* anonymous report is still worth having */ }

    /* A signed-in report came from someone we can identify and is worth the
       normal allowance. An anonymous one may equally be a stranger posting to
       this endpoint in a loop, so it draws on the smaller budget instead. */
    await sendAlert({
      source: body?.source === "boundary" ? "client (render crash)" : "client",
      message, detail, url, userId, trusted: !!userId,
    });
  } catch (e) {
    console.error("report-error failed:", e?.message);
  }
  return NextResponse.json({ ok: true });
}
