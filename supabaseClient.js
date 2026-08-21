import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "in a .env.local file (local dev) or in your Vercel project's Environment Variables (production)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Single shared row holds the whole league — simplest possible schema for one league.
// See README.md for the SQL to create this table in Supabase.
const ROW_ID = "main";

export async function loadLeagueData() {
  const { data, error } = await supabase
    .from("league_data")
    .select("value")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function saveLeagueData(value) {
  const { error } = await supabase
    .from("league_data")
    .upsert({ id: ROW_ID, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
