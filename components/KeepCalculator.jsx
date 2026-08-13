"use client";

/* The product's whole point, delivered before anyone signs up.

   Soli's argument is that the price of a service is not the money you get, and
   that argument is far more convincing worked through on somebody's own numbers
   than described in a paragraph. Everything is prefilled with a plausible
   setup, so one number typed into the price box already produces an answer and
   the rest can be corrected afterwards.

   No account, no email, nothing stored. It runs entirely in the browser. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { whatYouKeep } from "@/lib/keep";

const money = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function KeepCalculator() {
  const [price, setPrice] = useState("160");
  const [minutes, setMinutes] = useState("90");
  const [productCost, setProductCost] = useState("12");
  const [rentAmount, setRentAmount] = useState("250");
  const [rentUnit, setRentUnit] = useState("week");
  const [hoursPerWeek, setHoursPerWeek] = useState("25");
  const [taxRate, setTaxRate] = useState("25");

  const r = useMemo(
    () => whatYouKeep({ price, productCost, minutes, rentAmount, rentUnit, hoursPerWeek, taxRate }),
    [price, productCost, minutes, rentAmount, rentUnit, hoursPerWeek, taxRate]
  );

  const pct = r.keptShare === null ? null : Math.round(r.keptShare * 100);
  const losing = r.kept < 0;

  return (
    <div className="kc">
      <div className="kc-form">
        <div className="kc-block">
          <div className="kc-blockhead">The service</div>

          <label className="kc-field kc-big">
            <span>What you charge</span>
            <div className="kc-money">
              <span aria-hidden="true">$</span>
              <input type="number" inputMode="decimal" min="0" value={price}
                onChange={(e) => setPrice(e.target.value)} />
            </div>
          </label>

          <div className="kc-row">
            <label className="kc-field">
              <span>Time in the chair</span>
              <div className="kc-suffix">
                <input type="number" inputMode="numeric" min="0" value={minutes}
                  onChange={(e) => setMinutes(e.target.value)} />
                <em>min</em>
              </div>
            </label>
            <label className="kc-field">
              <span>Product you use</span>
              <div className="kc-money">
                <span aria-hidden="true">$</span>
                <input type="number" inputMode="decimal" min="0" value={productCost}
                  onChange={(e) => setProductCost(e.target.value)} />
              </div>
            </label>
          </div>
        </div>

        <div className="kc-block">
          <div className="kc-blockhead">Your setup</div>
          <p className="kc-note">This is the part most calculators leave out, and it is usually the biggest bite.</p>

          <div className="kc-row">
            <label className="kc-field">
              <span>Booth rent</span>
              <div className="kc-money">
                <span aria-hidden="true">$</span>
                <input type="number" inputMode="decimal" min="0" value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)} />
              </div>
            </label>
            <div className="kc-field">
              <span>Paid</span>
              <div className="kc-seg" role="group" aria-label="How often you pay booth rent">
                {[["week", "Weekly"], ["month", "Monthly"], ["hour", "Hourly"]].map(([v, l]) => (
                  <button key={v} type="button" className={"kc-segbtn" + (rentUnit === v ? " on" : "")}
                    onClick={() => setRentUnit(v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="kc-row">
            {/* Hourly rent needs no conversion, so asking for hours would be noise. */}
            {rentUnit !== "hour" && (
              <label className="kc-field">
                <span>Hours you work a week</span>
                <div className="kc-suffix">
                  <input type="number" inputMode="numeric" min="0" value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)} />
                  <em>hrs</em>
                </div>
              </label>
            )}
            <label className="kc-field">
              <span>Tax you set aside</span>
              <div className="kc-suffix">
                <input type="number" inputMode="decimal" min="0" max="100" value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)} />
                <em>%</em>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className={"kc-result" + (losing ? " losing" : "")} aria-live="polite">
        <div className="kc-kept">
          <span className="kc-keptlabel">{losing ? "This service costs you" : "You keep"}</span>
          <span className="kc-keptval">{money(Math.abs(r.kept))}</span>
          {r.revenue > 0 && (
            <span className="kc-keptsub">
              {losing
                ? `on every ${money(r.revenue)} appointment like this`
                : `of the ${money(r.revenue)} you charged${pct !== null ? `, which is ${pct}%` : ""}`}
            </span>
          )}
        </div>

        <div className="kc-chain">
          <div className="kc-crow"><span>What you charge</span><b>{money(r.revenue)}</b></div>
          <div className="kc-crow out"><span>Product</span><b>{"− " + money(r.product)}</b></div>
          <div className="kc-crow out">
            <span>Booth rent{r.hours > 0 && r.rentPerHour > 0 ? ` (${Math.round(r.hours * 100) / 100}h at ${money(r.rentPerHour)}/hr)` : ""}</span>
            <b>{"− " + money(r.booth)}</b>
          </div>
          <div className="kc-crow sub"><span>Before tax</span><b>{money(r.beforeTax)}</b></div>
          <div className="kc-crow out"><span>Tax to set aside</span><b>{"− " + money(r.tax)}</b></div>
          <div className="kc-crow total"><span>{losing ? "You are down" : "You keep"}</span><b>{money(r.kept)}</b></div>
        </div>

        {r.keptPerHour !== null && (
          <p className="kc-perhour">
            That is <b>{money(r.keptPerHour)} an hour</b>, after everything.
          </p>
        )}

        <div className="kc-cta">
          <p>That was one appointment. Soli does this for every client, and shows you the month.</p>
          <Link href="/app?demo=1" className="kc-btn">Start free &rarr;</Link>
          <span className="kc-ctanote">No card required. Nothing you typed here was sent anywhere.</span>
        </div>
      </div>
    </div>
  );
}
