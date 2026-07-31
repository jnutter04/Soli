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

export function drawShareCard(canvas, { amount, label, period, showAmount, statLeft, statRight }) {
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  // Warm oat background with the brand's soft glows.
  ctx.fillStyle = "#F6EFE4"; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W * 1.1);
  g.addColorStop(0, "rgba(201,162,75,0.28)"); g.addColorStop(1, "rgba(246,239,228,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.9, H * 0.15, 0, W * 0.9, H * 0.15, W);
  g.addColorStop(0, "rgba(188,107,76,0.20)"); g.addColorStop(1, "rgba(246,239,228,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Brand lockup
  sunMark(ctx, 150, 210, 26, "#BC6B4C");
  ctx.fillStyle = "#2B2118";
  ctx.font = "600 76px Fraunces, Georgia, serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("Soli", 218, 214);

  // Main card
  const cx = 90, cy = 470, cw = W - 180, ch = 880;
  ctx.save();
  ctx.shadowColor = "rgba(43,33,24,0.16)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#FFFDF9"; roundRect(ctx, cx, cy, cw, ch, 56); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#E7DBC8"; ctx.lineWidth = 2;
  roundRect(ctx, cx, cy, cw, ch, 56); ctx.stroke();

  // Green take-home block
  const bx = cx + 56, by = cy + 64, bw = cw - 112, bh = 420;
  const bg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  bg.addColorStop(0, "#5E7142"); bg.addColorStop(1, "#475431");
  ctx.fillStyle = bg; roundRect(ctx, bx, by, bw, bh, 40); ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#D6DBC2";
  ctx.font = "500 34px 'Hanken Grotesk', system-ui, sans-serif";
  ctx.fillText(label, W / 2, by + 78);

  ctx.fillStyle = "#F4F0E4";
  if (showAmount) {
    ctx.font = "600 148px Fraunces, Georgia, serif";
    ctx.fillText(amount, W / 2, by + 210);
  } else {
    ctx.font = "600 104px Fraunces, Georgia, serif";
    ctx.fillText("My best month yet", W / 2, by + 190, bw - 60);
  }

  ctx.fillStyle = "rgba(244,240,228,0.78)";
  ctx.font = "400 30px 'Hanken Grotesk', system-ui, sans-serif";
  ctx.fillText(period, W / 2, by + 330);

  // Two supporting stats
  const sy = by + bh + 110;
  ctx.fillStyle = "#6E5E4C";
  ctx.font = "500 30px 'Hanken Grotesk', system-ui, sans-serif";
  ctx.fillText(statLeft.label, cx + cw * 0.28, sy);
  ctx.fillText(statRight.label, cx + cw * 0.72, sy);
  ctx.fillStyle = "#2B2118";
  ctx.font = "600 62px Fraunces, Georgia, serif";
  ctx.fillText(statLeft.value, cx + cw * 0.28, sy + 78);
  ctx.fillText(statRight.value, cx + cw * 0.72, sy + 78);

  // Honest framing so the number is not mistaken for revenue
  ctx.fillStyle = "#9c8a72";
  ctx.font = "400 26px 'Hanken Grotesk', system-ui, sans-serif";
  ctx.fillText("after product, booth rent & taxes", W / 2, cy + ch - 54);

  // Footer
  ctx.fillStyle = "#A4583B";
  ctx.font = "600 46px Fraunces, Georgia, serif";
  ctx.fillText("soli.beauty", W / 2, H - 210);
  ctx.fillStyle = "#6E5E4C";
  ctx.font = "400 30px 'Hanken Grotesk', system-ui, sans-serif";
  ctx.fillText("Know what you actually keep", W / 2, H - 150);
}

export default function ShareCard({ open, onClose, amount, period, statLeft, statRight }) {
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
      drawShareCard(canvasRef.current, {
        amount, period, showAmount, statLeft, statRight,
        label: showAmount ? "What I actually kept" : "",
      });
      setPreview(canvasRef.current.toDataURL("image/png"));
    })();
    return () => { cancelled = true; };
  }, [open, showAmount, amount, period, statLeft, statRight]);

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
