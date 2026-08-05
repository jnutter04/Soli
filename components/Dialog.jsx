"use client";

/* In-app replacements for alert() and confirm().

   The native ones are the wrong tool here for three reasons. They render in the
   browser's own chrome, which in Instagram's in-app browser looks exactly like
   the scam popups people are trained to dismiss, and two of Soli's fired on a
   failed payment. They cannot say anything in Soli's voice or show a number in
   context. And they freeze the page, so a "confirm" that arrives mid-save
   blocks the save from finishing.

   These are promise-based, so a caller reads much like the original:

     if (!(await ask({ title: "Remove Maya R.?" }))) return;

   The trade is that callers have to be async. That is the whole migration. */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DialogContext = createContext(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  // A missing provider would otherwise fail later, at the click, with nothing
  // on screen and no error anyone would connect to the cause.
  if (!ctx) throw new Error("useDialog needs a <DialogProvider> above it");
  return ctx;
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [portalEl, setPortalEl] = useState(null);
  useEffect(() => { setPortalEl(document.body); }, []);

  /* Held outside state so closing never runs a side effect inside a state
     updater, which React is free to call more than once. */
  const resolveRef = useRef(null);

  const open = useCallback((opts, extra) => new Promise((resolve) => {
    /* A dialog opening on top of another would strand whoever is awaiting the
       first one, so it is answered no before being replaced. */
    resolveRef.current?.(false);
    resolveRef.current = resolve;
    const o = typeof opts === "string" ? { title: opts } : opts || {};
    setDialog({ ...extra, ...o });
  }), []);

  /* A question. Resolves true if they go ahead, false for cancel, escape, or a
     click outside. Anything other than an explicit yes reads as no. */
  const ask = useCallback((opts) =>
    open(opts, { kind: "ask", confirmLabel: "Confirm", cancelLabel: "Cancel" }), [open]);

  /* Something they only need to read. Resolves when dismissed. */
  const tell = useCallback((opts) =>
    open(opts, { kind: "tell", confirmLabel: "OK" }), [open]);

  const close = useCallback((result) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setDialog(null);
    resolve?.(result);
  }, []);

  return (
    <DialogContext.Provider value={{ ask, tell }}>
      {children}
      {portalEl && dialog && createPortal(
        <DialogBox dialog={dialog} onClose={close} />,
        portalEl
      )}
    </DialogContext.Provider>
  );
}

function DialogBox({ dialog, onClose }) {
  const { kind, title, body, detail, confirmLabel, cancelLabel, destructive } = dialog;
  const boxRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;

    /* Land on the safe button. For something destructive that is Cancel, so a
       stray Enter from the keypress that opened this cannot delete anything. */
    const target = destructive && cancelRef.current ? cancelRef.current : confirmRef.current;
    target?.focus();

    // The page behind must not scroll under the dialog on a phone.
    const scrollLocked = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(false); return; }
      if (e.key !== "Tab") return;

      // Keep focus inside, or Tab walks off into the page behind the overlay.
      const focusable = boxRef.current?.querySelectorAll("button, [href], input, select, textarea");
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scrollLocked;
      // Put focus back where it was, so the keyboard does not start over.
      if (previous && previous.focus) previous.focus();
    };
  }, [destructive, onClose]);

  return (
    <div className="soli-sheet" onClick={() => onClose(false)}>
      <div
        className="soli-sheetbox soli-dialog"
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="soli-dialog-title"
        aria-describedby={body ? "soli-dialog-body" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="soli-dialog-title">{title}</h2>
        {body && <p id="soli-dialog-body" className="soli-dialog-body">{body}</p>}
        {detail && <p className="soli-dialog-detail">{detail}</p>}

        <div className="soli-dialog-actions">
          {kind === "ask" && (
            <button className="soli-ghost" ref={cancelRef} onClick={() => onClose(false)}>
              {cancelLabel}
            </button>
          )}
          <button
            className={"soli-cta sm" + (destructive ? " danger" : "")}
            ref={confirmRef}
            onClick={() => onClose(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
