"use client";

/* "What if you worked less?"

   Every other screen in Soli answers "how am I doing". This one answers a
   question people actually lie awake with, and it only earns its place by
   being honest about the part that is uncomfortable: most of the hours you
   would like to give back are paying you something, and the rent does not care
   how many of them you work.

   Nothing here is a recommendation. It shows what each choice costs and lets
   someone decide, because whether ninety pounds a month is worth a Saturday
   is not a thing arithmetic can settle. */

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { rentShrinksWithHours, serviceRows, scenario, rankByRate, headlineCandidate } from "@/lib/workLess";

const WINDOW_DAYS = 90;
const MONTHS = WINDOW_DAYS / 30;

export default function WorkLess({ logs, rent, taxRate, settings, money2 }) {
  const [dropped, setDropped] = useState([]);

  const since = useMemo(() => Date.now() - WINDOW_DAYS * 864e5, []);
  const rentShrinks = rentShrinksWithHours(settings);
  const opts = { taxRate, rentShrinks };

  const rows = useMemo(() => serviceRows(logs, rent, since), [logs, rent, since]);
  const ranked = useMemo(() => rankByRate(rows, opts), [rows, taxRate, rentShrinks]);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const result = scenario(rows, dropped, opts);
  const headline = headlineCandidate(ranked, totalHours);

  /* Two service types is the minimum for the question to mean anything: with
     one, "work less" is just "earn less" and there is nothing to weigh. */
  const usable = ranked.filter((r) => r.rate !== null);
  if (usable.length < 2 || totalHours <= 0) return null;

  const toggle = (name) =>
    setDropped((d) => (d.includes(name) ? d.filter((n) => n !== name) : [...d, name]));

  // What the remaining work pays, which is the number the headline compares to.
  const rest = headline
    ? scenario(rows, rows.filter((r) => r.name !== headline.name).map((r) => r.name), opts)
    : null;

  const perMonth = (n) => money2(n / MONTHS);
  const hoursMonth = (h) => {
    const v = h / MONTHS;
    return (v < 10 ? Math.round(v * 10) / 10 : Math.round(v)) + (v === 1 ? " hour" : " hours");
  };

  return (
    <div className="soli-block">
      <div className="soli-blockhead"><Clock size={18} strokeWidth={1.9} /><h2>What if you worked less?</h2></div>
      <p className="soli-note">
        Based on your last {WINDOW_DAYS} days. Tap anything you are thinking of giving up to see what it frees and what it costs.
      </p>

      {headline && rest?.perHourFreed != null && headline.rate < rest.perHourFreed && (
        <div className="soli-wlhead">
          <b>{headline.name}</b> takes {hoursMonth(headline.hours)} a month and pays you{" "}
          <b>{money2(headline.rate)}/hr</b>. The rest of your work pays <b>{money2(rest.perHourFreed)}/hr</b>.
        </div>
      )}

      <div className="soli-wltable" role="group" aria-label="Services you could give up">
        <div className="soli-wlhrow"><span>Service</span><span>Hours a month</span><span>Pays</span></div>
        {ranked.map((r) => {
          const off = dropped.includes(r.name);
          return (
            <button
              type="button"
              key={r.name}
              className={"soli-wlrow" + (off ? " off" : "")}
              aria-pressed={off}
              onClick={() => toggle(r.name)}
            >
              <span className="soli-wlname">{r.name}<small>{r.count}x</small></span>
              <span>{hoursMonth(r.hours)}</span>
              <span className="soli-wlrate">{r.rate === null ? "no time set" : money2(r.rate) + "/hr"}</span>
            </button>
          );
        })}
      </div>

      {dropped.length > 0 && (
        <div className="soli-wlresult">
          <div className="soli-wlresrow">
            <span>You would get back</span>
            <b>{hoursMonth(result.hoursFreed)} a month</b>
          </div>
          <div className="soli-wlresrow">
            <span>And give up</span>
            <b className="cost">{perMonth(result.takeHomeLost)} a month</b>
          </div>
          {result.perHourFreed != null && (
            <div className="soli-wlresnote">
              Those hours were paying you {money2(result.perHourFreed)} each.
            </div>
          )}
        </div>
      )}

      {/* The correction that makes the rest of the screen trustworthy. */}
      <p className="soli-help">
        {rentShrinks
          ? "You pay booth rent by the hour, so hours you do not work are hours you do not pay for. That is already counted above."
          : "Your booth rent is a fixed bill, so it does not shrink when you work less. These figures leave it where it is, which is why a service can look thin on the dashboard and still be worth keeping: the chair is paid for either way."}
      </p>
    </div>
  );
}
