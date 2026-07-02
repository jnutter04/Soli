/* Reads and writes a signed-in user's Soli data (one row per user in the
   `user_state` table). Row-Level Security ensures a user only ever touches
   their own row, so all queries are scoped by the authenticated user id. */

const COLUMNS =
  "settings, clients, products, logs, plan, demo_seeded, trial_ends_at, subscription_status";

export async function loadUserState(supabase, userId) {
  const { data, error } = await supabase
    .from("user_state")
    .select(COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Couldn't load your data: " + error.message);
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
  return data;
}

export async function saveField(supabase, userId, field, value) {
  const { error } = await supabase
    .from("user_state")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.error("Soli save failed:", error.message);
}
