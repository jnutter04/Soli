"use client";

import React from "react";

function report(payload) {
  try {
    const body = JSON.stringify(payload);
    // sendBeacon survives page teardown; fetch is the fallback.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/report-error", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/report-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch { /* reporting must never throw */ }
}

/* Catches render crashes anywhere below it, shows a calm on-brand screen
   instead of a blank page, and reports the crash. */
export default class ErrorReporter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    report({
      source: "boundary",
      message: error?.message || String(error),
      stack: (error?.stack || "") + "\n\nComponent stack:" + (info?.componentStack || ""),
      url: typeof location !== "undefined" ? location.href : "",
    });
  }

  componentDidMount() {
    this.onError = (event) => {
      report({
        source: "window",
        message: event?.message || "Uncaught error",
        stack: event?.error?.stack || `${event?.filename || ""}:${event?.lineno || ""}`,
        url: location.href,
      });
    };
    this.onRejection = (event) => {
      const r = event?.reason;
      report({
        source: "window",
        message: "Unhandled promise rejection: " + (r?.message || String(r)).slice(0, 200),
        stack: r?.stack || "",
        url: location.href,
      });
    };
    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onRejection);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        background: "#F6EFE4", color: "#2B2118", fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth: 420, width: "100%", background: "#FFFDF9", border: "1px solid #E7DBC8",
          borderRadius: 22, padding: "32px 28px", textAlign: "center",
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: "50%", background: "#BC6B4C", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14.5, color: "#6E5E4C", lineHeight: 1.5, margin: "0 0 22px" }}>
            Your data is safe. We have been notified and are looking into it. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15,
              fontWeight: 600, background: "#BC6B4C", color: "#fff", padding: 14, borderRadius: 12,
            }}
          >
            Reload Soli
          </button>
        </div>
      </div>
    );
  }
}
