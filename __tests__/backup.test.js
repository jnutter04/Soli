import { test } from "node:test";
import assert from "node:assert/strict";
import { readBackup, restorePreview, mergeLists } from "../lib/backup.js";

const valid = (over = {}) => JSON.stringify({
  soliExport: 1,
  exportedAt: "2026-03-12T10:00:00.000Z",
  settings: { currency: "USD", taxRate: 25 },
  plan: { goal: 3000 },
  clients: [{ id: "c1", name: "Maya R." }],
  products: [{ id: "p1", name: "Lash adhesive" }],
  logs: [{ id: "l1", price: 160 }, { id: "l2", price: 90 }],
  expenses: [{ id: "e1", amount: 250 }],
  ...over,
});

test("reads a well-formed backup", () => {
  const r = readBackup(valid());
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { clients: 1, products: 1, services: 2, expenses: 1 });
  assert.equal(r.exportedAt, "2026-03-12T10:00:00.000Z");
});

test("survives a byte order mark, which JSON.parse treats as a syntax error", () => {
  assert.equal(readBackup("﻿" + valid()).ok, true);
});

test("a missing list is an empty one, not a failure", () => {
  const r = readBackup(valid({ expenses: undefined }));
  assert.equal(r.ok, true);
  assert.equal(r.counts.expenses, 0);
});

/* The refusals matter more than the successes here: each one is a file that
   would otherwise be written over someone's real records. */
test("refuses a file that is not JSON", () => {
  const r = readBackup("Date,Client,Price\n2026-03-04,Maya,160");
  assert.equal(r.ok, false);
  assert.match(r.error, /readable/);
});

test("refuses JSON that is not a Soli backup", () => {
  const r = readBackup(JSON.stringify({ some: "other app", clients: [{ id: 1 }] }));
  assert.equal(r.ok, false);
  assert.match(r.error, /Soli backup/);
});

test("refuses a backup whose lists are the wrong shape", () => {
  const r = readBackup(valid({ logs: { id: "l1" } }));
  assert.equal(r.ok, false);
  assert.match(r.error, /damaged/);
});

test("refuses an empty file and an empty backup", () => {
  assert.equal(readBackup("").ok, false);
  assert.equal(readBackup("   ").ok, false);
  const hollow = JSON.stringify({ soliExport: 1, clients: [], products: [], logs: [], expenses: [] });
  assert.equal(readBackup(hollow).ok, false);
});

test("keeps records that lost their id rather than dropping them", () => {
  const r = readBackup(valid({ logs: [{ price: 160 }, { id: "l2", price: 90 }] }));
  assert.equal(r.ok, true);
  assert.equal(r.counts.services, 2);
  assert.ok(r.data.logs.every((l) => l.id != null), "every restored record needs an id");
  assert.notEqual(r.data.logs[0].id, r.data.logs[1].id);
});

test("drops non-records inside a list instead of restoring junk", () => {
  const r = readBackup(valid({ clients: [{ id: "c1", name: "Maya R." }, null, "oops", 42] }));
  assert.equal(r.ok, true);
  assert.equal(r.counts.clients, 1);
});

test("replace lands exactly what the file holds", () => {
  const { data } = readBackup(valid());
  const current = { clients: [{ id: "x" }, { id: "y" }], products: [], logs: [{ id: "z" }], expenses: [] };
  assert.deepEqual(restorePreview(data, current, "replace"), {
    clients: 1, products: 1, services: 2, expenses: 1,
  });
});

/* The overlap case. A preview that just adds the two totals would promise
   records that never appear, at the exact moment trust is being decided. */
test("merge counts shared records once, not twice", () => {
  const { data } = readBackup(valid());
  const current = {
    clients: [{ id: "c1", name: "Maya R." }],           // same one the backup has
    products: [],
    logs: [{ id: "l1", price: 160 }, { id: "l9", price: 55 }], // l1 shared, l9 only here
    expenses: [],
  };
  assert.deepEqual(restorePreview(data, current, "merge"), {
    clients: 1,   // not 2
    products: 1,
    services: 3,  // l1, l9, l2
    expenses: 1,
  });
});

test("merge keeps the version already here when both have a record", () => {
  const backup = { logs: [{ id: "l1", price: 160 }] };
  const current = { logs: [{ id: "l1", price: 175 }] }; // corrected since the backup
  const merged = mergeLists(current, backup);
  assert.equal(merged.logs.length, 1);
  assert.equal(merged.logs[0].price, 175, "the newer correction must survive a restore");
});

test("merging a backup twice changes nothing the second time", () => {
  const { data } = readBackup(valid());
  const once = mergeLists({ clients: [], products: [], logs: [], expenses: [] }, data);
  const twice = mergeLists(once, data);
  assert.deepEqual(twice.logs.map((l) => l.id).sort(), once.logs.map((l) => l.id).sort());
  assert.equal(twice.logs.length, 2);
});

test("restoring into an empty account gives back everything", () => {
  const { data } = readBackup(valid());
  const empty = { clients: [], products: [], logs: [], expenses: [] };
  assert.deepEqual(restorePreview(data, empty, "merge"), {
    clients: 1, products: 1, services: 2, expenses: 1,
  });
});
