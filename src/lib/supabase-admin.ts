import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  // Do not throw during build; API routes will return a configuration error when used.
}
export function supabaseAdmin() {
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
export const BUCKET = process.env.SUPABASE_BUCKET || "cloudbox";
