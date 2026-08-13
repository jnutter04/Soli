import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { newLog } from "../lib/service.js";

test("stamps when the service was recorded", () => {
  const before = Date.now();
  const log = newLog({ id: "l1", service: "Volume fill", price: 160 });
  const at = new Date(log.createdAt).getTime();
  assert.ok(at >= before && at <= Date.now(), "stamped with now");
});

test("keeps the appointment date separate from the recording", () => {
  // A service last month, entered today. Both facts have to survive.
  const appointment = "2026-07-04T12:00:00.000Z";
  const log = newLog({ id: "l1", date: appointment, price: 160 });
  assert.equal(log.date, appointment, "the appointment is untouched");
  assert.notEqual(log.createdAt, appointment, "and is not mistaken for the recording");
});

test("passes every other field through unchanged", () => {
  const fields = { id: "l1", clientId: "c1", service: "Lash fill", price: 90,
                   productCost: 8, durationMin: 60, tip: 15, paySource: "cash" };
  const log = newLog(fields);
  for (const [k, v] of Object.entries(fields)) assert.equal(log[k], v, k);
});

test("does not overwrite a stamp that already exists", () => {
  // Restoring a backup must not relabel old work as recorded today.
  const original = "2026-06-01T09:00:00.000Z";
  assert.equal(newLog({ id: "l1", createdAt: original }).createdAt, original);
});

test("every path that creates a service uses it", () => {
  /* The measurement is only worth having if it is complete, and a fourth
     creation path added later would silently produce unstamped services. This
     fails if a log is ever built without going through newLog. */
  const src = fs.readFileSync("app/app/page.jsx", "utf8");
  /* A logged service has both a clientId and a date. Two other shapes in this
     file look similar and are not services: a saved template, which has a price
     and a duration but belongs to nobody, and a blank row in the batch form,
     which has a client but no date until it is turned into one. Requiring both
     fields is what separates a service from something that resembles one. */
  const creations = [...src.matchAll(/\{\s*\n?\s*id: uid\(\), clientId:[\s\S]{0,320}?\}/g)]
    .filter((m) => /\bdate:/.test(m[0]));
  assert.equal(creations.length, 4, `expected the four known creation sites, found ${creations.length}`);

  for (const m of creations) {
    const line = src.slice(0, m.index).split("\n").length;
    const context = src.slice(Math.max(0, m.index - 120), m.index + 40);
    // The sample data is deliberately unstamped: loading examples is not a
    // logging event, so its absence is what marks those services as not real.
    const isSeed = /recipes\[svc\]/.test(context);
    if (isSeed) continue;
    assert.match(context, /newLog\(\{/, `service built without newLog near line ${line}`);
  }
});
