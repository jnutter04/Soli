/* Moments worth interrupting somebody for.

   Sharing used to be a permanent button on the dashboard, which asks the user
   to decide that today is worth posting about. Nobody does that, so a button
   that is always there is furniture. Soli holds the figures, so Soli can
   notice, and only speak up when there is something true to say.

   One kind of milestone on purpose. A best month is meaningful, it can be
   checked rather than asserted, and it can only happen once a month, so it
   cannot become nagging. */

const round2 = (n) => Math.round(n * 100) / 100;

/* months: oldest first, each { key: "2026-08", value: takeHomeForThatMonth }.
   The last entry is the month in progress.

   Returns null unless the current month has genuinely beaten every month
   before it. The old card printed "My best month yet" whenever the amount was
   hidden, without ever checking, which made the app put a claim in someone's
   mouth that might not be true. */
export function bestMonthSoFar(months) {
  if (!Array.isArray(months) || months.length < 2) return null;

  const current = months[months.length - 1];
  if (!current || !(current.value > 0)) return null;

  const earlier = months.slice(0, -1).filter((m) => m && typeof m.value === "number");
  // Nothing to beat is not an achievement, it is a first month.
  if (earlier.length === 0) return null;

  const previousBest = Math.max(...earlier.map((m) => m.value));
  if (previousBest <= 0) return null;
  if (current.value <= previousBest) return null;

  return {
    kind: "bestMonth",
    key: current.key,
    value: round2(current.value),
    previousBest: round2(previousBest),
    beatBy: round2(current.value - previousBest),
  };
}

/* Whether to offer the card right now.

   `promptedFor` is the month key already offered. Offering the same month
   twice would turn a compliment into a pestering, and someone who said no
   once has answered for that month. */
export function shouldOfferShare({ months, promptedFor }) {
  const milestone = bestMonthSoFar(months);
  if (!milestone) return null;
  if (promptedFor && promptedFor === milestone.key) return null;
  return milestone;
}
