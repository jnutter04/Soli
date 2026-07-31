"use client";

import { useEffect, useState } from "react";

/* Registers the service worker and offers "add to home screen".
   Chrome and Android fire beforeinstallprompt so we can trigger the real
   installer. iOS Safari has no such event, so there it shows the manual steps
   instead of a button that could not work. */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume hidden until checked

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    let hidden = standalone;
    try { hidden = hidden || localStorage.getItem("soli-install-dismissed") === "1"; } catch {}
    setDismissed(hidden);
    if (hidden) return;

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem("soli-install-dismissed", "1"); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    close();
  };

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div className="soli-install">
      <div className="soli-installtext">
        <b>Add Soli to your home screen</b>
        <span>
          {deferred
            ? "Open it like an app, and log a client in two taps."
            : "Tap the Share button, then Add to Home Screen."}
        </span>
      </div>
      {deferred && <button className="soli-installbtn" onClick={install}>Install</button>}
      <button className="soli-installx" onClick={close} aria-label="Dismiss">&times;</button>
    </div>
  );
}
