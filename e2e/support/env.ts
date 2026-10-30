export const API_PORT = 8100;
export const WEB_PORT = 5273;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;

// Nothing listens here: the stub session in localStorage never needs Supabase.
export const SUPABASE_URL = "http://localhost:54321";
// supabase-js keys its stored session by the first label of the project hostname.
export const SESSION_STORAGE_KEY = "sb-localhost-auth-token";

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/postszn_e2e";
