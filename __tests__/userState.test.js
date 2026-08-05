/* Drives the real saveField against clients that fail the way a dropped
   connection does.

   This is the seam the unsaved-work banner hangs off: the caller only learns a
   save was lost if saveField resolves with ok:false. If it rejects instead, the
   .then() that records the failure never runs and the screen keeps showing work
   the server never took. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { saveField } from "../lib/userState.js";

// Chain shape used by saveFieldNow: from().update().eq()[.eq()].select()
const client = (select) => ({
  from: () => ({ update: () => ({ eq: () => ({ eq: () => ({ select }), select }) }) }),
});

const throwsSync = client(() => { throw new TypeError("Failed to fetch"); });
const rejects = client(() => Promise.reject(new TypeError("NetworkError")));
const returnsError = client(() => Promise.resolve({ data: null, error: { message: "JWT expired" } }));
const succeeds = client(() => Promise.resolve({ data: [{ updated_at: "2026-08-05T00:00:00Z" }], error: null }));

test("a thrown network error is reported, not rejected", async () => {
  // Offline usually surfaces as a synchronous throw out of the fetch wrapper.
  const res = await saveField(throwsSync, "u1", "logs", [{ id: 1 }]).catch(() => "REJECTED");
  assert.notEqual(res, "REJECTED", "saveField must resolve so the caller can record the loss");
  assert.equal(res.ok, false);
});

test("the failed value comes back so it can be held for a retry", async () => {
  const value = [{ id: 1, price: 160 }];
  const res = await saveField(throwsSync, "u1", "logs", value).catch(() => "REJECTED");
  assert.deepEqual(res.value, value);
});

test("a rejected promise is reported too", async () => {
  const res = await saveField(rejects, "u1", "logs", [{ id: 2 }]).catch(() => "REJECTED");
  assert.notEqual(res, "REJECTED");
  assert.equal(res.ok, false);
});

test("an ordinary Supabase error still reports ok:false", async () => {
  // Supabase returns errors rather than throwing them, so this path is the one
  // a try/catch would miss entirely.
  const res = await saveField(returnsError, "u1", "logs", [{ id: 3 }]).catch(() => "REJECTED");
  assert.notEqual(res, "REJECTED");
  assert.equal(res.ok, false);
});

test("a good save reports ok:true", async () => {
  const res = await saveField(succeeds, "u1", "logs", [{ id: 4 }]).catch(() => "REJECTED");
  assert.notEqual(res, "REJECTED");
  assert.equal(res.ok, true);
});

test("the queue keeps running after a failure", async () => {
  // Saves are serialised. If a rejection escaped it, every later save would
  // stall behind it and the whole account would stop persisting.
  await saveField(throwsSync, "u1", "logs", [{ id: 5 }]).catch(() => {});
  const res = await saveField(succeeds, "u1", "clients", [{ id: 6 }]).catch(() => "REJECTED");
  assert.notEqual(res, "REJECTED");
  assert.equal(res.ok, true);
});

test("saves run one at a time, in order", async () => {
  // Every write moves the row timestamp the next one locks against, so firing
  // several at once made them invalidate each other.
  const order = [];
  let live = 0;
  const tracking = client(async () => {
    live++;
    assert.equal(live, 1, "two saves were in flight at once");
    await new Promise((r) => setTimeout(r, 5));
    live--;
    return { data: [{ updated_at: "2026-08-05T00:00:00Z" }], error: null };
  });

  await Promise.all(["logs", "clients", "products"].map((f) =>
    saveField(tracking, "u1", f, []).then(() => order.push(f))
  ));
  assert.deepEqual(order, ["logs", "clients", "products"]);
});
