import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlert } from "@/lib/alert";

export const runtime = "nodejs";

/* Daily self-check safety net. This runs on the same platform as the app, so it
   cannot detect a full outage (if Soli is down, this does not run either). Use
   an external uptime monitor against /api/health for that. What this DOES catch
   is the quieter stuff: an expired key, a database that stopped answering, or a
   missing environment variable after a deploy. */
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const problems = [];

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) problems.push(`Missing environment variables: ${missing.join(", ")}`);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("user_state").select("user_id", { count: "exact", head: true });
    if (error) problems.push(`Database query failed: ${error.message}`);
  } catch (e) {
    problems.push(`Database unreachable: ${e?.message || "unknown"}`);
  }

  if (problems.length) {
    await sendAlert({
      source: "daily healthcheck",
      message: `${problems.length} problem${problems.length > 1 ? "s" : ""} detected`,
      detail: problems.join("\n"),
    });
  }

  return NextResponse.json({ ok: problems.length === 0, problems });
}
