/* The Soli mark, matching the app icon and the favicon.

   Shared rather than copied. It lived inside the landing page, so the
   calculator could not reach it and shipped with a plain orange circle in its
   place, which is what a logo becomes when it is easier to redraw than to
   import. */

export default function SunMark({ size = 20, stroke = 1.8, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
