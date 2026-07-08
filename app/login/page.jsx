"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* Reusable sun mark (matches the app + landing) */
function SunMark({ size = 20, stroke = 1.8, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const signInWithGoogle = async () => {
    setError(""); setNotice(""); setBusy(true);
    const supabase = createClient();
    const next = new URLSearchParams(window.location.search).get("next") || "/app";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setBusy(false); }
    // on success the browser is redirected to Google
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          setBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const next = new URLSearchParams(window.location.search).get("next") || "/app";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="lg-root">
      <LoginStyles />
      <div className="lg-card">
        <div className="lg-brand">
          <span className="lg-logomark"><SunMark size={20} stroke={1.9} color="#fff" /></span>
          <span className="lg-word">Soli</span>
        </div>
        <h1 className="lg-h1">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="lg-sub">
          {mode === "signup"
            ? "Start tracking what you actually keep."
            : "Sign in to see your numbers."}
        </p>

        <button type="button" className="lg-google" onClick={signInWithGoogle} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 15.6 2 8.3 6.8 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 36.6 26.9 37.6 24 37.6c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C8.2 41.1 15.5 46 24 46z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.4 36.3 46 31 46 24c0-1.5-.2-2.6-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>
        <div className="lg-divider"><span>or</span></div>

        <form onSubmit={submit}>
          <label className="lg-label">Email</label>
          <input className="lg-input" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

          <label className="lg-label">Password</label>
          <input className="lg-input" type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"} required
            minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} />

          {error && <div className="lg-error">{error}</div>}
          {notice && <div className="lg-notice">{notice}</div>}

          <button className="lg-btn" type="submit" disabled={busy}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="lg-switch">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>Sign in</button>
            </>
          ) : (
            <>New to Soli?{" "}
              <button onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Create an account</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
.lg-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  font-family:'Hanken Grotesk',system-ui,sans-serif;color:#2B2118;background:#F6EFE4;
  background-image:radial-gradient(circle at 15% 0%,rgba(201,162,75,.14),transparent 42%),radial-gradient(circle at 88% 6%,rgba(188,107,76,.10),transparent 40%)}
.lg-root *{box-sizing:border-box}
.lg-card{width:100%;max-width:400px;background:#FFFDF9;border:1px solid #E7DBC8;border-radius:22px;padding:34px 30px;box-shadow:0 24px 60px -28px rgba(43,33,24,.3)}
.lg-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.lg-logomark{width:36px;height:36px;border-radius:50%;background:#BC6B4C;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(188,107,76,.35)}
.lg-word{font-family:'Fraunces',serif;font-weight:600;font-size:26px;letter-spacing:-.5px}
.lg-h1{font-family:'Fraunces',serif;font-weight:600;font-size:27px;margin:0 0 4px;letter-spacing:-.5px}
.lg-sub{color:#6E5E4C;font-size:14.5px;margin:0 0 22px}
.lg-label{display:block;font-size:13px;font-weight:600;margin:0 0 7px}
.lg-input{width:100%;font-family:inherit;font-size:15px;color:#2B2118;background:#FFFDF9;border:1px solid #E7DBC8;border-radius:11px;padding:12px 13px;margin-bottom:16px;outline:none;transition:.15s}
.lg-input:focus{border-color:#BC6B4C;box-shadow:0 0 0 3px rgba(188,107,76,.12)}
.lg-btn{width:100%;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;background:#BC6B4C;color:#fff;padding:14px;border-radius:12px;margin-top:4px;transition:.15s;box-shadow:0 6px 16px rgba(188,107,76,.28)}
.lg-btn:hover{background:#A4583B}
.lg-btn:disabled{opacity:.55;cursor:not-allowed}
.lg-error{background:#F6E0D5;border:1px solid #E8C4B0;color:#A4583B;font-size:13.5px;border-radius:10px;padding:10px 12px;margin-bottom:14px}
.lg-notice{background:#EDF0E2;border:1px solid #D3DBBC;color:#5A6646;font-size:13.5px;border-radius:10px;padding:10px 12px;margin-bottom:14px}
.lg-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;background:#FFFDF9;color:#2B2118;border:1px solid #E7DBC8;padding:12px;border-radius:12px;transition:.15s}
.lg-google:hover{border-color:#BC6B4C;background:#fff}
.lg-google:disabled{opacity:.55;cursor:not-allowed}
.lg-divider{display:flex;align-items:center;gap:12px;margin:18px 0}
.lg-divider:before,.lg-divider:after{content:"";flex:1;height:1px;background:#E7DBC8}
.lg-divider span{font-size:12.5px;color:#9c8a72}
.lg-switch{margin-top:18px;text-align:center;font-size:14px;color:#6E5E4C}
.lg-switch button{background:none;border:none;color:#A4583B;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;padding:0}
.lg-switch button:hover{text-decoration:underline}
`}</style>
  );
}
