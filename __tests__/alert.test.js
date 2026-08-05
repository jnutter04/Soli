/* The error-alert budget, driven through the real sendAlert.

   /api/report-error accepts anonymous reports so a broken login or landing page
   still reaches us, which also means anyone can post to it in a loop. These
   check that a stranger cannot run up the mail bill or bury a real crash. */

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.RESEND_API_KEY = "test-key";
process.env.ALERT_EMAIL = "alerts@example.com";

// Counts sends without touching the network. sendAlert uses global fetch.
let sends = 0;
global.fetch = async () => { sends++; return { ok: true, text: async () => "" }; };

/* The limiter keeps its counters in module scope, so each test imports a fresh
   copy rather than inheriting the previous test's budget. */
let n = 0;
const freshAlert = async () => (await import(`../lib/alert.js?case=${n++}`)).sendAlert;

test("an anonymous flood is capped, even with a new message every time", async () => {
  // The fingerprint includes the message, which an untrusted caller chooses.
  // Varying it defeats the per-fingerprint cooldown, so the window count is the
  // only thing holding the line.
  const sendAlert = await freshAlert();
  sends = 0;
  for (let i = 0; i < 200; i++) {
    await sendAlert({ source: "client", message: `attack ${i}`, trusted: false });
  }
  assert.equal(sends, 3);
});

test("an anonymous flood cannot crowd out a real crash", async () => {
  const sendAlert = await freshAlert();
  sends = 0;
  for (let i = 0; i < 200; i++) {
    await sendAlert({ source: "client", message: `attack ${i}`, trusted: false });
  }
  const afterFlood = sends;

  for (let i = 0; i < 50; i++) {
    await sendAlert({ source: "server", message: `real bug ${i}`, trusted: true });
  }
  assert.equal(sends - afterFlood, 12, "the trusted budget must be untouched by the flood");
});

test("a crash loop alerts once, not once per crash", async () => {
  const sendAlert = await freshAlert();
  sends = 0;
  for (let i = 0; i < 50; i++) {
    await sendAlert({ source: "client", message: "the same crash", trusted: true });
  }
  assert.equal(sends, 1);
});

test("distinct real errors are each heard, up to the budget", async () => {
  const sendAlert = await freshAlert();
  sends = 0;
  for (let i = 0; i < 50; i++) {
    await sendAlert({ source: "server", message: `error ${i}`, trusted: true });
  }
  assert.equal(sends, 12);
});

test("reports default to trusted, so server-side callers are not throttled as strangers", async () => {
  const sendAlert = await freshAlert();
  sends = 0;
  for (let i = 0; i < 10; i++) {
    await sendAlert({ source: "server", message: `boot error ${i}` });
  }
  assert.equal(sends, 10);
});

test("nothing is sent when the mail key is missing", async () => {
  const sendAlert = await freshAlert();
  const saved = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  sends = 0;
  await sendAlert({ source: "server", message: "boom", trusted: true });
  assert.equal(sends, 0);
  process.env.RESEND_API_KEY = saved;
});
