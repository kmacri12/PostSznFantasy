const DEFAULT_NEXT = "/";
const SIGN_IN_PATH = "/sign-in";

/** Only same-origin paths may be a post-login destination, so a crafted link cannot bounce users off-site. */
export const safeNextPath = (raw: string | null | undefined): string => {
  if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_NEXT;
  }
  if (raw === SIGN_IN_PATH || raw.startsWith(`${SIGN_IN_PATH}?`)) return DEFAULT_NEXT;
  return raw;
};

export const signInPath = (next: string): string =>
  next === DEFAULT_NEXT ? SIGN_IN_PATH : `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;

/** The destination rides in the URL rather than storage so it survives the OAuth round trip. */
export const authCallbackUrl = (origin: string, next: string): string =>
  `${origin}${signInPath(next)}`;

export interface AuthCallbackError {
  code: string;
  message: string;
}

/** Supabase reports a failed OAuth callback as error params in the hash (implicit flow) or query (PKCE). */
export const parseAuthCallbackError = (locationPart: string): AuthCallbackError | null => {
  const params = new URLSearchParams(locationPart.replace(/^[#?]/, ""));
  const error = params.get("error_code") ?? params.get("error");
  if (!error) return null;
  return {
    code: params.get("error_code") ?? error,
    message: params.get("error_description") ?? "Sign-in failed.",
  };
};
