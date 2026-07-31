"use client";

import { useEffect } from "react";

/* Registers the service worker site-wide. Kept separate from the install
   prompt so offline support and installability are available from the first
   page someone lands on, not only after they sign in. */
export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Skip in development. Dev reuses /_next/static chunk URLs between rebuilds,
    // so the cache-first rule for static assets serves stale app code and edits
    // appear not to land. Production filenames are content-hashed, so caching
    // there is safe. Also tear down any worker left over from a dev session.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .then(() => (window.caches ? caches.keys() : []))
        .then((keys) => Promise.all((keys || []).map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support simply won't apply */
    });
  }, []);
  return null;
}
