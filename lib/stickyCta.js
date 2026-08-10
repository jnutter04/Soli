/* When the floating "Start free" bar belongs on screen.

   Kept apart from the component because the decision is the part worth being
   sure about, and a rule expressed in numbers can be tested without a browser,
   a scroll position, or a rendered page.

   Two conditions, both about not being a nuisance. The bar stays away while the
   hero button is still on screen, since covering the page to offer a button
   somebody can already see is just a smaller version of the problem it solves.
   It leaves again over the closing section, which has its own full width call
   to action, so the two never stack up at the bottom of the screen. */

export function shouldShowSticky({ heroBottom, closingTop, viewportHeight }) {
  // Nothing to measure against, so stay out of the way.
  if (typeof heroBottom !== "number") return false;

  // Strictly above the top edge: scrolled past, rather than not yet reached.
  const heroScrolledPast = heroBottom < 0;
  const closingInView = typeof closingTop === "number" && closingTop < viewportHeight;

  return heroScrolledPast && !closingInView;
}
