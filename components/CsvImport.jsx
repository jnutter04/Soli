"use client";

import { useMemo, useState } from "react";
import { parseCsv, detectColumns, buildRows, fingerprint } from "@/lib/csvImport";

const FIELDS = [
  ["date", "Date"],
  ["client", "Client"],
  ["service", "Service"],
  ["price", "Price"],
  ["tip", "Tip"],
  ["duration", "Minutes"],
  ["paySource", "Paid by"],
];

const SOURCE_OPTS = [
  ["cash", "Cash"], ["venmo", "Venmo / Zelle"], ["card", "Card"], ["other", "Other"],
];

/* Brings a booking or payments export into Soli.

   Nothing is written until the user has seen every row. Anything the file did
   not make clear is left blank rather than guessed, because an invented
   duration or date quietly distorts months of take-home figures. */
export default function CsvImport({ clients, logs, onImport, onClose, money2 }) {
  const [step, setStep] = useState("paste");
  const [text, setText] = useState("");
  const [table, setTable] = useState(null);
  const [map, setMap] = useState({});
  const [dayFirst, setDayFirst] = useState(false);
  const [rows, setRows] = useState([]);
  const [ambiguous, setAmbiguous] = useState(0);
  const [error, setError] = useState("");

  const readFile = async (file) => {
    if (!file) return;
    try {
      const t = await file.text();
      setText(t);
      analyse(t, dayFirst);
    } catch {
      setError("Could not read that file. Try opening it and pasting the text instead.");
    }
  };

  const analyse = (raw, df) => {
    setError("");
    const t = parseCsv(raw);
    if (t.length < 2) {
      setError("That does not look like a spreadsheet export. It needs a header row and at least one service.");
      return;
    }
    const m = detectColumns(t[0]);
    const built = buildRows(t, m, df);
    if (built.rows.length === 0) {
      setError("No services found. Check that the file has a price or service column.");
      return;
    }
    setTable(t); setMap(m); setRows(built.rows); setAmbiguous(built.ambiguousDates);
    setStep("review");
  };

  const remap = (field, idx) => {
    const m = { ...map, [field]: idx };
    setMap(m);
    const built = buildRows(table, m, dayFirst);
    setRows(built.rows); setAmbiguous(built.ambiguousDates);
  };

  const flipDates = (df) => {
    setDayFirst(df);
    if (table) {
      const built = buildRows(table, map, df);
      setRows(built.rows); setAmbiguous(built.ambiguousDates);
    }
  };

  const upd = (id, key, v) => setRows((rs) => rs.map((r) => r.id === id ? { ...r, [key]: v } : r));

  // Services already in the account, so a second import cannot double the money.
  const existing = useMemo(() => {
    const nameById = {};
    clients.forEach((c) => { nameById[c.id] = c.name; });
    return new Set((logs || []).map((l) => fingerprint(l, nameById[l.clientId])));
  }, [logs, clients]);

  const marked = useMemo(() => rows.map((r) => ({
    ...r,
    duplicate: r.date ? existing.has(fingerprint(r, r.client)) : false,
  })), [rows, existing]);

  const selectable = marked.filter((r) => r.include && !r.duplicate && r.date && r.price !== "");
  const dupes = marked.filter((r) => r.duplicate).length;
  const noDate = marked.filter((r) => r.include && !r.date).length;
  const noDuration = selectable.filter((r) => !r.durationMin).length;

  const confirm = () => {
    onImport(selectable.map((r) => ({
      date: r.date,
      client: String(r.client || "").trim(),
      service: String(r.service || "Service").trim(),
      price: Number(r.price) || 0,
      tip: Number(r.tip) || 0,
      durationMin: Number(r.durationMin) || 0,
      paySource: r.paySource || "card",
    })));
  };

  if (step === "paste") {
    return (
      <div className="soli-subblock">
        <div className="soli-subhead">Bring in past work</div>
        <p className="soli-help" style={{ marginTop: 0 }}>
          Export your appointments or payments from Booksy, Square, Vagaro, Fresha or your bank, then drop the file here. Soli reads the columns and shows you everything before anything is saved.
        </p>

        <input className="soli-input" type="file" accept=".csv,text/csv,text/plain"
          onChange={(e) => readFile(e.target.files?.[0])} />

        <p className="soli-help">Or paste the contents:</p>
        <textarea className="soli-importta" rows={5} value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Date,Client,Service,Price,Duration\n2026-03-04,Maya R.,Volume fill,160,90"} />

        {error && <p className="soli-help" style={{ color: "var(--clay-d)" }}>{error}</p>}

        <div className="soli-refactions">
          <button className="soli-cta sm" onClick={() => analyse(text, dayFirst)} disabled={!text.trim()}>Read the file</button>
          <button className="soli-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="soli-subblock">
      <div className="soli-subhead">Check before importing</div>
      <p className="soli-help" style={{ marginTop: 0 }}>
        {marked.length} rows found. Fix anything that looks wrong, then import. Nothing is saved until you confirm.
      </p>

      <div className="soli-mapgrid">
        {FIELDS.map(([key, label]) => (
          <label className="soli-mapitem" key={key}>
            <span>{label}</span>
            <select className="soli-input slim" value={map[key] ?? -1}
              onChange={(e) => remap(key, Number(e.target.value))}>
              <option value={-1}>Not in file</option>
              {table[0].map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
            </select>
          </label>
        ))}
      </div>

      {ambiguous > 0 && (
        <div className="soli-importwarn">
          <b>Check the date order.</b> {ambiguous} {ambiguous === 1 ? "date is" : "dates are"} written in a way that could mean either order, like 03/04.
          <div className="soli-refactions" style={{ marginTop: 8 }}>
            <button className={"soli-tradebtn" + (!dayFirst ? " on" : "")} onClick={() => flipDates(false)}>Month first (3 April = 04/03)</button>
            <button className={"soli-tradebtn" + (dayFirst ? " on" : "")} onClick={() => flipDates(true)}>Day first (3 April = 03/04)</button>
          </div>
        </div>
      )}

      {(dupes > 0 || noDate > 0 || noDuration > 0) && (
        <div className="soli-importwarn">
          {dupes > 0 && <div>{dupes} already in Soli, so {dupes === 1 ? "it is" : "they are"} skipped.</div>}
          {noDate > 0 && <div>{noDate} have no date Soli could read and cannot be imported.</div>}
          {noDuration > 0 && <div>{noDuration} have no length. They will import, but profit per hour needs minutes to be meaningful.</div>}
        </div>
      )}

      <div className="soli-imptable">
        {marked.map((r) => (
          <div className={"soli-improw" + (r.duplicate ? " dupe" : "") + (!r.date ? " bad" : "")} key={r.id}>
            <input type="checkbox" checked={r.include && !r.duplicate && !!r.date}
              disabled={r.duplicate || !r.date}
              onChange={(e) => upd(r.id, "include", e.target.checked)} />
            <input className="soli-input slim" type="date"
              value={r.date ? String(r.date).slice(0, 10) : ""}
              onChange={(e) => upd(r.id, "date", e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : null)} />
            <input className="soli-input slim" value={r.client} placeholder="No client"
              onChange={(e) => upd(r.id, "client", e.target.value)} />
            <input className="soli-input slim" value={r.service}
              onChange={(e) => upd(r.id, "service", e.target.value)} />
            <input className="soli-input slim" type="number" value={r.price} placeholder="0"
              onChange={(e) => upd(r.id, "price", e.target.value)} />
            <input className="soli-input slim" type="number" value={r.durationMin} placeholder="min"
              onChange={(e) => upd(r.id, "durationMin", e.target.value)} />
            <select className="soli-input slim" value={r.paySource}
              onChange={(e) => upd(r.id, "paySource", e.target.value)}>
              {SOURCE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {r.duplicate && <span className="soli-impnote">already in</span>}
            {!r.date && <span className="soli-impnote">no date</span>}
          </div>
        ))}
      </div>

      <div className="soli-refactions" style={{ marginTop: 12 }}>
        <button className="soli-cta sm" onClick={confirm} disabled={selectable.length === 0}>
          Import {selectable.length} {selectable.length === 1 ? "service" : "services"}
        </button>
        <button className="soli-ghost" onClick={() => setStep("paste")}>Back</button>
      </div>
    </div>
  );
}
