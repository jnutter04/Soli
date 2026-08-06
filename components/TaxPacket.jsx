"use client";

/* A year on one page, ready to hand over.

   The numbers already existed as a CSV, which is the right shape for a
   spreadsheet and the wrong shape for a person. An accountant opening a
   forty-row export has to work out what they are looking at; a one page
   summary is read in ten seconds.

   The PDF is made by the browser's own print dialog rather than a library.
   That adds nothing to the bundle, works offline, and on a phone it is Share
   then Print then Save to Files, which is where people keep documents anyway.

   Deliberately printed as a plain paper document rather than in Soli's colours:
   an accountant wants something legible in black on white, and a page of cream
   background is a waste of somebody's ink. */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";

export default function TaxPacket({
  year, totals, serviceCount, expenseCount, taxRate, currency, email,
  categories, rentCategory, money2, onClose,
}) {
  // Escape closes it, matching every other overlay in the app.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const locked = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = locked;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const t = totals;
  const generated = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  /* Every category carrying money, in the standard order, followed by anything
     recorded under a name the current list no longer has. Listing only the
     known ones would drop those rows from the itemisation while the total kept
     counting them, and a summary whose parts do not add up to its total is
     worse than no summary. Renaming a category is all it would take. */
  const known = categories.filter((c) => t.byCat[c]);
  const stray = Object.keys(t.byCat || {}).filter((c) => t.byCat[c] && !categories.includes(c));
  const itemised = [...known, ...stray];

  // Categories with nothing against them this year, written as a readable list.
  const empty = categories.filter((c) => !t.byCat[c]);
  const unused = empty.length <= 1
    ? empty.join("")
    : empty.slice(0, -1).join(", ") + " or " + empty[empty.length - 1];

  const row = (label, value, cls) => (
    <div className={"soli-pkrow" + (cls ? " " + cls : "")} key={label}>
      <span>{label}</span><b>{value}</b>
    </div>
  );

  return createPortal(
    <div className="soli-packetwrap">
      <div className="soli-packetbar">
        <button className="soli-ghost" onClick={onClose}><X size={15} /> Close</button>
        <button className="soli-cta sm" onClick={() => window.print()}>
          <Printer size={15} /> Print or save as PDF
        </button>
      </div>

      <div className="soli-packet">
        <header className="soli-pkhead">
          <div>
            <div className="soli-pkbrand">Soli</div>
            <h1>Year-end summary</h1>
          </div>
          <div className="soli-pkyear">{year}</div>
        </header>

        <div className="soli-pkmeta">
          <span>Prepared {generated}</span>
          {email && <span>Account: {email}</span>}
          <span>All figures in {currency}</span>
        </div>

        <section>
          <h2>Income</h2>
          {row("Service revenue", money2(t.revenue))}
          {row("Tips", money2(t.tips))}
          {row("Gross income", money2(t.gross), "total")}
        </section>

        <section>
          <h2>Deductions</h2>
          {row("Product used on clients", money2(t.product))}
          {itemised.map((c) => row(c, money2(t.byCat[c])))}
          {!t.rentLogged && row("Booth time allocated to services", money2(t.boothCounted))}
          {row("Total deductions", money2(t.deductions), "total")}
        </section>

        <section>
          <h2>Result</h2>
          {row("Net profit before tax", money2(t.net), "total")}
          {row(`Set aside at your ${taxRate}% rate`, money2(t.setAside))}
        </section>

        <section>
          <h2>Activity</h2>
          {row("Services logged", String(serviceCount))}
          {row("Hours in chair", String(Math.round((t.minutes / 60) * 10) / 10))}
          {row("Expense entries", String(expenseCount))}
        </section>

        {/* The caveats travel with the numbers. A summary handed on without
            them invites someone to treat estimates as filed figures. */}
        <section className="soli-pknotes">
          <h2>What this is, and is not</h2>
          <p>Prepared from figures entered by the user. It is not tax advice and not a filed return.</p>
          <p>
            {t.rentLogged
              ? `Booth rent uses the ${money2(t.byCat[rentCategory])} actually logged as an expense. The hourly booth-time allocation used for per-service pricing (${money2(t.booth)}) is excluded here, so the same cost is not deducted twice.`
              : `No booth rent was logged as an expense, so booth time is estimated as hours worked times the hourly rate in Settings (${money2(t.booth)}). If you pay rent, logging the actual amounts under Expenses gives a more accurate figure.`}
          </p>
          {/* Naming the empty categories turns a vague disclaimer into a
              checklist. These are the costs most likely to have been forgotten,
              and the moment before handing this over is the moment to catch it. */}
          <p>
            Only costs entered into Soli are included.
            {unused.length > 0
              ? ` Nothing was logged this year under ${unused}, so if there were costs of that kind they are missing here.`
              : " Anything paid for but never logged is missing here."}
          </p>
          <p>Amounts are the figures entered at the time. Soli does not convert between currencies, so if the currency setting changed part way through the year, check which entries were recorded in which.</p>
        </section>
      </div>
    </div>,
    document.body
  );
}
