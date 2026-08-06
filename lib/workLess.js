/* What working less would actually cost.

   The whole feature turns on one thing most tools get wrong. Soli charges every
   service a share of booth rent by the hour, which is the fair way to compare
   two services against each other. It is not what happens to the bill when you
   stop doing one of them. Someone paying $250 a week pays $250 whether they
   fill twenty-five hours or fifteen, so the rent freed by working less is
   nothing at all, and only rent charged by the hour genuinely shrinks.

   Get this wrong and the numbers flatter the idea: every hour looks like it
   carries a cost that disappears when the hour does, so dropping work looks
   cheaper than it is and someone gives up income on the strength of it. So the
   arithmetic here is marginal rather than allocated, and the two disagree
   often enough to be the interesting part.

   A consequence worth stating plainly, because it is the opposite of what the
   dashboard implies: when rent is fixed, a service that looks barely profitable
   after its rent share can still be well worth keeping. The rent is owed
   either way. */

/* Rent only falls with hours when it is charged by the hour. Weekly and monthly
   rent is owed whether the chair is used or not. */
export function rentShrinksWithHours(settings) {
  return (settings?.boothRentUnit || "hour") === "hour";
}

/* One row per service type over the window, with the figures a scenario needs.
   Grouped by type rather than by appointment because "stop offering brow tints"
   is a decision someone can act on, and "turn away this particular client" is
   neither actionable nor kind. */
export function serviceRows(logs, rent, sinceMs) {
  const m = new Map();
  (logs || []).forEach((l) => {
    if (!l || new Date(l.date).getTime() < sinceMs) return;
    const name = l.service || "Service";
    const hours = (Number(l.durationMin) || 0) / 60;
    const row = m.get(name) || { name, count: 0, hours: 0, revenue: 0, product: 0, tips: 0 };
    row.count += 1;
    row.hours += hours;
    row.revenue += Number(l.price) || 0;
    row.product += Number(l.productCost) || 0;
    row.tips += Number(l.tip) || 0;
    m.set(name, row);
  });

  return [...m.values()].map((r) => ({
    ...r,
    booth: r.hours * rent, // the allocated share, used for the comparison figure
  }));
}

/* Take-home given up by dropping a set of service types, and the hours it
   hands back.

   Dropping a service loses its price and its tips, and saves the product it
   used. It saves booth rent only when rent is charged by the hour. Tax follows
   the profit, so a smaller profit owes less. */
export function scenario(rows, droppedNames, { taxRate = 0, rentShrinks = false } = {}) {
  const dropped = new Set(droppedNames || []);
  const t = (Number(taxRate) || 0) / 100;

  let hours = 0, revenue = 0, product = 0, tips = 0, booth = 0;
  rows.forEach((r) => {
    if (!dropped.has(r.name)) return;
    hours += r.hours; revenue += r.revenue; product += r.product; tips += r.tips; booth += r.booth;
  });

  const profitLost = revenue - product - (rentShrinks ? booth : 0);
  const takeHomeLost = profitLost * (1 - t) + tips;

  return {
    hoursFreed: hours,
    takeHomeLost,
    /* What those hours were really paying. Null when nothing was dropped or
       nothing had a duration on it, because a rate needs time on the clock and
       a symbol on screen helps nobody. */
    perHourFreed: hours > 0 ? takeHomeLost / hours : null,
  };
}

/* The same figure for one service type on its own, which is what the table
   ranks by. Deliberately not profitOf's perHour: that one subtracts a rent
   share which, on a weekly or monthly agreement, does not go anywhere. */
export function marginalRate(row, { taxRate = 0, rentShrinks = false } = {}) {
  const t = (Number(taxRate) || 0) / 100;
  const profit = row.revenue - row.product - (rentShrinks ? row.booth : 0);
  const takeHome = profit * (1 - t) + row.tips;
  return row.hours > 0 ? takeHome / row.hours : null;
}

/* Rows worst-paying first, which is the order someone would consider dropping
   them in. Anything with no hours recorded sorts last rather than first: it has
   no rate to judge, and putting it at the top would read as a recommendation. */
export function rankByRate(rows, opts) {
  return [...rows]
    .map((r) => ({ ...r, rate: marginalRate(r, opts) }))
    .sort((a, b) => {
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return a.rate - b.rate;
    });
}

/* The one line worth leading with.

   Not simply the worst rate. The question is about getting time back, so three
   hours a month at a bad rate is a weaker answer than eight hours a month at a
   nearly-as-bad one: the second is where working less has room to move. So
   among the work paying below what the week averages, this picks whichever is
   eating the most time.

   Something done once in three months is not a habit worth restructuring
   around, so occasional work is not offered as a headline however bad it looks. */
export function headlineCandidate(ranked, totalHours) {
  const withRate = ranked.filter((r) => r.rate !== null);
  const hours = withRate.reduce((s, r) => s + r.hours, 0);
  if (hours <= 0) return null;

  /* The comparison is against everything they do, including work too
     occasional to headline. Averaging only over the candidates would leave a
     lone regular service with nothing to be below, and no headline at all. */
  const overall = withRate.reduce((s, r) => s + r.rate * r.hours, 0) / hours;

  const candidates = withRate.filter(
    (r) => r.count >= 3 && r.hours >= totalHours * 0.05 && r.rate < overall
  );
  // Everything paying about the same means there is no weak spot to point at.
  if (!candidates.length) return null;
  return candidates.reduce((best, r) => (r.hours > best.hours ? r : best));
}
