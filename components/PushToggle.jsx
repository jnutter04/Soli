"use client";

import { useEffect, useState } from "react";

/* Turning notifications on is deliberately a button the user presses, never an
   automatic prompt on load. A prompt fired before anyone knows what Soli is
   gets denied, and a denial is permanent until they dig into browser settings. */

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [installHint, setInstallHint] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    // On iPhone, push only works once Soli has been added to the home screen.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    setInstallHint(isIOS && !standalone);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  const send = async (subscription, action) => {
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, action }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "failed");
    return d;
  };

  const enable = async () => {
    setBusy(true); setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNote(permission === "denied"
          ? "Your browser is blocking notifications for Soli. You can allow them in its site settings."
          : "Notifications were not enabled.");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      await send(sub.toJSON(), "subscribe");
      setEnabled(true);
      setNote("Notifications are on for this device.");
    } catch (e) {
      setNote(e.message === "notifications_not_ready"
        ? "Notifications need one more setup step on the server. Nothing is lost, try again shortly."
        : "Could not turn notifications on for this device.");
    }
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setNote(r.ok
        ? `Sent to ${d.sent} ${d.sent === 1 ? "device" : "devices"}. It should appear in a moment.`
        : d.error || "Could not send the test.");
    } catch {
      setNote("Could not reach the server.");
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true); setNote("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await send(sub.toJSON(), "unsubscribe");
        await sub.unsubscribe();
      }
      setEnabled(false);
      setNote("Notifications are off for this device.");
    } catch {
      setNote("Could not turn notifications off.");
    }
    setBusy(false);
  };

  /* Renders as a section inside the caller's block rather than as a block of
     its own: push and the weekly email are both "how Soli reaches you", and
     sitting them next to each other under one heading stopped them reading as
     two unrelated features. Returns nothing where push is unavailable, so the
     surrounding block still shows the email option on its own. */
  if (!supported) return null;

  return (
    <div className="soli-subblock">
      <div className="soli-subhead">Push notifications</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        An occasional nudge when a regular is drifting, or when it has been a while since you logged anything. Nothing is sent when there is nothing to say.
      </p>
      {installHint && (
        <p className="soli-help">On iPhone, add Soli to your home screen first. Notifications cannot be delivered to Safari tabs.</p>
      )}
      {enabled
        ? <button className="soli-ghost" onClick={disable} disabled={busy}>{busy ? "One moment…" : "Turn off on this device"}</button>
        : <button className="soli-cta sm" onClick={enable} disabled={busy}>{busy ? "One moment…" : "Turn on notifications"}</button>}
      {enabled && (
        <button className="soli-ghost" style={{ marginTop: 10 }} onClick={sendTest} disabled={busy}>
          {busy ? "One moment…" : "Send a test notification"}
        </button>
      )}
      {note && <p className="soli-help">{note}</p>}
    </div>
  );
}
