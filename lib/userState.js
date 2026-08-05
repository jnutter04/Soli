/* Reads and writes a signed-in user's Soli data (one row per user in the
   `user_state` table). Row-Level Security ensures a user only ever touches
   their own row, so all queries are scoped by the authenticated user id. */

// Extension included so this resolves under plain Node (the tests) as well as
// under the bundler, which is happy either way.
import { mergeField } from "./merge.js";

const COLUMNS =
  "settings, clients, products, logs, plan, demo_seeded, trial_ends_at, subscription_status, updated_at";

/* What this device last saw on the server, per field. It is the starting point
   a merge needs to tell a deletion here apart from an addition there. */
const base = new Map();
let stamp = null; // the row's updated_at as of our last read or write

const key = (userId, field) => `${userId}:${field}`;
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function rememberBase(userId, row) {
  if (!row) return;
  ["settings", "clients", "products", "logs", "plan", "expenses"].forEach((f) => {
    if (f in row) base.set(key(userId, f), clone(row[f]));
  });
  if (row.updated_at) stamp = row.updated_at;
}

export async function loadUserState(supabase, userId) {
  const { data, error } = await supabase
    .from("user_state")
    .select(COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Couldn't load your data: " + error.message);
  rememberBase(userId, data);
  return data; // null when the user has no row yet (first login)
}

export async function createUserState(supabase, userId, initial) {
  // upsert (not insert) so a leftover/partial row from an earlier attempt
  // is reused instead of throwing a duplicate-key error.
  const { data, error } = await supabase
    .from("user_state")
    .upsert({ user_id: userId, ...initial }, { onConflict: "user_id" })
    .select(COLUMNS)
    .single();
  if (error) throw new Error("Couldn't set up your account data: " + error.message);
  rememberBase(userId, data);
  return data;
}

/* Saves one field without clobbering another device.

   The write only lands if the row still carries the timestamp we last saw. If
   someone else wrote in the meantime it matches nothing, and rather than force
   our copy over theirs we fetch what they wrote, merge the two, and try again.
   Returns the value actually stored so the caller can show it. */
/* Saves from this tab run one after another.

   The lock keys on the row's timestamp, and every write moves it. Firing
   several at once (clearing everything rewrites five fields) meant each
   invalidated the next and they fought over a row nobody else was touching.
   Queuing them keeps the timestamp current between our own writes, so the
   conflict path is left for what it is actually for: another device. */
let queue = Promise.resolve();

export function saveField(supabase, userId, field, value) {
  const run = queue.then(() => saveFieldNow(supabase, userId, field, value));
  // Keep the chain alive even if one save rejects, or every later save stalls.
  queue = run.catch(() => {});
  return run;
}

async function saveFieldNow(supabase, userId, field, value, attempt = 0) {
  try {
    return await attemptSave(supabase, userId, field, value, attempt);
  } catch (e) {
    /* Losing the network makes the client throw rather than hand back an error,
       and a rejected promise skips every caller's success path. Reporting it as
       a failed save instead is what lets the screen say so, which is the whole
       point of knowing: offline is the case this has to get right. */
    console.error("Soli save failed:", e?.message || e);
    return { ok: false, value, error: e?.message || "offline" };
  }
}

async function attemptSave(supabase, userId, field, value, attempt = 0) {
  const now = new Date().toISOString();
  const q = supabase.from("user_state").update({ [field]: value, updated_at: now }).eq("user_id", userId);
  const { data, error } = await (stamp ? q.eq("updated_at", stamp) : q).select("updated_at");

  if (error) {
    console.error("Soli save failed:", error.message);
    return { ok: false, value, error: error.message };
  }

  if (data && data.length > 0) {
    stamp = data[0].updated_at || now;
    base.set(key(userId, field), clone(value));
    return { ok: true, value };
  }

  // Nothing updated: the row moved on without us.
  if (attempt >= 2) {
    console.error("Soli save failed: could not settle a conflict after retries");
    return { ok: false, value, error: "conflict" };
  }

  const { data: fresh, error: readErr } = await supabase
    .from("user_state").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (readErr || !fresh) {
    console.error("Soli save failed: could not read the current version");
    return { ok: false, value, error: "conflict" };
  }

  const merged = mergeField(field, base.get(key(userId, field)), value, fresh[field]);
  stamp = fresh.updated_at || null;
  rememberBase(userId, fresh);
  // Retry directly rather than through the queue: this call is what the queue
  // is currently waiting on, so re-entering it would deadlock.
  return saveFieldNow(supabase, userId, field, merged, attempt + 1);
}
