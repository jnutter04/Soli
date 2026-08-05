/* Reconciling a phone and a laptop that both changed the same list.

   Soli rewrites each list as one blob, so without a merge the last write wins
   and the other device's work is gone. The base snapshot is what makes "I
   deleted this" distinguishable from "they just added this", and every case
   below is one the two-way comparison would get wrong. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeById, mergeObject, mergeField } from "../lib/merge.js";

const ids = (arr) => arr.map((x) => x.id);

test("an edit here wins over an untouched copy there", () => {
  const base = [{ id: 1, price: 100 }];
  const local = [{ id: 1, price: 150 }];
  const remote = [{ id: 1, price: 100 }];
  assert.deepEqual(mergeById(base, local, remote), [{ id: 1, price: 150 }]);
});

test("an edit there survives when we did not touch it", () => {
  const base = [{ id: 1, price: 100 }];
  const local = [{ id: 1, price: 100 }];
  const remote = [{ id: 1, price: 175 }];
  assert.deepEqual(mergeById(base, local, remote), [{ id: 1, price: 175 }]);
});

test("something we added is kept even though the server has never seen it", () => {
  // Absent from base and from remote. A two-way comparison reads this as
  // "deleted on the server" and throws away a service just logged.
  const merged = mergeById([], [{ id: 2, price: 90 }], []);
  assert.deepEqual(ids(merged), [2]);
});

test("something we deleted stays deleted", () => {
  // Present in base, gone locally, still on the server. Guessing the other way
  // resurrects a record someone deliberately removed.
  const base = [{ id: 1 }, { id: 2 }];
  const local = [{ id: 1 }];
  const remote = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(ids(mergeById(base, local, remote)), [1]);
});

test("something the other device added survives", () => {
  // Absent from base and from local, present on the server.
  const base = [{ id: 1 }];
  const local = [{ id: 1 }];
  const remote = [{ id: 1 }, { id: 9 }];
  assert.deepEqual(ids(mergeById(base, local, remote)), [1, 9]);
});

test("a deletion on the other device is respected when we did not edit it", () => {
  const base = [{ id: 1 }, { id: 2 }];
  const local = [{ id: 1 }, { id: 2 }];
  const remote = [{ id: 1 }];
  assert.deepEqual(ids(mergeById(base, local, remote)), [1]);
});

test("their deletion wins over our edit, and the edit is dropped", () => {
  /* A deliberate choice, recorded here so it cannot change by accident.

     They deleted the record, we edited it. Deletion wins, so our edit goes with
     it. The alternative resurrects a service someone meant to remove, which for
     a duplicate entry means the money is counted twice and the figures are
     wrong without anyone being told. A lost edit to an already-doomed record is
     the smaller harm, and it needs both devices to touch the same service in
     the same sync window to happen at all. */
  const base = [{ id: 1, price: 100 }];
  const local = [{ id: 1, price: 200 }];
  const remote = [];
  assert.deepEqual(mergeById(base, local, remote), []);
});

test("both devices adding at once keeps both", () => {
  const merged = mergeById([{ id: 1 }], [{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 3 }]);
  assert.deepEqual(ids(merged).sort(), [1, 2, 3]);
});

test("this device's ordering is preserved", () => {
  const base = [{ id: 1 }, { id: 2 }];
  const local = [{ id: 2 }, { id: 1 }];
  const remote = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(ids(mergeById(base, local, remote)), [2, 1]);
});

test("mergeById tolerates the shapes a bad load can hand it", () => {
  assert.deepEqual(mergeById(null, null, null), []);
  assert.deepEqual(ids(mergeById(undefined, [{ id: 1 }], undefined)), [1]);
  // An entry with no id cannot be reconciled, so it is carried rather than lost.
  const merged = mergeById([], [{ id: 1 }, { noId: true }], []);
  assert.equal(merged.length, 2);
});

test("settings merge key by key, not whole-object", () => {
  // The laptop changed the tax rate, the phone changed booth rent. Neither
  // should lose the other's change.
  const base = { taxRate: 25, boothRentAmount: 200 };
  const local = { taxRate: 30, boothRentAmount: 200 };
  const remote = { taxRate: 25, boothRentAmount: 250 };
  assert.deepEqual(mergeObject(base, local, remote), { taxRate: 30, boothRentAmount: 250 });
});

test("a setting removed here stays removed", () => {
  const base = { goal: 5000, taxRate: 25 };
  const local = { taxRate: 25 };
  const remote = { goal: 5000, taxRate: 25 };
  assert.deepEqual(mergeObject(base, local, remote), { taxRate: 25 });
});

test("a setting removed here is kept if they changed it meanwhile", () => {
  // They had a reason to set it after we cleared it, so their intent is newer.
  const base = { goal: 5000 };
  const local = {};
  const remote = { goal: 8000 };
  assert.deepEqual(mergeObject(base, local, remote), { goal: 8000 });
});

test("a setting added on either side survives", () => {
  assert.deepEqual(mergeObject({}, { currency: "GBP" }, {}), { currency: "GBP" });
  assert.deepEqual(mergeObject({}, {}, { currency: "EUR" }), { currency: "EUR" });
});

test("mergeObject tolerates missing sides", () => {
  assert.deepEqual(mergeObject(null, null, null), {});
  assert.deepEqual(mergeObject(undefined, { a: 1 }, undefined), { a: 1 });
});

test("mergeField routes each field to the right strategy", () => {
  for (const field of ["logs", "clients", "products", "expenses"]) {
    assert.deepEqual(
      ids(mergeField(field, [{ id: 1 }], [{ id: 1 }], [{ id: 1 }, { id: 2 }])),
      [1, 2],
      `${field} should merge by id`
    );
  }

  for (const field of ["settings", "plan"]) {
    assert.deepEqual(
      mergeField(field, { a: 1 }, { a: 2 }, { a: 1, b: 3 }),
      { a: 2, b: 3 },
      `${field} should merge by key`
    );
  }

  // A scalar carries no structure to reconcile, so the device that just changed
  // it stands.
  assert.equal(mergeField("demo_seeded", false, true, false), true);
});
