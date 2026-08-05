/* Reconciling two devices that both changed the same list.

   Soli stores each list as one blob and rewrites the whole thing on save, so a
   phone and a laptop with the page open can overwrite each other. Comparing
   only what is here now against what is on the server cannot tell the
   difference between "I deleted this" and "they just added this", and guessing
   either resurrects deleted records or throws away new ones.

   Keeping the copy we originally loaded settles it. With that starting point,
   what each side did is knowable rather than assumed. */

const byId = (arr) => {
  const m = new Map();
  (Array.isArray(arr) ? arr : []).forEach((it) => { if (it && it.id != null) m.set(it.id, it); });
  return m;
};

/* base   what this device loaded from the server
   local  what this device has now
   remote what the server holds now, after the other device wrote */
export function mergeById(base, local, remote) {
  const b = byId(base), l = byId(local), r = byId(remote);
  const out = [];
  const placed = new Set();

  // Walk local first so this device's ordering is preserved.
  for (const item of Array.isArray(local) ? local : []) {
    if (!item || item.id == null) { out.push(item); continue; }
    const id = item.id;
    placed.add(id);

    if (!r.has(id)) {
      // Gone from the server. Either the other device deleted it, or we only
      // just created it. It is ours to keep only if it is new here.
      if (!b.has(id)) out.push(item);
      continue;
    }

    const changedHere = JSON.stringify(item) !== JSON.stringify(b.get(id));
    // Whoever actually edited it wins. If we did not touch it, take theirs.
    out.push(changedHere ? item : r.get(id));
  }

  // Anything the server has that we did not place.
  for (const item of Array.isArray(remote) ? remote : []) {
    if (!item || item.id == null || placed.has(item.id)) continue;
    // Present when we loaded and missing locally means we deleted it, so it
    // stays deleted. Otherwise the other device added it and it should survive.
    if (!b.has(item.id)) out.push(item);
  }

  return out;
}

/* Settings and plan are flat objects with no ids, so they merge key by key on
   the same principle: keys this device changed win, everything else follows the
   server, and a key deleted here stays deleted. */
export function mergeObject(base, local, remote) {
  const b = base && typeof base === "object" ? base : {};
  const l = local && typeof local === "object" ? local : {};
  const r = remote && typeof remote === "object" ? remote : {};
  const out = { ...r };

  for (const k of Object.keys(l)) {
    const changedHere = JSON.stringify(l[k]) !== JSON.stringify(b[k]);
    if (changedHere || !(k in r)) out[k] = l[k];
  }
  for (const k of Object.keys(b)) {
    // Removed here on purpose, and untouched by them, so let it go.
    if (!(k in l) && JSON.stringify(b[k]) === JSON.stringify(r[k])) delete out[k];
  }
  return out;
}

export function mergeField(field, base, local, remote) {
  const listFields = ["logs", "clients", "products", "expenses"];
  if (listFields.includes(field)) return mergeById(base, local, remote);
  if (field === "settings" || field === "plan") return mergeObject(base, local, remote);
  return local; // scalars: this device just made the change, so it stands
}
