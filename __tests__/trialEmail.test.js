/* The trial-ending warning.

   Which day it fires on carries the whole feature: fire twice and it nags, fire
   never and someone meets the paywall unwarned. There is no "already warned"
   flag to fall back on, so the day arithmetic has to be right on its own. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLeft, shouldWarn, trialSummary, emailHtml } from "../lib/trialEmail.js";

const END = new Date("2026-08-19T12:00:00Z").getTime();

/* Walks a whole trial one daily run at a time and records the warnings sent.
   jitterMs shifts alternate runs to imitate scheduler drift. */
function runTrial(firstRunIso, jitterMs = 0) {
  const out = [];
  for (let d = 0; d <= 15; d++) {
    const runAt = new Date(firstRunIso).getTime() + d * 864e5 + (d % 2 ? jitterMs : 0);
    const n = daysLeft(new Date(END).toISOString(), runAt);
    if (shouldWarn(n)) out.push(n);
  }
  return out;
}

test("a trial produces exactly two warnings, at three days and at one", () => {
  assert.deepEqual(runTrial("2026-08-05T09:00:00Z"), [3, 1]);
});

test("no repeat and no miss, whatever hour the job is scheduled for", () => {
  for (const hour of ["00", "06", "11", "13", "18", "23"]) {
    assert.deepEqual(runTrial(`2026-08-05T${hour}:00:00Z`), [3, 1], `failed at ${hour}:00`);
  }
});

test("a few minutes of scheduler drift changes nothing", () => {
  assert.deepEqual(runTrial("2026-08-05T09:00:00Z", 4 * 60e3), [3, 1]);
});

test("days are counted the same way the in-app countdown counts them", () => {
  // The bar and the email must never disagree about how long is left.
  const now = new Date("2026-08-05T09:00:00Z").getTime();
  assert.equal(daysLeft("2026-08-08T09:00:00Z", now), 3);
  assert.equal(daysLeft("2026-08-05T21:00:00Z", now), 1); // part of a day still counts
  assert.equal(daysLeft("2026-08-01T09:00:00Z", now), 0); // already over, never negative
  assert.equal(daysLeft(null), null);
  assert.equal(daysLeft("not a date"), null);
});

test("only three and one trigger a warning", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7, 14].filter(shouldWarn), [3, 1].sort((a, b) => a - b));
});

test("the summary works out take-home after product and booth rent", () => {
  const row = {
    settings: { currency: "USD", boothRentUnit: "week", boothRentAmount: 250, boothRentHoursPerWeek: 25, taxRate: 25 },
    logs: [
      { price: 160, productCost: 12, durationMin: 90 }, // booth 10/hr over 1.5h = 15
      { price: 90, productCost: 8, durationMin: 60 },   // booth 10
    ],
  };
  const t = trialSummary(row);
  assert.equal(t.profit, (160 - 12 - 15) + (90 - 8 - 10));
  assert.equal(t.tax, t.profit * 0.25);
  assert.equal(t.perHour, t.profit / 2.5);
  assert.equal(t.services, 2);
});

test("no hours logged means no hourly rate is quoted", () => {
  // Imported services often arrive with no duration. Dividing by zero here put
  // "$Infinity/hr" in front of someone deciding whether to pay.
  const t = trialSummary({ settings: {}, logs: [{ price: 100, productCost: 0, durationMin: 0 }] });
  assert.equal(t.perHour, null);
  assert.equal(t.profit, 100);
  assert.ok(!/Infinity|NaN/.test(emailHtml({ days: 3, endLabel: "Friday", t })));
});

test("a loss is not dressed up as tax owed", () => {
  const t = trialSummary({
    settings: { taxRate: 25 },
    logs: [{ price: 20, productCost: 60, durationMin: 60 }],
  });
  assert.ok(t.profit < 0);
  assert.equal(t.tax, 0, "there is no tax on a loss");
});

test("an account that logged nothing gets different copy", () => {
  // Showing a $0 total to someone who never started reads as a form letter.
  const html = emailHtml({ days: 3, endLabel: "Friday, August 8", t: trialSummary({ settings: {}, logs: [] }) });
  assert.ok(!html.includes("kept after costs"), "no numbers block");
  assert.ok(html.includes("Log a service"), "should nudge them to start");
});

test("an account that did the work leads with its own figures", () => {
  const t = trialSummary({ settings: {}, logs: [{ price: 160, productCost: 12, durationMin: 90 }] });
  const html = emailHtml({ days: 1, endLabel: "Friday, August 8", t });
  assert.ok(html.includes("kept after costs"));
  assert.ok(html.includes("ends tomorrow"));
  assert.ok(html.includes("Keep Soli"));
});

test("the email says plainly that nothing is deleted", () => {
  // The whole point of warning early is that the wall reads as a decision
  // rather than as losing your records.
  const t = trialSummary({ settings: {}, logs: [{ price: 100, productCost: 0, durationMin: 60 }] });
  assert.ok(emailHtml({ days: 3, endLabel: "Friday", t }).includes("Nothing is deleted"));
});

test("the copy carries no em dashes", () => {
  const worked = trialSummary({ settings: {}, logs: [{ price: 100, productCost: 0, durationMin: 60 }] });
  const empty = trialSummary({ settings: {}, logs: [] });
  const html = emailHtml({ days: 3, endLabel: "Friday", t: worked }) + emailHtml({ days: 1, endLabel: "Friday", t: empty });
  assert.ok(!html.includes("—"));
});

test("currency follows the account's own setting", () => {
  const t = trialSummary({ settings: { currency: "GBP" }, logs: [{ price: 100, productCost: 0, durationMin: 60 }] });
  assert.equal(t.sym, "£");
  assert.ok(emailHtml({ days: 3, endLabel: "Friday", t }).includes("£100"));
});
