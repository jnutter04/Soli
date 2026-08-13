/* A logged service, and what can be worked out from one.

   This is the arithmetic the whole product rests on, so it lives on its own
   where it can be read and tested without a browser. */

export const SOURCES = [
  { id: "cash", label: "Cash" },
  { id: "venmo", label: "Venmo / Zelle" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
];

export const srcLabel = (id) => (SOURCES.find((s) => s.id === id) || {}).label || "Other";

export function profitOf(log, rent) {
  const booth = (log.durationMin / 60) * rent;
  const profit = log.price - log.productCost - booth;
  /* A rate needs time, and a margin needs a price. Dividing by zero produced
     Infinity and NaN, which reached the screen as "$∞" and "$NaN". Imported
     services often arrive with no duration, so this is reachable. null means
     "cannot be worked out" and the screens say so instead of printing a symbol. */
  const hours = log.durationMin / 60;
  return {
    booth,
    profit,
    perHour: hours > 0 ? profit / hours : null,
    margin: log.price > 0 ? profit / log.price : null,
  };
}

/* Prefilled text so a rebooking nudge is one tap rather than a blank message
   somebody has to compose while a client is in the chair. */
export const rebookSms = (phone, name) =>
  `sms:${String(phone || "").replace(/[^0-9+]/g, "")}?&body=${encodeURIComponent(
    `Hi ${String(name || "").split(" ")[0]}! It has been a little while since your last visit. Want me to get you back on the books?`
  )}`;
