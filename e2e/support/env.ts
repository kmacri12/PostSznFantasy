export const API_PORT = 8100;
export const WEB_PORT = 5273;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

// The replay suite runs its own API (scheduler on) and web build, on separate ports and
// a separate database, because replaying rewrites the shared NFL data as it goes.
export const LIVE_API_PORT = 8101;
export const LIVE_WEB_PORT = 5274;
export const LIVE_WEB_URL = `http://localhost:${LIVE_WEB_PORT}`;
export const LIVE_API_URL = `http://localhost:${LIVE_API_PORT}`;

// The live config sets E2E_API_URL before workers start so shared helpers follow it.
export const API_URL = process.env.E2E_API_URL ?? `http://localhost:${API_PORT}`;

// Nothing listens here: the stub session in localStorage never needs Supabase.
export const SUPABASE_URL = "http://localhost:54321";
// supabase-js keys its stored session by the first label of the project hostname.
export const SESSION_STORAGE_KEY = "sb-localhost-auth-token";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/postszn_e2e";
export const E2E_LIVE_DATABASE_URL = E2E_DATABASE_URL.replace(
  /postszn_e2e(\?|$)/,
  "postszn_e2e_live$1",
);
