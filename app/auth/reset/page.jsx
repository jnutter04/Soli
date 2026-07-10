"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, "", "/auth/reset");
        }
        const { data: { user } } = await supabase.auth.getUser();
        setValid(!!user);
      } catch {
        setValid(false);
      }
      setReady(true);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setBusy(false); return; }
    setDone(true);
    setTimeout(() => { router.push("/app"); router.refresh(); }, 1300);
  };

  return (
    <div className="rp-root">
      <ResetStyles />
      <div className="rp-card">
        <div className="rp-brand">
          <span className="rp-logomark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </span>
          <span className="rp-word">Soli</span>
        </div>

        {!ready ? (
          <p className="rp-sub">Checking your reset link…</p>
        ) : done ? (
          <>
            <h1 className="rp-h1">Password updated</h1>
            <p className="rp-sub">Taking you into the app…</p>
          </>
        ) : valid ? (
          <>
            <h1 className="rp-h1">Set a new password</h1>
            <p className="rp-sub">Choose a new password for your account.</p>
            <form onSubmit={submit}>
              <label className="rp-label">New password</label>
              <input className="rp-input" type="password" autoComplete="new-password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
              {error && <div className="rp-error">{error}</div>}
              <button className="rp-btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="rp-h1">Link expired</h1>
            <p className="rp-sub">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Link href="/login" className="rp-btn rp-btnlink">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}

function ResetStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.rp-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  font-family:'Hanken Grotesk',system-ui,sans-serif;color:#2B2118;background:#F6EFE4;
  background-image:radial-gradient(circle at 15% 0%,rgba(201,162,75,.14),transparent 42%),radial-gradient(circle at 88% 6%,rgba(188,107,76,.10),transparent 40%)}
.rp-root *{box-sizing:border-box}
.rp-card{width:100%;max-width:400px;background:#FFFDF9;border:1px solid #E7DBC8;border-radius:22px;padding:34px 30px;box-shadow:0 24px 60px -28px rgba(43,33,24,.3)}
.rp-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.rp-logomark{width:36px;height:36px;border-radius:50%;background:#BC6B4C;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(188,107,76,.35)}
.rp-word{font-family:'Fraunces',serif;font-weight:600;font-size:26px;letter-spacing:-.5px}
.rp-h1{font-family:'Fraunces',serif;font-weight:600;font-size:27px;margin:0 0 4px;letter-spacing:-.5px}
.rp-sub{color:#6E5E4C;font-size:14.5px;margin:0 0 22px}
.rp-label{display:block;font-size:13px;font-weight:600;margin:0 0 7px}
.rp-input{width:100%;font-family:inherit;font-size:15px;color:#2B2118;background:#FFFDF9;border:1px solid #E7DBC8;border-radius:11px;padding:12px 13px;margin-bottom:16px;outline:none;transition:.15s}
.rp-input:focus{border-color:#BC6B4C;box-shadow:0 0 0 3px rgba(188,107,76,.12)}
.rp-btn{display:block;width:100%;text-align:center;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;background:#BC6B4C;color:#fff;padding:14px;border-radius:12px;transition:.15s;box-shadow:0 6px 16px rgba(188,107,76,.28)}
.rp-btn:hover{background:#A4583B}
.rp-btn:disabled{opacity:.55;cursor:not-allowed}
.rp-btnlink{text-decoration:none}
.rp-error{background:#F6E0D5;border:1px solid #E8C4B0;color:#A4583B;font-size:13.5px;border-radius:10px;padding:10px 12px;margin-bottom:14px}
`}</style>
  );
}
