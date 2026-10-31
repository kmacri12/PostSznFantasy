import { AuthClient } from "@supabase/auth-js";
import { parseAuthCallbackError } from "./authRedirect";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
// Modern Supabase Publishable Key (sb_publishable_...), with fallback to legacy anon key
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Only auth is used, so the client is auth-js alone: supabase-js would also bundle
// realtime, storage and postgrest (~40 kB gzip). Session persistence, token refresh and
// URL-session detection are auth-js defaults, spelled out because the sign-in flows depend on them. The
// storage key is mirrored in e2e/support/env.ts.
export const auth = new AuthClient({
  url: `${supabaseUrl}/auth/v1`,
  headers: { apikey: supabaseKey },
  storageKey: "postszn-auth",
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
});

// Read before the client initialises, which consumes the URL fragment.
export const initialCallbackError =
  parseAuthCallbackError(window.location.hash) ?? parseAuthCallbackError(window.location.search);
