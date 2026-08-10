import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowSticky } from "../lib/stickyCta.js";

const VH = 812; // the phone the landing page is actually read on

test("stays hidden while the hero button is still on screen", () => {
  // Top of the page: hero button sits below the fold line but in view.
  assert.equal(shouldShowSticky({ heroBottom: 640, closingTop: 4300, viewportHeight: VH }), false);
});

test("stays hidden while the hero button is only just still visible", () => {
  assert.equal(shouldShowSticky({ heroBottom: 1, closingTop: 4300, viewportHeight: VH }), false);
});

test("appears once the hero button has scrolled off the top", () => {
  assert.equal(shouldShowSticky({ heroBottom: -1, closingTop: 4300, viewportHeight: VH }), true);
  assert.equal(shouldShowSticky({ heroBottom: -1600, closingTop: 2100, viewportHeight: VH }), true);
});

test("leaves again when the closing call to action comes into view", () => {
  // Closing section has entered the bottom of the screen.
  assert.equal(shouldShowSticky({ heroBottom: -3800, closingTop: 800, viewportHeight: VH }), false);
});

test("is gone at the very bottom of the page", () => {
  assert.equal(shouldShowSticky({ heroBottom: -4200, closingTop: 280, viewportHeight: VH }), false);
});

test("comes back when scrolling up away from the closing section", () => {
  assert.equal(shouldShowSticky({ heroBottom: -2000, closingTop: 1400, viewportHeight: VH }), true);
});

test("the closing boundary is the fold, not the page edge", () => {
  // One pixel below the fold is not yet in view.
  assert.equal(shouldShowSticky({ heroBottom: -2000, closingTop: VH, viewportHeight: VH }), true);
  assert.equal(shouldShowSticky({ heroBottom: -2000, closingTop: VH - 1, viewportHeight: VH }), false);
});

test("a page with no closing section still shows the bar", () => {
  assert.equal(shouldShowSticky({ heroBottom: -900, closingTop: null, viewportHeight: VH }), true);
});

test("stays hidden when there is no hero button to measure", () => {
  // Nothing to anchor to, so it must not guess its way onto the screen.
  assert.equal(shouldShowSticky({ heroBottom: null, closingTop: 4300, viewportHeight: VH }), false);
  assert.equal(shouldShowSticky({}), false);
});

test("a taller screen keeps the closing section hidden for longer", () => {
  // Same geometry, bigger viewport: the closing section is now in view.
  assert.equal(shouldShowSticky({ heroBottom: -2000, closingTop: 900, viewportHeight: 812 }), true);
  assert.equal(shouldShowSticky({ heroBottom: -2000, closingTop: 900, viewportHeight: 1000 }), false);
});
