# 02: Sign-in: Apple everywhere, native Google, account linking

Phase B. Needs 01, and owner step [28](../../owner/28-apple-sign-in.md) (Apple Services ID, key, Supabase provider). Overlaps 03 in sign-out (`UserContext.tsx`). [Back to the plan](../README.md)

## Goal

Members sign in with Google, an emailed code or Apple, on the web, in the Android app and in the iOS app, and an existing member can add Apple (or Google) to the account they already have instead of creating a second one.

## Why

- Google refuses OAuth inside embedded WebViews (`disallowed_useragent`), so the web's redirect flow (`supabaseAuth.signInWithOAuth` in `contexts/UserContext.tsx`) cannot run inside the app.
- Apple 4.8: once Google is offered, a privacy-focused login must be offered too. Sign in with Apple is the standard answer.
- Apple must work on all three platforms, or a member who signed up on an iPhone cannot reach the same account from a laptop or an Android phone.
- Accounts are never linked automatically (AGENTS.md, #320): the same address through two providers is two accounts. Apple's "Hide My Email" makes that more likely, since the relay address matches nothing.

## Scope

1. **Sign in with Apple, web and Android**: Supabase's Apple OAuth provider (Services ID). The sign-in page gets an Apple button that follows Apple's button guidelines.
2. **Sign in with Apple, iOS**: native sheet through a Capacitor plugin, then `supabaseAuth.signInWithIdToken({ provider: "apple", token, nonce })`. No client secret involved.
3. **Google in the native apps**: native Google Sign-In through a plugin, then `signInWithIdToken({ provider: "google", ... })`. If the plugin landscape is poor when this starts, fall back to the system browser (Capacitor Browser: Custom Tabs / `ASWebAuthenticationSession`) with PKCE and a universal-link return; record which was chosen in the plan's Decisions.
4. **Emailed code**: unchanged, works as is in a WebView. The Supabase email templates already carry the code without a link (docs/owner/09-email-smtp.md); keep it that way, since a link would open the browser, not the app.
5. **Session storage in native**: give `AuthClient` (`utils/supabase.ts`) a `storage` adapter backed by Capacitor Preferences, and use the PKCE flow there. iOS can clear WebView storage under pressure; Preferences survives. `detectSessionInUrl` matters only for redirect flows.
6. **Redirect allowlist**: add the app's return address (universal link or custom scheme, whichever 3. ends up using) to Supabase's URL configuration.
7. **Linking identities**: the account center's sign-in methods (`components/settings/AccountSheet.tsx`, `signInMethods` from `GET /api/account`) gains "Add Apple" and "Add Google" through Supabase's identity linking (`linkIdentity`; check that manual linking is enabled in the project). The sign-in page says "Use the same sign-in you used before."
8. **Account deletion revokes Apple** (Apple requires it for apps offering Sign in with Apple): on iOS, send Apple's `authorizationCode` to the API once at sign-in; the API exchanges it for an Apple refresh token (client secret minted on demand from the `.p8` key, so nothing to rotate server-side), stores it, and `services/account_deletion.py` calls Apple's revoke endpoint. Decide with research what is required for Apple sign-ins made on the web or Android (no authorization code reaches the app there).
9. **Private relay email**: a relay address (`...@privaterelay.appleid.com`) only accepts mail from domains registered with Apple (owner step 28). `dependencies/auth.py` `TokenEmail` stores it like any address; support replies and sign-in codes work once the sending domains are registered.
10. **Secret rotation tool**: `python -m api.scripts.apple_client_secret` prints a fresh client secret (ES256 JWT from the `.p8`, 6-month expiry) for the owner to paste into Supabase. Runbook: [apple-secret-rotation](../../owner/apple-secret-rotation.md).

## Touches

`frontend/src/contexts/UserContext.tsx`, `frontend/src/utils/supabase.ts`, `frontend/src/utils/authRedirect.ts`, `frontend/src/pages/SignInPage.tsx`, `frontend/src/components/settings/AccountSheet.tsx`, new `api/scripts/apple_client_secret.py`, `api/services/account_deletion.py`, a new table or column for Apple refresh tokens (migration, ERD), a new route for the authorization code (authz line), `api/core/config.py` (Apple team id, key id, key, client ids), `.env.example`.

## Done when

- All three methods work on the web, in the Android app and in the iOS app (checked on real devices).
- A member signed in with Google or a code can add Apple from the account center and then sign in with either.
- Deleting an account created with Apple on iOS revokes the Apple token (check in the Apple ID's "Sign in with Apple" list).
- The e2e test-auth stub is untouched and the suite passes.
- Tests: the secret script (key fixture), the authorization-code route (Apple stubbed with `httpx.MockTransport`), deletion calling revoke.

## Re-verify before starting

- Apple 4.8 and 5.1.1(v) wording (login services, account deletion, token revocation).
- Supabase's Apple and Google `signInWithIdToken` docs, identity-linking status, and the Client IDs order rule (Services ID first).
- The current Capacitor plugins for Apple and Google sign-in, their maintenance and Swift Package Manager support.
