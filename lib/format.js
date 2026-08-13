/* Money and dates, as the screens show them.

   Pulled out of the app page so views can live in their own files and be
   rendered by a test. Nothing here knows about React.

   The display symbol is module state rather than a parameter, which is how it
   already worked: the signed-in user's currency is set once per render and
   every money() below reads it. Keeping that shape means the move changed
   where this code lives and not what it does. Both the page and the views
   import this same module, so they share the one value. */

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar (CA$)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
];

export const curSymbol = (code) =>
  (CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]).symbol;

let CUR = "$"; // active display symbol; set from the signed-in user's settings on each render

/* Returns the symbol so callers can keep their own copy, which the page does
   to pass into components that take a currency rather than call money(). */
export function setDisplayCurrency(code) {
  CUR = curSymbol(code);
  return CUR;
}

export const displayCurrency = () => CUR;

export const money = (n) => CUR + Math.round(n).toLocaleString();
export const money2 = (n) =>
  CUR + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const round2 = (n) => Math.round(n * 100) / 100;
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
