import Link from "next/link";
import KeepCalculator from "@/components/KeepCalculator";
import SunMark from "@/components/SunMark";
import { SITE_URL, SITE_NAME } from "@/lib/site";

const title = "Booth rent calculator: what do you actually keep?";
const description =
  "Work out what you really keep from one appointment after product, booth rent and the tax you should be setting aside. Free, no sign up, for estheticians, stylists, barbers and nail techs.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/calculator" },
  keywords: [
    "booth rent calculator",
    "how much should I set aside for taxes hair stylist",
    "esthetician profit calculator",
    "booth rent tax deduction",
    "what do I actually make after booth rent",
    "salon booth rent worth it",
  ],
  openGraph: { title, description, url: `${SITE_URL}/calculator`, siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

/* Answers the question the page is named after, in the answer's own words, so
   a search result can carry it without anybody clicking. Every figure matches
   what the calculator below actually computes. */
const faq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I work out what I keep after booth rent?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Take the price, subtract the product you used, then subtract your booth rent for the time the appointment took, then set aside tax on what is left. A $160 service taking 90 minutes, using $12 of product, on $250 a week rent for a 25 hour week, leaves $133 before tax and $99.75 after setting aside 25 percent.",
      },
    },
    {
      "@type": "Question",
      name: "How do I turn weekly or monthly booth rent into an hourly rate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Divide weekly rent by the hours you work in a week. For monthly rent, multiply by 12 and divide by 52 to get a weekly figure first, because months are not four weeks. $250 a week over 25 hours is $10 an hour of chair time.",
      },
    },
    {
      "@type": "Question",
      name: "How much should I set aside for taxes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Self employed beauty professionals commonly set aside 25 to 30 percent of profit, which covers income tax plus roughly 15.3 percent self employment tax. Your own figure depends on your income and where you work, so confirm it with a tax professional.",
      },
    },
  ],
};

export default function CalculatorPage() {
  return (
    <div className="kc-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

      <header className="kc-nav">
        <Link href="/" className="kc-brand">
          <span className="kc-mark"><SunMark size={18} stroke={1.9} color="#fff" /></span>
          <span className="kc-word">Soli</span>
        </Link>
        <Link href="/app" className="kc-navcta">Start free</Link>
      </header>

      <main className="kc-main">
        <h1 className="kc-h1">What do you actually keep?</h1>
        <p className="kc-lede">
          Your booking app shows what you billed. This shows what is left after product,
          booth rent and the tax you should be setting aside. Change any number.
        </p>

        <KeepCalculator />

        <section className="kc-faq">
          <h2>The bits people get wrong</h2>
          <h3>Monthly rent is not four weeks</h3>
          <p>
            There are 52 weeks in a year, not 48. Dividing monthly rent by four understates
            your chair cost by about 8 percent, every month, forever. This page multiplies by
            12 and divides by 52 instead.
          </p>
          <h3>Booth rent is not a bill you can ignore per service</h3>
          <p>
            Rent leaves your account whether the chair is full or empty, so it is easy to treat
            as separate from any one appointment. It is not. The hours an appointment occupies
            are hours you have already paid for, which is why a long, cheap service can lose
            money while looking busy.
          </p>
          <h3>Tax is not yours</h3>
          <p>
            Money set aside for tax spends exactly like income right up until it does not.
            Taking it out on every service is what makes April uneventful.
          </p>
          <p className="kc-disclaim">
            This is a calculator, not tax advice, and it only knows the numbers you typed.
            Confirm your own rate with a tax professional.
          </p>
        </section>
      </main>

      <footer className="kc-foot">
        <Link href="/">Soli</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>

      <style>{`
.kc-page{--bg:#F6EFE4;--surface:#FFFDF9;--surface2:#FBF5EB;--ink:#2B2118;--ink2:#6E5E4C;--line:#E7DBC8;
  --clay:#BC6B4C;--clay-d:#A4583B;--profit:#5E7142;--cost:#9A6A54;
  min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:var(--font-hanken),system-ui,sans-serif;line-height:1.5}
.kc-page a{color:inherit;text-decoration:none}

.kc-nav{max-width:1020px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:20px 22px}
.kc-brand{display:flex;align-items:center;gap:11px}
.kc-mark{width:34px;height:34px;border-radius:50%;background:var(--clay);color:#fff;
  display:flex;align-items:center;justify-content:center;flex:none}
.kc-word{font-family:var(--font-fraunces),serif;font-weight:600;font-size:24px;letter-spacing:-.5px}
.kc-navcta{background:var(--ink);color:var(--bg)!important;padding:9px 16px;border-radius:10px;font-weight:600;font-size:14px}

.kc-main{max-width:1020px;margin:0 auto;padding:12px 22px 60px}
.kc-h1{text-wrap:balance;font-family:var(--font-fraunces),serif;font-weight:600;font-size:46px;line-height:1.05;letter-spacing:-1px;margin:18px 0 12px}
.kc-lede{font-size:17px;color:var(--ink2);max-width:56ch;margin:0 0 26px}

.kc{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}
.kc-form{display:flex;flex-direction:column;gap:16px}
.kc-block{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px}
.kc-blockhead{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--ink2);margin-bottom:12px}
.kc-note{font-size:13px;color:var(--ink2);margin:-6px 0 14px}
.kc-row{display:flex;gap:12px;flex-wrap:wrap}
.kc-row>*{flex:1 1 150px;min-width:0}
.kc-field{display:block;margin-bottom:12px}
.kc-field>span{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.kc-field input{width:100%;font-family:inherit;font-size:15px;color:var(--ink);background:var(--surface2);
  border:1px solid var(--line);border-radius:10px;padding:11px 12px;min-width:0}
.kc-field input:focus{outline:2px solid var(--clay);outline-offset:1px}
.kc-money,.kc-suffix{display:flex;align-items:center;gap:8px;background:var(--surface2);
  border:1px solid var(--line);border-radius:10px;padding:0 12px}
.kc-money span,.kc-suffix em{color:var(--ink2);font-size:14px;font-style:normal;flex:none}
.kc-money input,.kc-suffix input{background:none;border:none;padding:11px 0}
.kc-money input:focus,.kc-suffix input:focus{outline:none}
.kc-money:focus-within,.kc-suffix:focus-within{outline:2px solid var(--clay);outline-offset:1px}
.kc-big .kc-money{background:var(--surface)}
.kc-big .kc-money span{font-size:22px}
.kc-big input{font-family:var(--font-fraunces),serif;font-size:30px;font-weight:600;padding:12px 0}

.kc-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.kc-segbtn{font-family:inherit;font-size:12.5px;border:1px solid var(--line);background:var(--surface2);
  color:var(--ink2);border-radius:9px;padding:11px 4px;cursor:pointer}
.kc-segbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}

.kc-result{position:sticky;top:18px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px}
.kc-kept{text-align:center;background:linear-gradient(150deg,#5E7142,#475431);color:#F4F0E4;border-radius:14px;padding:20px 16px}
.kc-result.losing .kc-kept{background:linear-gradient(150deg,#BC6B4C,#A4583B)}
.kc-keptlabel{display:block;font-size:13px;opacity:.85}
.kc-keptval{display:block;font-family:var(--font-fraunces),serif;font-size:52px;font-weight:600;line-height:1.05;margin:4px 0 2px}
.kc-keptsub{display:block;font-size:13px;opacity:.85}

.kc-chain{margin-top:16px}
.kc-crow{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0;font-size:14px}
.kc-crow b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.kc-crow.out b{color:var(--cost)}
.kc-crow.sub{border-top:1px solid var(--line);margin-top:4px;padding-top:10px;font-weight:600}
.kc-crow.total{border-top:2px solid var(--ink);margin-top:4px;padding-top:11px;font-weight:600}
.kc-crow.total b{font-family:var(--font-fraunces),serif;font-size:19px;color:var(--profit)}
.kc-result.losing .kc-crow.total b{color:var(--clay-d)}
.kc-perhour{font-size:14px;color:var(--ink2);text-align:center;margin:14px 0 0}
.kc-perhour b{color:var(--ink)}

.kc-cta{margin-top:18px;padding-top:18px;border-top:1px solid var(--line);text-align:center}
.kc-cta p{font-size:14px;color:var(--ink2);margin:0 0 12px}
.kc-btn{display:block;background:var(--clay);color:#fff!important;font-weight:600;font-size:16px;padding:14px;border-radius:12px}
.kc-ctanote{display:block;font-size:12px;color:var(--ink2);margin-top:9px}

.kc-faq{max-width:62ch;margin:56px auto 0}
.kc-faq h2{font-family:var(--font-fraunces),serif;font-size:28px;font-weight:600;letter-spacing:-.5px;margin:0 0 6px}
.kc-faq h3{font-family:var(--font-fraunces),serif;font-size:19px;font-weight:600;margin:26px 0 6px}
.kc-faq p{font-size:15.5px;color:var(--ink2);margin:0 0 10px}
.kc-disclaim{font-size:13px!important;border-top:1px solid var(--line);padding-top:14px;margin-top:22px!important}

.kc-foot{max-width:1020px;margin:0 auto;display:flex;gap:20px;justify-content:center;
  padding:26px 22px 40px;font-size:13.5px;color:var(--ink2);border-top:1px solid var(--line)}

@media(max-width:860px){
  /* Answer first on a phone. Side by side there is nothing to choose between
     them, but stacked the result landed two full screens down, so the page
     opened on a form and buried the thing it exists to show. Every field is
     prefilled, so leading with a finished answer costs nothing and the inputs
     underneath turn it into theirs. */
  .kc{display:flex;flex-direction:column}
  .kc-result{order:-1;position:static}
  .kc-h1{font-size:34px}
  .kc-lede{font-size:16px}
  /* The chain and the sign-up ask sit below the fold on the way down to the
     form, so the number itself carries the whole first screen. */
  .kc-keptval{font-size:46px}
}
      `}</style>
    </div>
  );
}
