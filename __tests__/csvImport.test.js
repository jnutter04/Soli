/* Importing a booking export is the one place Soli takes numbers it did not
   watch a person type. A misread column or a flipped date silently distorts
   months of take-home, so the parsing rules are pinned down here. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCsv, detectColumns, parseMoney, parseDuration, parseDate,
  parsePaySource, buildRows, fingerprint,
} from "../lib/csvImport.js";

test("parseCsv handles the shapes real exports arrive in", () => {
  assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);

  // A comma inside a quoted field is data, not a delimiter.
  assert.deepEqual(parseCsv('name,note\n"Maya R., VIP",hi'), [["name", "note"], ["Maya R., VIP", "hi"]]);

  // Doubled quotes are one literal quote.
  assert.deepEqual(parseCsv('a\n"she said ""hi"""'), [["a"], ['she said "hi"']]);

  // A newline inside quotes must not start a new row.
  assert.deepEqual(parseCsv('a,b\n"line1\nline2",x'), [["a", "b"], ["line1\nline2", "x"]]);

  // European exports commonly use semicolons.
  assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);

  // Excel writes a BOM, and Windows writes CRLF.
  assert.deepEqual(parseCsv("﻿a,b\r\n1,2"), [["a", "b"], ["1", "2"]]);

  // Blank lines carry nothing and would otherwise become empty services.
  assert.deepEqual(parseCsv("a,b\n\n1,2\n\n"), [["a", "b"], ["1", "2"]]);

  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("   "), []);
});

test("parseCsv only counts delimiters outside quotes when choosing one", () => {
  // Semicolons appear inside a quoted field but commas are the real delimiter.
  assert.deepEqual(parseCsv('a,b\n"x;y;z",2'), [["a", "b"], ["x;y;z", "2"]]);
});

test("parseMoney reads the notations a price can arrive in", () => {
  assert.equal(parseMoney("$1,234.56"), 1234.56);
  assert.equal(parseMoney("1234.56"), 1234.56);
  assert.equal(parseMoney("160"), 160);

  // European: dot groups thousands, comma is the decimal.
  assert.equal(parseMoney("1.234,56"), 1234.56);
  assert.equal(parseMoney("12,50"), 12.5);

  // A comma splitting three digits is grouping, not a decimal.
  assert.equal(parseMoney("1,234"), 1234);

  // Refunds arrive both ways and must stay negative for buildRows to spot them.
  assert.equal(parseMoney("(12.00)"), -12);
  assert.equal(parseMoney("-12.00"), -12);

  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(null), null);
  assert.equal(parseMoney("n/a"), null);
});

test("parseDuration reads the ways a length is written", () => {
  assert.equal(parseDuration("90"), 90);
  assert.equal(parseDuration("1:30"), 90);
  assert.equal(parseDuration("90 min"), 90);
  assert.equal(parseDuration("90 minutes"), 90);
  assert.equal(parseDuration("1.5 hours"), 90);
  assert.equal(parseDuration("1h 30m"), 90);
  assert.equal(parseDuration("2h"), 120);
  assert.equal(parseDuration(""), null);
  assert.equal(parseDuration(null), null);
});

test("parseDate reads unambiguous dates without guessing", () => {
  const day = (r) => new Date(r.date).getDate();
  const month = (r) => new Date(r.date).getMonth() + 1;

  const iso = parseDate("2026-03-04");
  assert.equal(month(iso), 3);
  assert.equal(day(iso), 4);
  assert.equal(iso.ambiguous, false);

  // A value over 12 can only be the day, which settles the order by itself.
  const us = parseDate("03/25/2026");
  assert.equal(month(us), 3);
  assert.equal(day(us), 25);
  assert.equal(us.ambiguous, false);

  const eu = parseDate("25/03/2026");
  assert.equal(month(eu), 3);
  assert.equal(day(eu), 25);
  assert.equal(eu.ambiguous, false);

  const named = parseDate("March 4, 2026");
  assert.equal(month(named), 3);
  assert.equal(day(named), 4);
  assert.equal(named.ambiguous, false);
});

test("parseDate flags a date that could mean either order", () => {
  // 03/04 is March 4th in the US and April 3rd almost everywhere else. Getting
  // this wrong files a service into the wrong month, so it must be reported
  // rather than quietly resolved.
  const monthFirst = parseDate("03/04/2026", false);
  assert.equal(new Date(monthFirst.date).getMonth() + 1, 3);
  assert.equal(new Date(monthFirst.date).getDate(), 4);
  assert.equal(monthFirst.ambiguous, true);

  const dayFirst = parseDate("03/04/2026", true);
  assert.equal(new Date(dayFirst.date).getMonth() + 1, 4);
  assert.equal(new Date(dayFirst.date).getDate(), 3);
  assert.equal(dayFirst.ambiguous, true);
});

test("parseDate handles two-digit years and rejects nonsense", () => {
  assert.equal(new Date(parseDate("03/04/26").date).getFullYear(), 2026);
  assert.equal(new Date(parseDate("03/04/99").date).getFullYear(), 1999);
  assert.equal(parseDate("not a date"), null);
  assert.equal(parseDate(""), null);
  // A month of 13 cannot be rescued, so nothing is invented.
  assert.equal(parseDate("2026-13-04").date, null);
});

test("a parsed date keeps its day in any timezone", () => {
  // Dates are built at midday precisely so a timezone shift cannot roll a
  // visit onto the neighbouring day and move it between months.
  const d = new Date(parseDate("2026-03-01").date);
  assert.equal(d.getHours(), 12);
});

test("detectColumns prefers an exact header match over a partial one", () => {
  // "tipamount" contains "amount", so without exact-first the tip column would
  // be read as the price.
  const m = detectColumns(["Date", "Client", "Service", "Amount", "Tip Amount"]);
  assert.equal(m.price, 3);
  assert.equal(m.tip, 4);
});

test("detectColumns never assigns one column to two fields", () => {
  const m = detectColumns(["Date", "Name", "Item", "Total"]);
  const used = [m.date, m.client, m.service, m.price].filter((i) => i !== -1);
  assert.equal(new Set(used).size, used.length);
});

test("detectColumns reports a missing field rather than guessing", () => {
  const m = detectColumns(["Date", "Price"]);
  assert.equal(m.duration, -1);
  assert.equal(m.tip, -1);
});

test("detectColumns recognises the common platform exports", () => {
  const square = detectColumns(["Date", "Customer Name", "Item", "Gross Sales", "Tip"]);
  assert.equal(square.date, 0);
  assert.equal(square.client, 1);
  assert.equal(square.service, 2);
  assert.equal(square.price, 3);

  const booksy = detectColumns(["Appointment Date", "Client", "Service Name", "Price", "Duration"]);
  assert.equal(booksy.date, 0);
  assert.equal(booksy.service, 2);
  assert.equal(booksy.duration, 4);
});

test("parsePaySource maps tenders and defaults safely", () => {
  assert.equal(parsePaySource("Cash"), "cash");
  assert.equal(parsePaySource("Venmo"), "venmo");
  assert.equal(parsePaySource("Visa ending 4242"), "card");
  assert.equal(parsePaySource("Apple Pay"), "card");
  assert.equal(parsePaySource("gift certificate"), "other");
  // Nothing recorded is far more likely to be a card than anything else.
  assert.equal(parsePaySource(""), "card");
});

test("buildRows leaves what it cannot read blank instead of inventing it", () => {
  const table = [
    ["Date", "Client", "Service", "Price", "Duration"],
    ["2026-03-04", "Maya R.", "Volume fill", "160", "90"],
    ["", "No date", "Lash lift", "90", ""],
  ];
  const { rows } = buildRows(table, detectColumns(table[0]), false);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 160);
  assert.equal(rows[0].durationMin, 90);

  // A row with no readable date keeps a null the UI can refuse to import.
  assert.equal(rows[1].date, null);
  // An unreadable duration stays empty rather than becoming a zero that would
  // make profit-per-hour look real.
  assert.equal(rows[1].durationMin, "");
});

test("buildRows drops rows carrying neither a service nor an amount", () => {
  const table = [
    ["Date", "Client", "Service", "Price"],
    ["2026-03-04", "Maya R.", "", ""],
    ["2026-03-05", "Sam", "Fill", "100"],
  ];
  const { rows } = buildRows(table, detectColumns(table[0]), false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].service, "Fill");
});

test("buildRows marks a refund and imports it as a positive amount", () => {
  const table = [["Date", "Service", "Price"], ["2026-03-04", "Refund", "(50.00)"]];
  const { rows } = buildRows(table, detectColumns(table[0]), false);
  assert.equal(rows[0].isRefund, true);
  assert.equal(rows[0].price, 50);
});

test("buildRows counts ambiguous dates so the UI can offer to flip them", () => {
  const table = [
    ["Date", "Service", "Price"],
    ["03/04/2026", "A", "10"],
    ["05/06/2026", "B", "20"],
    ["2026-03-04", "C", "30"], // unambiguous, must not be counted
  ];
  const { ambiguousDates } = buildRows(table, detectColumns(table[0]), false);
  assert.equal(ambiguousDates, 2);
});

test("buildRows names an untitled service rather than leaving it empty", () => {
  const table = [["Date", "Price"], ["2026-03-04", "75"]];
  const { rows } = buildRows(table, detectColumns(table[0]), false);
  assert.equal(rows[0].service, "Service");
});

test("fingerprint spots a re-import so the money cannot double", () => {
  const a = { date: "2026-03-04T12:00:00.000Z", service: "Volume fill", price: 160 };
  const b = { date: "2026-03-04T12:00:00.000Z", service: "volume fill", price: 160 };
  // Case and spacing are cosmetic; the same visit must still match.
  assert.equal(fingerprint(a, "Maya R."), fingerprint(b, " maya r. "));
});

test("fingerprint ignores the fields people correct by hand", () => {
  // Duration and tip are exactly what someone fixes after an import, and a
  // second import should still recognise the visit rather than duplicate it.
  const base = { date: "2026-03-04T12:00:00.000Z", service: "Fill", price: 100, durationMin: 60, tip: 20 };
  const edited = { ...base, durationMin: 90, tip: 0 };
  assert.equal(fingerprint(base, "Sam"), fingerprint(edited, "Sam"));
});

test("fingerprint separates genuinely different visits", () => {
  const a = { date: "2026-03-04T12:00:00.000Z", service: "Fill", price: 100 };
  assert.notEqual(fingerprint(a, "Sam"), fingerprint({ ...a, price: 120 }, "Sam"));
  assert.notEqual(fingerprint(a, "Sam"), fingerprint(a, "Alex"));
  assert.notEqual(fingerprint(a, "Sam"), fingerprint({ ...a, date: "2026-03-05T12:00:00.000Z" }, "Sam"));
});
