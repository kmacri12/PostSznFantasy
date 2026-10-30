import { createClient } from "@supabase/supabase-js";
import { parseAuthCallbackError } from "./authRedirect";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
// Modern Supabase Publishable Key (sb_publishable_...), with fallback to legacy anon key
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Read before the client initialises, which consumes the URL fragment.
export const initialCallbackError =
  parseAuthCallbackError(window.location.hash) ?? parseAuthCallbackError(window.location.search);
