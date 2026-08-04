import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, pushReady } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Distinct days seen, so an appointment covering several services counts once. */
function visitDays(logs) {
  const days = new Set();
  (logs || []).forEach((l) => {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0); days.add(d.getTime());
  });
  return [...days].sort((a, b) => a - b);
}

/* Same rule the app uses: judge a client against their own rhythm, ignore
   anyone too far gone to be worth chasing. */
function isSlipping(logs) {
  const days = visitDays(logs);
  if (days.length < 3) return false;
  const gaps = [];
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  const usual = median / 864e5;
  if (usual < 1) return false;
  const ratio = ((Date.now() - days[days.length - 1]) / 864e5) / usual;
  return ratio >= 1.4 && ratio < 3.5;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!pushReady()) {
    return NextResponse.json({ error: "VAPID keys not set" }, { status: 500 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Missing server keys should read as a clear misconfiguration, not a crash.
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY not set" }, { status: 500 });
  }

  const { data: rows, error } = await admin
    .from("user_state")
    .select("user_id, logs, clients, settings, push_subs");
  if (error) {
    // Most likely the push_subs column has not been added yet.
    return NextResponse.json({ error: error.message, hint: "run the push_subs migration" }, { status: 503 });
  }

  let sent = 0, skipped = 0, pruned = 0;

  for (const row of rows || []) {
    try {
      const subs = Array.isArray(row.push_subs) ? row.push_subs : [];
      const s = row.settings || {};
      if (subs.length === 0 || s.pushNudge === false) { skipped++; continue; }

      const logs = row.logs || [];
      const clients = row.clients || [];

      const slipping = clients.filter((c) =>
        isSlipping(logs.filter((l) => l.clientId === c.id))
      ).length;

      const lastLog = logs.reduce((m, l) => Math.max(m, new Date(l.date).getTime()), 0);
      const quietDays = lastLog ? Math.floor((Date.now() - lastLog) / 864e5) : null;

      // Only interrupt someone when there is a real reason. Anyone who has
      // logged recently and has nobody drifting is left alone: notifications
      // that arrive with nothing to say are the fastest way to lose permission.
      let payload = null;
      if (slipping > 0) {
        payload = {
          title: slipping === 1 ? "1 client is slipping away" : `${slipping} clients are slipping away`,
          body: "They are overdue against their usual rhythm. A quick text usually brings them back.",
          url: "/app",
          tag: "soli-slipping",
        };
      } else if (quietDays !== null && quietDays >= 7) {
        payload = {
          title: "Log this week's work",
          body: "A couple of minutes and you will see what you actually kept.",
          url: "/app",
          tag: "soli-weekly",
        };
      }

      if (!payload) { skipped++; continue; }

      const alive = [];
      for (const sub of subs) {
        const res = await sendPush(sub, payload);
        if (res === "ok") { alive.push(sub); sent++; }
        else if (res === "gone") pruned++;      // drop dead devices
        else alive.push(sub);                    // transient failure, keep it
      }
      if (alive.length !== subs.length) {
        await admin.from("user_state").update({ push_subs: alive }).eq("user_id", row.user_id);
      }
    } catch (e) {
      console.error("push nudge failed for a user:", e?.message);
    }
  }

  return NextResponse.json({ sent, skipped, pruned });
}
