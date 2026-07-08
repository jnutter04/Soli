import Link from "next/link";

/* Shared wrapper + styling for the Privacy and Terms pages. */
export default function LegalShell({ title, updated, children }) {
  return (
    <div className="legal">
      <LegalStyles />
      <header className="legal-nav">
        <Link href="/" className="legal-brand">
          <span className="legal-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </span>
          <span className="legal-word">Soli</span>
        </Link>
        <Link href="/app" className="legal-open">Open the app →</Link>
      </header>
      <main className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        {children}
        <p className="legal-back"><Link href="/">← Back to home</Link></p>
      </main>
    </div>
  );
}

function LegalStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.legal{min-height:100vh;background:#F6EFE4;color:#2B2118;font-family:'Hanken Grotesk',system-ui,sans-serif;line-height:1.6;
  background-image:radial-gradient(circle at 12% 0%,rgba(201,162,75,.10),transparent 42%)}
.legal *{box-sizing:border-box}
.legal a{color:#A4583B;text-decoration:none}
.legal a:hover{text-decoration:underline}
.legal-nav{max-width:760px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:20px 24px}
.legal-brand{display:flex;align-items:center;gap:9px;color:#2B2118}
.legal-mark{width:30px;height:30px;border-radius:50%;background:#BC6B4C;display:flex;align-items:center;justify-content:center}
.legal-word{font-family:'Fraunces',serif;font-weight:600;font-size:22px;letter-spacing:-.5px}
.legal-open{font-size:14px;font-weight:600}
.legal-main{max-width:760px;margin:0 auto;padding:20px 24px 80px}
.legal-main h1{font-family:'Fraunces',serif;font-weight:600;font-size:36px;letter-spacing:-.6px;margin:14px 0 4px}
.legal-updated{color:#6E5E4C;font-size:14px;margin:0 0 30px}
.legal-main h2{font-family:'Fraunces',serif;font-weight:600;font-size:21px;margin:32px 0 8px}
.legal-main p{margin:0 0 14px;font-size:15.5px;color:#3a2f24}
.legal-main ul{margin:0 0 14px;padding-left:22px}
.legal-main li{margin:0 0 8px;font-size:15.5px;color:#3a2f24}
.legal-note{background:#FBF5EB;border:1px solid #E7DBC8;border-radius:12px;padding:14px 16px;font-size:14.5px}
.legal-back{margin-top:40px;padding-top:20px;border-top:1px solid #E7DBC8;font-weight:600}
`}</style>
  );
}
