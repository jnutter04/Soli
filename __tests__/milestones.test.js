import { test } from "node:test";
import assert from "node:assert/strict";
import { bestMonthSoFar, shouldOfferShare } from "../lib/milestones.js";

const m = (key, value) => ({ key, value });

test("a beaten record is a milestone", () => {
  const hit = bestMonthSoFar([m("2026-06", 2100), m("2026-07", 2650), m("2026-08", 3081)]);
  assert.equal(hit.kind, "bestMonth");
  assert.equal(hit.key, "2026-08");
  assert.equal(hit.value, 3081);
  assert.equal(hit.previousBest, 2650);
  assert.equal(hit.beatBy, 431);
});

test("the record must be beaten by the month in progress, not an earlier one", () => {
  // August is good, but July was better. Nothing to celebrate.
  assert.equal(bestMonthSoFar([m("2026-06", 2100), m("2026-07", 3400), m("2026-08", 3081)]), null);
});

test("matching the old record is not beating it", () => {
  assert.equal(bestMonthSoFar([m("2026-07", 3081), m("2026-08", 3081)]), null);
});

test("a first month is not a record", () => {
  // Nothing to compare against. Claiming a best month here would be hollow.
  assert.equal(bestMonthSoFar([m("2026-08", 4200)]), null);
  assert.equal(bestMonthSoFar([]), null);
});

test("a month that kept nothing is never a milestone", () => {
  assert.equal(bestMonthSoFar([m("2026-07", 2000), m("2026-08", 0)]), null);
});

test("a losing month is never a milestone", () => {
  // Costs outran income. Beating a previous loss is not worth a story post.
  assert.equal(bestMonthSoFar([m("2026-07", -400), m("2026-08", -50)]), null);
});

test("beating only months that kept nothing does not count", () => {
  assert.equal(bestMonthSoFar([m("2026-06", 0), m("2026-07", 0), m("2026-08", 900)]), null);
});

test("gaps in tracking do not break the comparison", () => {
  const hit = bestMonthSoFar([m("2026-02", 1800), m("2026-08", 1900)]);
  assert.equal(hit.previousBest, 1800);
  assert.equal(hit.beatBy, 100);
});

test("bad input is ignored rather than guessed at", () => {
  assert.equal(bestMonthSoFar(null), null);
  assert.equal(bestMonthSoFar(undefined), null);
  assert.equal(bestMonthSoFar([null, m("2026-08", 100)]), null);
});

test("the offer appears once and then stays quiet for that month", () => {
  const months = [m("2026-07", 2650), m("2026-08", 3081)];
  assert.ok(shouldOfferShare({ months, promptedFor: null }));
  // Already asked about August, so it does not ask again.
  assert.equal(shouldOfferShare({ months, promptedFor: "2026-08" }), null);
  // Having declined July does not silence a new August record.
  assert.ok(shouldOfferShare({ months, promptedFor: "2026-07" }));
});

test("a new record next month reopens the offer", () => {
  const sept = [m("2026-07", 2650), m("2026-08", 3081), m("2026-09", 3400)];
  assert.ok(shouldOfferShare({ months: sept, promptedFor: "2026-08" }));
});
