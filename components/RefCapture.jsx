"use client";

import { useEffect } from "react";

/* Remembers a ?ref= code from a shared link so it can be claimed after the
   person signs up. Stored locally only; nothing is sent until they have an
   account, and the code is cleared once claimed. */
export default function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref) return;
      const clean = ref.trim().toUpperCase().slice(0, 12);
      if (/^[A-Z0-9]{4,12}$/.test(clean)) localStorage.setItem("soli-ref", clean);
    } catch { /* private mode or storage disabled: referral simply won't apply */ }
  }, []);
  return null;
}
