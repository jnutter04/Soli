/* Reading a Soli backup file back in.

   Export has always been half a promise: you could take a copy out and had no
   way to put it back. This is the other half.

   Everything here refuses rather than guesses. A backup is restored over live
   records, so a file that is truncated, half-edited, or simply the wrong file
   has to be turned away at the door. Anything that gets through this is safe to
   write, which is what lets the screen state plainly what is about to happen. */

import { mergeById } from "./merge.js";

const LISTS = ["clients", "products", "logs", "expenses"];

const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* Text off a disk can arrive with a byte order mark, and JSON.parse treats one
   as a syntax error. Not worth failing a good backup over. */
const stripBom = (s) => String(s || "").replace(/^﻿/, "");

let seq = 0;
const freshId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

/* Parses and checks a backup. Returns either a reason it cannot be used, or
   the records it holds alongside a count of each, ready to show before
   anything is written. */
export function readBackup(text) {
  const src = stripBom(text).trim();
  if (!src) return { ok: false, error: "That file is empty." };

  let raw;
  try {
    raw = JSON.parse(src);
  } catch {
    return { ok: false, error: "That file isn't readable. A backup is the .json file Soli saved, not a spreadsheet." };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: "That file isn't a Soli backup." };
  }

  /* The marker is what separates a Soli backup from any other JSON. Without it
     this would happily read an unrelated file and report zero of everything,
     which invites someone to wipe their account with it. */
  if (!raw.soliExport) {
    return { ok: false, error: "That doesn't look like a Soli backup. Look for the file named soli-backup, ending in .json." };
  }

  const data = {};
  for (const key of LISTS) {
    const value = raw[key];
    // Missing is fine: an account with no expenses exports an empty list.
    if (value === undefined || value === null) { data[key] = []; continue; }
    if (!Array.isArray(value)) {
      return { ok: false, error: `The ${key} in that file are damaged, so it cannot be trusted to restore.` };
    }
    /* An id is what tells one record from another when merging. Real backups
       always carry them; one that does not is given a fresh one so it is
       restored rather than silently dropped. */
    data[key] = value.filter(isRecord).map((r) => (r.id == null ? { ...r, id: freshId() } : r));
  }

  data.settings = isRecord(raw.settings) ? raw.settings : null;
  data.plan = isRecord(raw.plan) ? raw.plan : null;

  const counts = {
    clients: data.clients.length,
    products: data.products.length,
    services: data.logs.length,
    expenses: data.expenses.length,
  };

  if (Object.values(counts).every((n) => n === 0) && !data.settings && !data.plan) {
    return { ok: false, error: "That backup is empty, so there is nothing to restore from it." };
  }

  const when = Date.parse(raw.exportedAt);
  return { ok: true, data, counts, exportedAt: isNaN(when) ? null : new Date(when).toISOString() };
}

/* The lists a restore touches, paired with the state key each one lands in. */
export const RESTORE_KEYS = [
  ["clients", "clients"],
  ["products", "products"],
  ["logs", "services"],
  ["expenses", "expenses"],
];

/* Merging keeps everything already here and adds back whatever the file has
   that is missing, so a record edited since the backup keeps the newer version.
   Passing an empty base says "nothing was deleted on purpose", which is what
   makes this a union rather than a reconciliation. */
export function mergeLists(current, backup) {
  const out = {};
  for (const [key] of RESTORE_KEYS) out[key] = mergeById([], current[key] || [], backup[key] || []);
  return out;
}

/* What a restore would leave behind, counted rather than estimated.

   Merge overlaps matter: a backup of 40 services on top of 35 that share 30
   does not give 75, and a screen that says it does is lying at exactly the
   moment someone is deciding whether to trust it. */
export function restorePreview(backup, current, mode) {
  const after = {};
  if (mode === "replace") {
    for (const [key, label] of RESTORE_KEYS) after[label] = (backup[key] || []).length;
    return after;
  }
  const merged = mergeLists(current, backup);
  for (const [key, label] of RESTORE_KEYS) after[label] = merged[key].length;
  return after;
}
