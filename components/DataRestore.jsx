"use client";

import { useState } from "react";
import { useDialog } from "@/components/Dialog";
import { readBackup, restorePreview, RESTORE_KEYS } from "@/lib/backup";

const plural = (n, word) => `${n} ${n === 1 ? word : word + "s"}`;

/* Putting a backup back.

   Nothing is written until the numbers are on screen and one of two named
   actions is chosen, because "restore" covers two very different intentions:
   recovering records that went missing, and rolling the whole account back to
   an earlier day. Guessing which one someone meant is not a risk worth taking
   with the only copy of their year. */
export default function DataRestore({ clients, products, logs, expenses, onRestore }) {
  const { ask } = useDialog();
  const [read, setRead] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const current = { clients, products, logs, expenses };
  const currentCounts = { clients: clients.length, products: products.length, services: logs.length, expenses: expenses.length };

  const pick = async (file) => {
    setError(""); setNote(""); setRead(null);
    if (!file) return;
    try {
      const result = readBackup(await file.text());
      if (!result.ok) { setError(result.error); return; }
      setRead(result);
    } catch {
      setError("Could not open that file. Try again, or copy it somewhere else first.");
    }
  };

  const run = async (mode) => {
    const after = restorePreview(read.data, current, mode);
    // "1 expenses" in a dialog about someone's records reads as carelessness.
    const tally = `${plural(after.services, "service")}, ${plural(after.clients, "client")} and ${plural(after.expenses, "expense")}`;
    const ok = await ask(
      mode === "replace"
        ? {
            title: "Replace everything with this backup?",
            body: `Your account becomes exactly what this file holds: ${tally}. Anything logged since the backup was taken is erased, including your settings and goal.`,
            detail: "This cannot be undone. If you might want today's records, close this and take a fresh backup first.",
            confirmLabel: "Replace everything",
            destructive: true,
          }
        : {
            title: "Merge this backup in?",
            body: `Everything here now is kept, and anything missing is added back. You would end up with ${tally}.`,
            detail: "Records you have edited since the backup keep their newer version. Your settings and goal are left as they are.",
            confirmLabel: "Merge it in",
          }
    );
    if (!ok) return;
    onRestore(read.data, mode);
    setRead(null);
    setNote(
      mode === "replace"
        ? `Restored. Your account now holds ${tally}.`
        : `Merged. You now have ${tally}.`
    );
  };

  const taken = read?.exportedAt
    ? new Date(read.exportedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="soli-subblock">
      <div className="soli-subhead">Restore from a backup</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        Lost something, or moving from another device? Choose a backup file and Soli will show you what it holds before anything changes.
      </p>

      <input className="soli-input" type="file" accept=".json,application/json,text/plain"
        aria-label="Choose a backup file to restore"
        onChange={(e) => pick(e.target.files?.[0])} />

      {error && <p className="soli-help" style={{ color: "var(--clay-d)" }}>{error}</p>}
      {note && <p className="soli-help">{note}</p>}

      {read && (
        <>
          <p className="soli-help" style={{ marginBottom: 6 }}>
            {taken ? `Backup taken on ${taken}.` : "Backup file read."} Here is how it compares with what you have now:
          </p>
          <div className="soli-restoregrid">
            <div className="soli-restorehead"><span /><span>Now</span><span>In the backup</span></div>
            {RESTORE_KEYS.map(([key, label]) => (
              <div className="soli-restorerow" key={key}>
                <span>{label[0].toUpperCase() + label.slice(1)}</span>
                <span>{currentCounts[label]}</span>
                <span>{read.counts[label]}</span>
              </div>
            ))}
          </div>
          <div className="soli-refactions" style={{ marginTop: 12 }}>
            <button className="soli-cta sm" onClick={() => run("merge")}>Merge it in</button>
            <button className="soli-ghost" onClick={() => run("replace")}>Replace everything</button>
          </div>
          <p className="soli-help">
            Merging keeps what you have and adds back what is missing, which is what you want after losing a few records. Replacing rolls the whole account back to the day this backup was taken.
          </p>
        </>
      )}
    </div>
  );
}
