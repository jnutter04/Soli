import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Real health check for an external uptime monitor to ping.
   Verifies the app is up AND that the database actually answers, so a silent
   database outage still shows as "down" instead of a page that loads but
   can't save anyone's work. Returns 200 when healthy, 503 when not. */
export async function GET() {
  const checks = { app: "ok", env: "ok", database: "ok" };
  let healthy = true;

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) { checks.env = `missing: ${missing.join(", ")}`; healthy = false; }

  const started = Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("user_state").select("user_id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
  } catch (e) {
    checks.database = `error: ${e?.message || "unreachable"}`;
    healthy = false;
  }

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, dbMs: Date.now() - started, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
