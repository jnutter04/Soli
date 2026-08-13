"use client";

/* A way back to the one action, once the first one has scrolled away.

   The page is six screens tall. Somebody convinced by the testimonial at
   screen five had to scroll back to the top or hunt the header, and a decision
   that has to be re-found is a decision that gets dropped.

   Deliberately not always on. It stays hidden while the hero button is still on
   screen, because covering the page to offer a button that is already visible
   is just a smaller version of the problem. It hides again over the closing
   section, which has its own full width call to action, so the two never stack
   up at the bottom of the screen arguing with each other. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { shouldShowSticky } from "@/lib/stickyCta";

export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    /* A scroll listener rather than IntersectionObserver, which would be the
       tidier tool but could not be verified working here. Two reads of
       getBoundingClientRect on a landing page cost nothing measurable, and
       rAF means the work happens once per painted frame however fast the
       scroll events arrive. */
    let frame = 0;

    const measure = () => {
      frame = 0;
      const hero = document.querySelector(".lp-cta-row");
      const closing = document.querySelector(".lp-final");
      // This file only reads the page. The rule itself lives in lib, where it
      // can be tested without a browser.
      setShow(shouldShowSticky({
        heroBottom: hero ? hero.getBoundingClientRect().bottom : null,
        closingTop: closing ? closing.getBoundingClientRect().top : null,
        viewportHeight: window.innerHeight,
      }));
    };

    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={"lp-sticky" + (show ? " on" : "")} aria-hidden={!show}>
      {/* Off the tab order while hidden, so keyboard users are not sent to a
          button sitting outside the screen. */}
      <Link href="/app" className="lp-sticky-btn" tabIndex={show ? 0 : -1}>
        Start free &rarr;
      </Link>
    </div>
  );
}
