/* One service, worked through to what is left.

   The same arithmetic the dashboard runs, on a single appointment somebody
   types in before they have an account. Kept pure so the public calculator and
   its tests share one definition, and so the answer a stranger sees on the
   landing page cannot drift from the one Soli gives them after they sign up. */

import { boothHourly } from "./service.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function whatYouKeep({
  price, productCost, minutes,
  rentAmount, rentUnit = "week", hoursPerWeek,
  taxRate,
}) {
  const hours = Math.max(0, num(minutes)) / 60;
  const rentPerHour = boothHourly({
    boothRentUnit: rentUnit,
    boothRentAmount: rentAmount,
    boothRentHoursPerWeek: hoursPerWeek,
  });

  const revenue = Math.max(0, num(price));
  const product = Math.max(0, num(productCost));
  const booth = hours * rentPerHour;
  const beforeTax = revenue - product - booth;

  /* No tax is owed on a service that lost money, and applying a rate to a
     negative would hand back a "refund" that does not exist. A losing service
     is a real answer worth showing, so it is reported rather than floored. */
  const tax = beforeTax > 0 ? beforeTax * (Math.max(0, num(taxRate)) / 100) : 0;
  const kept = beforeTax - tax;

  return {
    revenue, product, booth, beforeTax, tax, kept,
    rentPerHour,
    hours,
    // A rate needs time on the clock, the same rule the app uses.
    keptPerHour: hours > 0 ? kept / hours : null,
    // What share of the price survives. Undefined on a free service.
    keptShare: revenue > 0 ? kept / revenue : null,
  };
}
