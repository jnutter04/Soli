import webpush from "web-push";

/* Web push needs a VAPID keypair to prove messages really come from Soli.
   The keys are free and self-generated: there is no metered service here and
   no per-message cost. */
const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.ALERT_EMAIL || "trysoli.beauty@gmail.com";

export const pushReady = () => Boolean(PUBLIC && PRIVATE);

if (pushReady()) {
  webpush.setVapidDetails(`mailto:${CONTACT}`, PUBLIC, PRIVATE);
}

/* Sends one notification. Returns "gone" when the browser tells us the
   subscription is dead, so the caller can drop it instead of retrying forever
   and slowly filling every user's record with stale devices. */
export async function sendPush(subscription, payload) {
  if (!pushReady()) return "unconfigured";
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return "ok";
  } catch (e) {
    const code = e?.statusCode;
    if (code === 404 || code === 410) return "gone"; // unsubscribed or expired
    console.error("push send failed:", code, e?.body || e?.message);
    return "error";
  }
}
