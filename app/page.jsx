import Link from "next/link";

/* Reusable sun mark (matches the app + favicon) */
function SunMark({ size = 20, stroke = 1.8, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <LandingStyles />

      {/* NAV */}
      <header className="lp-nav">
        <div className="lp-brand">
          <span className="lp-logomark"><SunMark size={18} stroke={1.9} color="#fff" /></span>
          <span className="lp-word">Soli</span>
        </div>
        <nav className="lp-navlinks">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <Link href="/app" className="lp-navcta">Open the app</Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-herocopy">
          <span className="lp-eyebrow">Profit-first tracking for beauty pros</span>
          <h1 className="lp-h1">Know what you<br /><span className="lp-underline">actually keep.</span></h1>
          <p className="lp-lead">
            Your booking app shows what you <em>billed</em>. Soli shows what you <strong>earned</strong>:
            after product, booth rent, and the tax you should be setting aside. In about 20 seconds per client.
          </p>
          <div className="lp-cta-row">
            <Link href="/app" className="lp-cta">See your real take-home →</Link>
            <Link href="/app?demo=1" className="lp-cta-ghost">Try it with sample data</Link>
          </div>
          <div className="lp-trust">
            <span><Check /> No card required</span>
            <span><Check /> Works in your browser</span>
            <span><Check /> Your data stays on your device</span>
          </div>
        </div>

        {/* Hero visual: a stylized take-home card */}
        <div className="lp-herocard" aria-hidden="true">
          <div className="lp-hc-take">
            <span className="lp-hc-label"><SunMark size={14} stroke={2} /> Your real take-home · last 30 days</span>
            <span className="lp-hc-big">$4,182.50</span>
            <span className="lp-hc-sub">after product, booth rent &amp; taxes</span>
          </div>
          <div className="lp-hc-row"><span>Revenue billed</span><span>$7,310.00</span></div>
          <div className="lp-hc-row cost"><span>– Product &amp; booth time</span><span>$1,338.00</span></div>
          <div className="lp-hc-row cost"><span>– Tax jar (30%)</span><span>$1,789.50</span></div>
          <div className="lp-hc-jar">
            <span><SunMark size={13} stroke={2} /> Set aside for taxes</span>
            <span className="lp-hc-jarval">$1,789.50</span>
          </div>
        </div>
      </section>

      {/* HIDDEN INCOME: the sharpest differentiator */}
      <section className="lp-band">
        <div className="lp-band-inner">
          <span className="lp-kicker">The number your booking app can't see</span>
          <h2 className="lp-h2">Booking platforms only count card payments.<br />You earn more than they think.</h2>
          <p className="lp-band-p">
            Cash. Venmo. Zelle. It's real income, and it vanishes from every report that's tied to a card reader.
            Soli captures <strong>every dollar, from every payment method</strong>, so your numbers are actually complete
            and your profit is the truth, not a fraction of it.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-features" id="features">
        <h2 className="lp-h2 center">Everything points at one question: what's left for you?</h2>
        <div className="lp-grid">
          <Feature title="Real take-home, instantly"
            body="Log a service and Soli does the profit, booth-rent, and tax math for you, so you always know what's actually yours." />
          <Feature title="A tax jar that saves you"
            body="Every service sets aside a percentage automatically. No more April panic, no more spending money that was never yours." />
          <Feature title="Profit per hour, ranked"
            body="See which services actually pay, and which quietly cost you. Stop guessing which work to chase." />
          <Feature title="What should I charge?"
            body="Work backward from the take-home you want. Soli tells you the price and the number of clients to hit it." />
          <Feature title="Clients ranked by real worth"
            body="Lifetime profit per client, not just visit count. Know exactly who's worth rebooking." />
          <Feature title="Rebooking reminders"
            body="See who's overdue before they drift to someone else. Retention is cheaper than acquisition." />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-how" id="how">
        <h2 className="lp-h2 center">Three taps. Then the truth.</h2>
        <div className="lp-steps">
          <Step n="1" title="Log a service" body="Price, time in the chair, products used, and how they paid. About 20 seconds." />
          <Step n="2" title="See your numbers" body="Take-home, tax set-aside, profit per hour, and your most valuable clients, all done for you." />
          <Step n="3" title="Keep more" body="Raise the right prices, drop the thin earners, and rebook the clients that matter." />
        </div>
      </section>

      {/* Honest value cards (real testimonials can replace these once collected) */}
      <section className="lp-quotes">
        <h2 className="lp-h2 center">Built for the chair, not the spreadsheet</h2>
        <div className="lp-quote-grid">
          <div className="lp-quote">
            <div className="lp-qtitle">Your real take-home</div>
            <p className="lp-qbody">"A good month" means nothing until product, booth rent, and taxes come out. Soli does that math on every service, automatically.</p>
          </div>
          <div className="lp-quote">
            <div className="lp-qtitle">Every dollar counted</div>
            <p className="lp-qbody">Cash, Venmo, and Zelle are real income your card-only reports ignore. Soli counts all of it, so your numbers are complete.</p>
          </div>
          <div className="lp-quote">
            <div className="lp-qtitle">No more April surprises</div>
            <p className="lp-qbody">A tax jar sets money aside from every service, so tax time is money you already saved, not a shock.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL (real, from Jordan) */}
      <section className="lp-testi">
        <div className="lp-testi-inner">
          <div className="lp-testi-mark">&ldquo;</div>
          <blockquote className="lp-testi-quote">
            I chose Soli because when I started out on my own it was difficult to keep track of finances.
            Soli made it easy to put in the numbers and let it take care of the rest.
          </blockquote>
          <div className="lp-testi-by">
            <span className="lp-testi-avatar">J</span>
            <div>
              <div className="lp-testi-name">Jordan</div>
              <div className="lp-testi-role">Soli customer</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-final">
        <div className="lp-final-inner">
          <span className="lp-logomark big"><SunMark size={26} stroke={1.8} color="#fff" /></span>
          <h2 className="lp-h2 center light">See what you actually keep.</h2>
          <p className="lp-final-p">Free to start. Nothing to install. Your first real take-home number is 20 seconds away.</p>
          <Link href="/app" className="lp-cta light">Open Soli →</Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-brand">
          <span className="lp-logomark sm"><SunMark size={14} stroke={2} color="#fff" /></span>
          <span className="lp-word sm">Soli</span>
        </div>
        <span className="lp-foot-tag">Know what you actually keep.</span>
        <Link href="/privacy" className="lp-foot-link">Privacy</Link>
        <Link href="/terms" className="lp-foot-link">Terms</Link>
        <Link href="/app" className="lp-foot-link">Open the app →</Link>
      </footer>
    </div>
  );
}

function Feature({ title, body }) {
  return (
    <div className="lp-feat">
      <span className="lp-feat-dot"><Check /></span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="lp-step">
      <span className="lp-step-n">{n}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function LandingStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.lp{--bg:#F6EFE4;--surface:#FFFDF9;--surface2:#FBF5EB;--ink:#2B2118;--ink2:#6E5E4C;--line:#E7DBC8;
  --clay:#BC6B4C;--clay-d:#A4583B;--sage:#6E7A56;--sage-d:#5A6646;--profit:#5E7142;--cost:#9A6A54;--gold:#C9A24B;
  font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;
  background-image:radial-gradient(circle at 12% -5%,rgba(201,162,75,.12),transparent 40%),radial-gradient(circle at 92% 2%,rgba(188,107,76,.10),transparent 38%)}
.lp *{box-sizing:border-box}
.lp a{text-decoration:none;color:inherit}

/* nav */
.lp-nav{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:22px 26px}
.lp-brand{display:flex;align-items:center;gap:10px}
.lp-logomark{width:34px;height:34px;border-radius:50%;background:var(--clay);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(188,107,76,.35)}
.lp-logomark.big{width:60px;height:60px;margin-bottom:6px}
.lp-logomark.sm{width:26px;height:26px}
.lp-word{font-family:'Fraunces',serif;font-weight:600;font-size:26px;letter-spacing:-.5px}
.lp-word.sm{font-size:19px}
.lp-navlinks{display:flex;align-items:center;gap:26px;font-size:15px;color:var(--ink2)}
.lp-navlinks a:hover{color:var(--ink)}
.lp-navcta{background:var(--ink);color:var(--bg)!important;padding:9px 16px;border-radius:10px;font-weight:600;font-size:14px}
.lp-navcta:hover{background:#000}
@media(max-width:620px){.lp-navlinks a:not(.lp-navcta){display:none}}

/* hero */
.lp-hero{max-width:1080px;margin:0 auto;padding:46px 26px 70px;display:grid;grid-template-columns:1.05fr .95fr;gap:54px;align-items:center}
@media(max-width:880px){.lp-hero{grid-template-columns:1fr;gap:40px;padding-top:30px}}
.lp-eyebrow{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.4px;color:var(--clay-d);background:#F6E5DA;padding:6px 13px;border-radius:20px;margin-bottom:20px}
.lp-h1{font-family:'Fraunces',serif;font-weight:600;font-size:62px;line-height:1.02;letter-spacing:-1.5px;margin:0 0 22px}
@media(max-width:880px){.lp-h1{font-size:48px}}
.lp-underline{color:var(--clay-d);position:relative;white-space:nowrap}
.lp-underline:after{content:"";position:absolute;left:0;right:0;bottom:4px;height:10px;background:rgba(201,162,75,.35);border-radius:6px;z-index:-1}
.lp-lead{font-size:19px;color:var(--ink2);max-width:520px;margin:0 0 30px}
.lp-lead strong{color:var(--ink)}
.lp-cta-row{display:flex;gap:13px;flex-wrap:wrap;margin-bottom:24px}
.lp-cta{background:var(--clay);color:#fff;font-weight:600;font-size:16px;padding:15px 26px;border-radius:13px;box-shadow:0 8px 20px rgba(188,107,76,.30);transition:.15s}
.lp-cta:hover{background:var(--clay-d);transform:translateY(-1px)}
.lp-cta.light{background:#fff;color:var(--clay-d);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.lp-cta-ghost{font-weight:600;font-size:16px;padding:15px 22px;border-radius:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink);transition:.15s}
.lp-cta-ghost:hover{border-color:var(--clay)}
.lp-trust{display:flex;flex-wrap:wrap;gap:18px;font-size:13.5px;color:var(--ink2)}
.lp-trust span{display:inline-flex;align-items:center;gap:6px}
.lp-trust svg{color:var(--sage-d)}

/* hero card */
.lp-herocard{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 24px 60px -24px rgba(43,33,24,.30)}
.lp-hc-take{background:linear-gradient(150deg,#5E7142,#475431);color:#F4F0E4;border-radius:16px;padding:22px;display:flex;flex-direction:column;margin-bottom:14px}
.lp-hc-label{font-size:12.5px;display:flex;align-items:center;gap:6px;color:#D6DBC2;margin-bottom:10px}
.lp-hc-big{font-family:'Fraunces',serif;font-size:42px;font-weight:600;line-height:1}
.lp-hc-sub{font-size:12px;opacity:.82;margin-top:7px}
.lp-hc-row{display:flex;justify-content:space-between;font-size:14px;color:var(--ink2);padding:8px 4px;border-bottom:1px solid var(--line)}
.lp-hc-row.cost{color:var(--cost)}
.lp-hc-jar{display:flex;justify-content:space-between;align-items:center;margin-top:14px;background:linear-gradient(150deg,#C9A24B,#A9863A);color:#fff;border-radius:13px;padding:13px 16px;font-size:13px}
.lp-hc-jar span{display:inline-flex;align-items:center;gap:6px}
.lp-hc-jarval{font-family:'Fraunces',serif;font-size:18px;font-weight:600}

/* band */
.lp-band{background:var(--ink);color:#F4ECDE;margin:0;padding:78px 26px}
.lp-band-inner{max-width:860px;margin:0 auto;text-align:center}
.lp-kicker{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--gold);margin-bottom:18px}
.lp-band .lp-h2{color:#FFFDF9}
.lp-band-p{font-size:18px;color:#CDBFA8;max-width:680px;margin:18px auto 0}
.lp-band-p strong{color:#fff}

/* shared headings */
.lp-h2{font-family:'Fraunces',serif;font-weight:600;font-size:36px;line-height:1.12;letter-spacing:-.8px;margin:0}
.lp-h2.center{text-align:center}
.lp-h2.light{color:#fff}
@media(max-width:880px){.lp-h2{font-size:28px}}

/* features */
.lp-features{max-width:1080px;margin:0 auto;padding:80px 26px}
.lp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}
@media(max-width:880px){.lp-grid{grid-template-columns:1fr}}
.lp-feat{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:24px}
.lp-feat-dot{width:34px;height:34px;border-radius:10px;background:#E4E8D6;color:var(--sage-d);display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.lp-feat h3{font-family:'Fraunces',serif;font-size:19px;font-weight:600;margin:0 0 8px}
.lp-feat p{font-size:14.5px;color:var(--ink2);margin:0}

/* how */
.lp-how{max-width:1080px;margin:0 auto;padding:20px 26px 90px}
.lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:44px}
@media(max-width:880px){.lp-steps{grid-template-columns:1fr}}
.lp-step{padding:8px 6px}
.lp-step-n{width:40px;height:40px;border-radius:50%;background:var(--clay);color:#fff;font-family:'Fraunces',serif;font-size:19px;font-weight:600;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.lp-step h3{font-family:'Fraunces',serif;font-size:20px;font-weight:600;margin:0 0 8px}
.lp-step p{font-size:15px;color:var(--ink2);margin:0;max-width:300px}

/* quotes */
.lp-quotes{background:var(--surface2);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:80px 26px}
.lp-quote-grid{max-width:1080px;margin:44px auto 0;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
@media(max-width:880px){.lp-quote-grid{grid-template-columns:1fr}}
.lp-quote{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:24px;margin:0}
.lp-quote blockquote{font-family:'Fraunces',serif;font-size:18px;line-height:1.45;margin:0 0 18px;color:var(--ink)}
.lp-quote figcaption{display:flex;flex-direction:column;gap:2px}
.lp-q-name{font-weight:600;font-size:13.5px;color:var(--clay-d)}
.lp-q-role{font-size:12.5px;color:var(--ink2)}
.lp-qtitle{font-family:'Fraunces',serif;font-weight:600;font-size:19px;color:var(--clay-d);margin-bottom:10px}
.lp-qbody{font-size:15px;line-height:1.5;color:var(--ink2);margin:0}
.lp-testi{padding:20px 26px 50px}
.lp-testi-inner{max-width:720px;margin:0 auto;background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:38px 44px 32px;text-align:center;box-shadow:0 20px 50px -30px rgba(43,33,24,.3)}
.lp-testi-mark{font-family:'Fraunces',serif;font-size:70px;line-height:.4;color:var(--clay);height:34px}
.lp-testi-quote{font-family:'Fraunces',serif;font-weight:500;font-size:23px;line-height:1.5;color:var(--ink);margin:14px auto 26px;max-width:600px}
.lp-testi-by{display:inline-flex;align-items:center;gap:12px}
.lp-testi-avatar{width:46px;height:46px;border-radius:50%;background:var(--clay);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:600;font-size:21px}
.lp-testi-name{font-weight:600;font-size:15px;text-align:left;color:var(--ink)}
.lp-testi-role{font-size:13px;color:var(--ink2);text-align:left}

/* final */
.lp-final{padding:30px 26px 90px}
.lp-final-inner{max-width:720px;margin:0 auto;background:linear-gradient(150deg,#BC6B4C,#A4583B);border-radius:28px;padding:56px 32px;text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;box-shadow:0 24px 60px -22px rgba(164,88,59,.55)}
.lp-final .lp-logomark.big{background:rgba(255,255,255,.16);box-shadow:none}
.lp-final-p{font-size:17px;color:#F6E5DA;margin:14px 0 28px;max-width:440px}

/* footer */
.lp-footer{max-width:1080px;margin:0 auto;padding:30px 26px 50px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;border-top:1px solid var(--line)}
.lp-foot-tag{font-size:13px;color:var(--ink2);font-style:italic;flex:1}
.lp-foot-link{font-size:14px;font-weight:600;color:var(--clay-d)}
@media(max-width:620px){.lp-foot-tag{flex:1 0 100%;order:3}}
`}</style>
  );
}
