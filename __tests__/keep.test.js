import { test } from "node:test";
import assert from "node:assert/strict";
import { whatYouKeep } from "../lib/keep.js";

const near = (got, want, msg) => assert.ok(Math.abs(got - want) < 0.005, `${msg}: got ${got}, want ${want}`);

/* A 90 minute service at $160, $12 of product, $250 a week for 25 hours.
   Rent is $10/hr, so 1.5 hours of chair costs $15. */
const BASE = { price: 160, productCost: 12, minutes: 90, rentAmount: 250, rentUnit: "week", hoursPerWeek: 25, taxRate: 25 };

test("works the service through to what is left", () => {
  const r = whatYouKeep(BASE);
  near(r.rentPerHour, 10, "rent per hour");
  near(r.booth, 15, "booth cost");
  near(r.beforeTax, 133, "before tax");
  near(r.tax, 33.25, "tax");
  near(r.kept, 99.75, "kept");
});

test("the parts add back up to the price", () => {
  const r = whatYouKeep(BASE);
  near(r.product + r.booth + r.tax + r.kept, r.revenue, "parts vs price");
});

test("monthly rent converts through the year, not by four", () => {
  // 1084/month over 25h weeks is 1084*12/52/25, not 1084/4/25.
  const r = whatYouKeep({ ...BASE, rentAmount: 1084, rentUnit: "month" });
  near(r.rentPerHour, (1084 * 12 / 52) / 25, "monthly conversion");
});

test("an hourly rate is taken as given", () => {
  const r = whatYouKeep({ ...BASE, rentAmount: 14, rentUnit: "hour" });
  near(r.rentPerHour, 14, "hourly rate");
  near(r.booth, 21, "1.5h at 14");
});

test("no booth rent is a real answer, not a broken one", () => {
  const r = whatYouKeep({ ...BASE, rentAmount: 0 });
  near(r.booth, 0, "no booth cost");
  near(r.beforeTax, 148, "price less product only");
});

test("a service that loses money reports the loss", () => {
  // $40 for two hours of chair at $10, plus $90 of product.
  const r = whatYouKeep({ ...BASE, price: 40, productCost: 90, minutes: 120 });
  near(r.beforeTax, -70, "before tax");
  assert.equal(r.tax, 0, "no tax is owed on a loss");
  near(r.kept, -70, "the loss stands");
});

test("no tax rate means nothing is set aside", () => {
  const r = whatYouKeep({ ...BASE, taxRate: 0 });
  assert.equal(r.tax, 0);
  near(r.kept, 133, "kept equals before tax");
});

test("an hourly rate needs hours on the clock", () => {
  // Imported and quick-logged services often carry no duration.
  const r = whatYouKeep({ ...BASE, minutes: 0 });
  assert.equal(r.keptPerHour, null, "no rate can be quoted");
  assert.equal(r.booth, 0, "no chair time to charge for");
});

test("reports the share of the price that survives", () => {
  const r = whatYouKeep(BASE);
  near(r.keptShare, 99.75 / 160, "kept share");
  assert.equal(whatYouKeep({ ...BASE, price: 0 }).keptShare, null, "no share of nothing");
});

test("empty and junk inputs produce zeroes, never NaN", () => {
  for (const bad of [{}, { price: "", productCost: "", minutes: "", taxRate: "" }, { price: "abc", minutes: "x" }]) {
    const r = whatYouKeep(bad);
    for (const [k, v] of Object.entries(r)) {
      if (v === null) continue;
      assert.ok(Number.isFinite(v), `${k} was ${v} for ${JSON.stringify(bad)}`);
    }
  }
});

test("negative entries are not treated as income", () => {
  // A minus sign typed by accident must not inflate what you keep.
  const r = whatYouKeep({ ...BASE, price: -160 });
  assert.equal(r.revenue, 0);
  assert.ok(r.kept <= 0, "a negative price cannot pay you");
});
