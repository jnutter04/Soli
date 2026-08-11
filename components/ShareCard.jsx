"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Draws a 1080x1920 story card entirely in the browser, so nothing about the
   user's income is ever uploaded anywhere. No client names appear on the card;
   the amount itself can be hidden for pros who would rather not post numbers. */

const W = 1080, H = 1920;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sunMark(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = r * 0.42; ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.65, cy + Math.sin(a) * r * 1.65);
    ctx.lineTo(cx + Math.cos(a) * r * 2.25, cy + Math.sin(a) * r * 2.25);
    ctx.stroke();
  }
  ctx.restore();
}

/* Instagram paints its own interface over the top and bottom of a story:
   the profile row and close button up top, the reply bar and share icons
   below. Roughly 250px at each end of a 1080x1920 canvas is not yours.

   The previous layout put the wordmark at y=210 and soli.beauty at y=1710,
   which is to say it put the branding, and the whole reason a shared card is
   worth drawing, underneath Instagram's furniture. Every share so far was
   most likely posted with no visible attribution at all. */
/* Shrinks text until it fits. Someone who keeps $12,480 should not have their
   best month run off the side of the card. */
function fitText(ctx, text, maxWidth, startPx, weight, family) {
  let size = startPx;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 40) {
    size -= 4;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// Letter spacing is not in every canvas implementation, so it is set defensively.
function withTracking(ctx, px, draw) {
  const had = "letterSpacing" in ctx;
  const prev = had ? ctx.letterSpacing : null;
  if (had) ctx.letterSpacing = `${px}px`;
  draw();
  if (had) ctx.letterSpacing = prev;
}

export function drawShareCard(canvas, { eyebrow, hero, clause, period, pill, statLeft, statRight }) {
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  const stack = (varName, fallback) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return v ? `${v}, ${fallback}` : fallback;
    } catch { return fallback; }
  };
  const SERIF = stack("--font-fraunces", "Georgia, serif");
  const SANS = stack("--font-hanken", "system-ui, sans-serif");

  const CREAM = "#F4F0E4", MUTED = "rgba(244,240,228,0.70)";

  /* Full bleed rather than a small white card floating in beige. A story sits
     in a feed of edge to edge photographs, and a receipt on a cream background
     reads as an accident next to them. */
  let g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, "#63764A"); g.addColorStop(1, "#39442A");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Warm light from the top corner, the same glow the app uses.
  g = ctx.createRadialGradient(W * 0.82, H * 0.06, 0, W * 0.82, H * 0.06, W * 1.15);
  g.addColorStop(0, "rgba(201,162,75,0.30)"); g.addColorStop(1, "rgba(201,162,75,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.1, H * 0.92, 0, W * 0.1, H * 0.92, W);
  g.addColorStop(0, "rgba(188,107,76,0.24)"); g.addColorStop(1, "rgba(188,107,76,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const MARGIN = 96, MAXW = W - MARGIN * 2;

  // Brand, inside the safe area this time.
  sunMark(ctx, W / 2 - 96, 372, 26, "#E8C77A");
  ctx.fillStyle = CREAM;
  ctx.font = `600 74px ${SERIF}`;
  ctx.textAlign = "left";
  ctx.fillText("Soli", W / 2 - 38, 376);
  ctx.textAlign = "center";

  // Milestone badge, drawn only when something true was passed in.
  if (pill) {
    ctx.font = `600 34px ${SANS}`;
    const pw = ctx.measureText(pill).width + 76, ph = 76;
    const px = (W - pw) / 2, py = 604;
    ctx.fillStyle = "rgba(232,199,122,0.20)";
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill();
    ctx.strokeStyle = "rgba(232,199,122,0.45)"; ctx.lineWidth = 2;
    roundRect(ctx, px, py, pw, ph, ph / 2); ctx.stroke();
    ctx.fillStyle = "#F0DCA8";
    ctx.fillText(pill, W / 2, py + ph / 2 + 2);
  }

  if (eyebrow) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 32px ${SANS}`;
    withTracking(ctx, 4, () => ctx.fillText(eyebrow.toUpperCase(), W / 2, 790));
  }

  // The number.
  ctx.fillStyle = CREAM;
  const heroSize = fitText(ctx, hero, MAXW, 208, 600, SERIF);
  ctx.font = `600 ${heroSize}px ${SERIF}`;
  ctx.fillText(hero, W / 2, 950);

  /* The clause is the whole point and it used to be a 26px grey footnote.
     Every other pro posts revenue; this posts what survived the costs, and
     that difference is only legible if the difference is stated in a size a
     person reads. */
  if (clause) {
    ctx.fillStyle = CREAM;
    const cs = fitText(ctx, clause, MAXW, 48, 500, SANS);
    ctx.font = `500 ${cs}px ${SANS}`;
    ctx.fillText(clause, W / 2, 1124);
  }

  if (period) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 32px ${SANS}`;
    ctx.fillText(period, W / 2, 1224);
  }

  // Two supporting figures, both describing the person rather than a highlight.
  const sy = 1352;
  ctx.strokeStyle = "rgba(244,240,228,0.18)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(MARGIN + 40, sy - 60); ctx.lineTo(W - MARGIN - 40, sy - 60); ctx.stroke();

  const cols = [[statLeft, W * 0.31], [statRight, W * 0.69]];
  for (const [stat, x] of cols) {
    if (!stat) continue;
    ctx.fillStyle = MUTED;
    ctx.font = `500 30px ${SANS}`;
    ctx.fillText(stat.label, x, sy + 10);
    ctx.fillStyle = CREAM;
    ctx.font = `600 66px ${SERIF}`;
    ctx.fillText(stat.value, x, sy + 88);
  }

  // Attribution, where it can actually be seen.
  ctx.fillStyle = "#F0DCA8";
  ctx.font = `600 46px ${SERIF}`;
  ctx.fillText("soli.beauty", W / 2, 1556);
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText("Know what you actually keep", W / 2, 1620);
}

export default function ShareCard({ open, onClose, amount, period, milestone, statLeft, statRight }) {
  const canvasRef = useRef(null);
  const [showAmount, setShowAmount] = useState(true);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // Resolve the portal target in an effect so it is always a real DOM node,
  // never read during render (which can fire before the body is attached).
  const [portalEl, setPortalEl] = useState(null);
  useEffect(() => { setPortalEl(document.body); }, []);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try { await document.fonts.ready; } catch { /* fall back to system serif */ }
      if (cancelled || !canvasRef.current) return;
      /* The words are decided here and the drawing just lays them out, so a
         claim can never appear because of a layout branch. Notably there is no
         path that prints "best month" unless one was actually passed in. */
      const copy = showAmount
        ? {
            eyebrow: "What I actually kept",
            hero: amount,
            clause: "after product, booth rent and tax",
            pill: milestone ? "Best month yet" : null,
            period,
          }
        : milestone
        ? { eyebrow: null, hero: "Best month yet", clause: "after product, booth rent and tax", pill: null, period }
        : {
            eyebrow: "Services this month",
            hero: statLeft?.value || "0",
            clause: "every one costed for product, booth rent and tax",
            pill: null,
            period,
          };
      drawShareCard(canvasRef.current, { ...copy, statLeft, statRight });
      setPreview(canvasRef.current.toDataURL("image/png"));
    })();
    return () => { cancelled = true; };
  }, [open, showAmount, amount, period, milestone, statLeft, statRight]);

  if (!open || !portalEl) return null;

  const toBlob = () => new Promise((res) => canvasRef.current.toBlob(res, "image/png"));

  const share = async () => {
    setBusy(true); setNote("");
    try {
      const blob = await toBlob();
      const file = new File([blob], "soli-month.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        download();
        setNote("Saved the image. Post it from your photos.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") setNote("Could not open sharing. Try Save image instead.");
    }
    setBusy(false);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = "soli-month.png";
    a.click();
  };

  // Portaled to body: an animated ancestor leaves a transform behind, which
  // would otherwise make this fixed overlay anchor to the page, not the viewport.
  return createPortal(
    <div className="soli-sheet" onClick={onClose}>
      <div className="soli-sheetbox" onClick={(e) => e.stopPropagation()}>
        <div className="soli-sheethead">
          <h2>Share your month</h2>
          <button className="soli-sheetx" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <p className="soli-help" style={{ marginTop: 0 }}>
          Built on your device. No client names are included, and you choose whether the amount shows.
        </p>

        {preview && <img className="soli-sharepreview" src={preview} alt="Preview of your shareable card" />}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <label className="soli-toggle" style={{ margin: "14px 0 16px" }}>
          <input type="checkbox" checked={showAmount} onChange={(e) => setShowAmount(e.target.checked)} />
          <span>Show the amount. Turn this off to post the win without the number.</span>
        </label>

        {note && <p className="soli-help" style={{ marginTop: 0 }}>{note}</p>}

        <button className="soli-cta sm" onClick={share} disabled={busy}>{busy ? "One moment…" : "Share"}</button>
        <button className="soli-ghost" style={{ marginTop: 10 }} onClick={download}>Save image</button>
      </div>
    </div>,
    portalEl
  );
}
