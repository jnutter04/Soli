"use client";

import { useEffect } from "react";

/* Registers the service worker site-wide. Kept separate from the install
   prompt so offline support and installability are available from the first
   page someone lands on, not only after they sign in. */
export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support simply won't apply */
    });
  }, []);
  return null;
}
