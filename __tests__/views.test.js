import { test, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as esbuild from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/* Renders the dashboard for real.

   A release once went out that threw on every dashboard render, and 125 tests
   passed without noticing, because every one of them examined a pure function
   and nothing could import a screen. This is the test that would have caught
   it in about two seconds.

   The build step exists because Node cannot parse JSX and does not know what
   "@/" means. esbuild resolves both, leaving React itself external so the
   component and this test share one copy. Output goes under node_modules so
   bare imports still resolve and nothing lands in the repo. */

const OUT = "node_modules/.soli-views/dashboard.mjs";
let Dashboard;

before(async () => {
  await esbuild.build({
    entryPoints: ["components/Dashboard.jsx"],
    outfile: OUT,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "node",
    logLevel: "silent",
    // Shared instances, and no need to bundle what Node can already load.
    external: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*", "lucide-react"],
    alias: { "@": path.resolve(".") },
  });
  Dashboard = (await import("../" + OUT)).default;
});

/* A month of ordinary work, in the shape the app actually stores. */
const svc = (id, day, price, cost, mins, tip = 0) => ({
  id, date: new Date(2026, 6, day, 12).toISOString(), clientId: "c1",
  service: "Volume fill", price, productCost: cost, durationMin: mins, tip, paySource: "card",
});

const FULL = {
  logs: [svc("l1", 2, 160, 12, 90, 20), svc("l2", 9, 90, 8, 60), svc("l3", 17, 220, 30, 120, 40)],
  clients: [{ id: "c1", name: "Maya R.", phone: "5551234567", rebookWeeks: 4, lastVisit: new Date(2026, 5, 1).toISOString() }],
  rent: 12,
  taxRate: 25,
  setTab: () => {},
  buckets: [{ id: "b1", name: "Retirement", pct: 10 }],
  plan: { goal: 4000 },
  savePlan: () => {},
  settings: { currency: "USD", taxRate: 25, boothRentAmount: 300, boothRentUnit: "week", boothRentHoursPerWeek: 25 },
  templates: [{ id: "t1", name: "Volume fill" }],
  onHideOnboarding: () => {},
  onMilestoneSeen: () => {},
};

const render = (props) => renderToStaticMarkup(createElement(Dashboard, props));

test("renders with a normal month of services", () => {
  const html = render(FULL);
  assert.match(html, /What you kept/);
  assert.match(html, /How that adds up/);
});

test("renders an empty account without throwing", () => {
  // The state every new signup is in, and the one most likely to be skipped.
  const html = render({ ...FULL, logs: [], clients: [], templates: [], settings: {} });
  assert.match(html, /No services logged yet/);
});

test("renders when booth rent and tax have never been set", () => {
  const html = render({ ...FULL, rent: 0, taxRate: 0, settings: { currency: "USD" } });
  assert.match(html, /not set yet/);
});

test("renders services that carry no duration", () => {
  // Imported rows often arrive without minutes. This used to print an infinity.
  const html = render({ ...FULL, logs: [svc("l1", 2, 160, 12, 0)] });
  assert.doesNotMatch(html, /NaN|Infinity|\$∞/);
});

test("renders with no clients attached to the work", () => {
  const html = render({ ...FULL, clients: [] });
  assert.match(html, /What you kept/);
});

test("survives missing optional props entirely", () => {
  /* Every optional prop left out at once. Defaults are declared in the
     signature, so this proves they are actually reached rather than assumed. */
  assert.doesNotThrow(() => render({
    logs: FULL.logs, clients: FULL.clients, rent: 12, taxRate: 25, setTab: () => {},
  }));
});

test("renders a loss-making month without breaking", () => {
  // Costs above price. Negative take-home has to render, not crash.
  const html = render({ ...FULL, logs: [svc("l1", 2, 40, 90, 120)] });
  assert.match(html, /What you kept/);
});
