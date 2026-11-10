import type { APIRequestContext, BrowserContext } from "@playwright/test";
import { API_URL, SESSION_STORAGE_KEY } from "./env";

/** The bearer token the backend's TEST_AUTH_STUB accepts for this user. */
export const stubToken = (uid: string): string => `e2e-user:${uid}`;

const farFuture = () => Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;

/**
 * Seeds the Supabase client's stored session so the app boots signed in as `uid`,
 * without an emailed code. Written once per tab (sessionStorage flag) so a deliberate
 * sign-out in a test is not undone by the next navigation.
 */
export const signInAs = async (
  context: BrowserContext,
  uid: string,
  displayName = uid,
  { askForName = false }: { askForName?: boolean } = {},
): Promise<void> => {
  const session = {
    access_token: stubToken(uid),
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 10 * 365 * 24 * 3600,
    expires_at: farFuture(),
    user: {
      id: uid,
      aud: "authenticated",
      role: "authenticated",
      email: `${uid}@e2e.test`,
      app_metadata: {},
      user_metadata: { full_name: displayName },
      created_at: "2026-01-01T00:00:00Z",
    },
  };
  await context.addInitScript(
    ({ key, value, skipName }) => {
      if (sessionStorage.getItem("e2e-signed-in")) return;
      localStorage.setItem(key, value);
      if (skipName) localStorage.setItem(`postszn-name-skipped-${JSON.parse(value).user.id}`, "1");
      sessionStorage.setItem("e2e-signed-in", "1");
    },
    { key: SESSION_STORAGE_KEY, value: JSON.stringify(session), skipName: !askForName },
  );
};

export const authHeaders = (uid: string) => ({ Authorization: `Bearer ${stubToken(uid)}` });

export const apiFor = async (request: APIRequestContext, uid: string) => ({
  get: (path: string) => request.get(`${API_URL}${path}`, { headers: authHeaders(uid) }),
});
