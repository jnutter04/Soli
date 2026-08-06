import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rentShrinksWithHours, serviceRows, scenario, marginalRate, rankByRate, headlineCandidate,
} from "../lib/workLess.js";

const day = 864e5;
const recent = (n = 1) => new Date(Date.now() - n * day).toISOString();
const since = Date.now() - 90 * day;

// $10/hr of booth, 25h weeks at $250, which is the shape most people are on.
const RENT = 10;

const logs = [
  // Lash fill: 2h, $160, $12 product -> good money
  { service: "Lash fill", date: recent(2), price: 160, productCost: 12, durationMin: 120, tip: 20 },
  { service: "Lash fill", date: recent(9), price: 160, productCost: 12, durationMin: 120, tip: 0 },
  // Brow tint: 1h, $35, $8 product -> thin
  { service: "Brow tint", date: recent(3), price: 35, productCost: 8, durationMin: 60, tip: 0 },
  { service: "Brow tint", date: recent(5), price: 35, productCost: 8, durationMin: 60, tip: 5 },
  { service: "Brow tint", date: recent(11), price: 35, productCost: 8, durationMin: 60, tip: 0 },
];

test("only hourly rent shrinks when you work less", () => {
  assert.equal(rentShrinksWithHours({ boothRentUnit: "hour" }), true);
  assert.equal(rentShrinksWithHours({ boothRentUnit: "week" }), false);
  assert.equal(rentShrinksWithHours({ boothRentUnit: "month" }), false);
  assert.equal(rentShrinksWithHours({}), true, "no unit set means the legacy hourly rate");
});

test("groups by service type with the figures a scenario needs", () => {
  const rows = serviceRows(logs, RENT, since);
  const brow = rows.find((r) => r.name === "Brow tint");
  assert.equal(brow.count, 3);
  assert.equal(brow.hours, 3);
  assert.equal(brow.revenue, 105);
  assert.equal(brow.product, 24);
  assert.equal(brow.tips, 5);
  assert.equal(brow.booth, 30);
});

test("ignores anything outside the window", () => {
  const old = [...logs, { service: "Old thing", date: new Date(Date.now() - 200 * day).toISOString(), price: 500, productCost: 0, durationMin: 60 }];
  assert.equal(serviceRows(old, RENT, since).find((r) => r.name === "Old thing"), undefined);
});

/* The core of it. On weekly rent the chair is paid for either way, so dropping
   brow tints gives back only price minus product; on hourly rent the freed
   hours genuinely stop costing. The two answers must differ. */
test("fixed rent does not come back when hours are freed", () => {
  const rows = serviceRows(logs, RENT, since);
  const fixed = scenario(rows, ["Brow tint"], { taxRate: 0, rentShrinks: false });
  // 105 revenue - 24 product = 81, plus 5 tips
  assert.equal(fixed.takeHomeLost, 86);
  assert.equal(fixed.hoursFreed, 3);
});

test("hourly rent does come back, so less is given up", () => {
  const rows = serviceRows(logs, RENT, since);
  const hourly = scenario(rows, ["Brow tint"], { taxRate: 0, rentShrinks: true });
  // 105 - 24 - 30 booth = 51, plus 5 tips
  assert.equal(hourly.takeHomeLost, 56);
});

test("the two rent shapes disagree, which is the point of the feature", () => {
  const rows = serviceRows(logs, RENT, since);
  const fixed = scenario(rows, ["Brow tint"], { rentShrinks: false });
  const hourly = scenario(rows, ["Brow tint"], { rentShrinks: true });
  assert.ok(fixed.takeHomeLost > hourly.takeHomeLost,
    "fixed rent must cost more to walk away from than hourly rent");
});

test("tax reduces what is given up, and tips are not taxed twice", () => {
  const rows = serviceRows(logs, RENT, since);
  const taxed = scenario(rows, ["Brow tint"], { taxRate: 25, rentShrinks: false });
  assert.equal(taxed.takeHomeLost, 81 * 0.75 + 5);
});

test("dropping nothing costs nothing and frees nothing", () => {
  const rows = serviceRows(logs, RENT, since);
  const none = scenario(rows, [], { taxRate: 25 });
  assert.equal(none.takeHomeLost, 0);
  assert.equal(none.hoursFreed, 0);
  assert.equal(none.perHourFreed, null, "no hours freed means there is no rate to quote");
});

test("services with no duration never produce an infinite rate", () => {
  const noTime = [{ service: "Consult", date: recent(1), price: 40, productCost: 0, durationMin: 0 }];
  const rows = serviceRows(noTime, RENT, since);
  assert.equal(scenario(rows, ["Consult"], {}).perHourFreed, null);
  assert.equal(marginalRate(rows[0], {}), null);
});

test("a service can look poor after its rent share and still be worth keeping", () => {
  // 1 hour, $35, $8 product, $10 rent share. Allocated profit is $17/hr, but
  // walking away from it on fixed rent gives up $27/hr.
  const rows = serviceRows([logs[2]], RENT, since);
  const allocated = (35 - 8 - 10) / 1;
  assert.equal(marginalRate(rows[0], { rentShrinks: false }), 27);
  assert.ok(marginalRate(rows[0], { rentShrinks: false }) > allocated,
    "the marginal figure must be the higher one, or the feature advises giving up money");
});

test("ranks worst-paying first", () => {
  const ranked = rankByRate(serviceRows(logs, RENT, since), { rentShrinks: false });
  assert.equal(ranked[0].name, "Brow tint");
  assert.equal(ranked[ranked.length - 1].name, "Lash fill");
});

test("rows with no hours sort last, never recommended first", () => {
  const mixed = [...logs, { service: "Consult", date: recent(1), price: 40, productCost: 0, durationMin: 0 }];
  const ranked = rankByRate(serviceRows(mixed, RENT, since), { rentShrinks: false });
  assert.equal(ranked[ranked.length - 1].name, "Consult");
  assert.equal(ranked[0].name, "Brow tint");
});

test("the headline ignores one-offs, which are not habits to restructure around", () => {
  const rows = serviceRows(logs, RENT, since);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const ranked = rankByRate(rows, { rentShrinks: false });
  assert.equal(headlineCandidate(ranked, totalHours).name, "Brow tint");

  // A single miserable job should not become the headline suggestion.
  const oneOff = [...logs, { service: "Favour for a friend", date: recent(1), price: 5, productCost: 0, durationMin: 180 }];
  const rows2 = serviceRows(oneOff, RENT, since);
  const ranked2 = rankByRate(rows2, { rentShrinks: false });
  assert.equal(ranked2[0].name, "Favour for a friend", "it is still the worst rate");
  assert.equal(headlineCandidate(ranked2, rows2.reduce((s, r) => s + r.hours, 0)).name, "Brow tint",
    "but the headline should be something they actually do repeatedly");
});

/* Working less is about time, so the headline follows the hours rather than
   the worst rate. A slightly better rate eating three times the week is the
   more useful thing to point at. */
test("the headline is the biggest time sink among the below-average earners", () => {
  const many = [];
  for (let w = 0; w < 12; w++) {
    // Pays worst, but barely happens. ($16 over 45 min is about $21/hr.)
    many.push({ service: "Removal", date: recent(w * 7 + 1), price: 20, productCost: 4, durationMin: 45 });
    // Pays almost as badly and eats far more of the week.
    many.push({ service: "Brow tint", date: recent(w * 7 + 2), price: 35, productCost: 8, durationMin: 60 });
    many.push({ service: "Brow tint", date: recent(w * 7 + 3), price: 35, productCost: 8, durationMin: 60 });
    many.push({ service: "Lash fill", date: recent(w * 7 + 4), price: 160, productCost: 12, durationMin: 120 });
  }
  const rows = serviceRows(many, RENT, since);
  const ranked = rankByRate(rows, { rentShrinks: false });
  const total = rows.reduce((s, r) => s + r.hours, 0);

  assert.equal(ranked[0].name, "Removal", "removal still has the worst rate");
  assert.equal(headlineCandidate(ranked, total).name, "Brow tint",
    "but brow tints are where the hours actually are");
});

test("no headline when everything pays about the same", () => {
  const even = [];
  for (let w = 0; w < 12; w++) {
    even.push({ service: "A", date: recent(w * 7 + 1), price: 100, productCost: 10, durationMin: 60 });
    even.push({ service: "B", date: recent(w * 7 + 2), price: 100, productCost: 10, durationMin: 60 });
  }
  const rows = serviceRows(even, RENT, since);
  assert.equal(headlineCandidate(rankByRate(rows, {}), rows.reduce((s, r) => s + r.hours, 0)), null,
    "with no weak spot there is nothing honest to point at");
});

test("no services at all yields no headline rather than a crash", () => {
  assert.equal(headlineCandidate(rankByRate([], {}), 0), null);
  assert.deepEqual(serviceRows([], RENT, since), []);
  assert.deepEqual(serviceRows(null, RENT, since), []);
});

test("dropping everything gives back every hour", () => {
  const rows = serviceRows(logs, RENT, since);
  const all = scenario(rows, rows.map((r) => r.name), { rentShrinks: false });
  assert.equal(all.hoursFreed, 7);
  // 425 revenue, 48 product, 25 tips, and none of the rent comes back.
  assert.equal(all.takeHomeLost, (425 - 48) + 25);
});
