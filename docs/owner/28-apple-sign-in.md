# Step 28: Sign in with Apple

About 45 minutes. Needs [Step 26](26-store-accounts.md). Part of the [native apps plan](../mobile/README.md) (not started). [Back to the list](README.md)

Apple requires an Apple sign-in once Google sign-in is offered in an iPhone app. It is offered on the website and the Android app too, so a member who signs up on an iPhone can sign in anywhere.

1. **Apple Developer, Identifiers**: the App ID `com.postsznfantasy.app` already has Sign in with Apple on (Step 26).
2. **Services ID** (for the website and Android): Identifiers, new, **Services IDs**, identifier `com.postsznfantasy.web`, description "PostSzn Fantasy". Turn on Sign in with Apple, Configure: primary App ID `com.postsznfantasy.app`, domain `<your Supabase ref>.supabase.co`, return URL `https://<your Supabase ref>.supabase.co/auth/v1/callback` (copy it from Supabase's Apple provider page).
3. **Key**: Keys, new, **Sign in with Apple** on, primary App ID `com.postsznfantasy.app`. Download the `.p8` (once). Note the key id. Password manager.
4. **Client secret**: run the coordinator's script (built in [workstream 02](../mobile/workstreams/02-sign-in.md)):
   ```bash
   python -m api.scripts.apple_client_secret --team-id <Team ID> --key-id <key id> --client-id com.postsznfantasy.web --key-file ~/Downloads/AuthKey_<key id>.p8
   ```
   It prints a long token that lasts 6 months.
5. **Supabase, Authentication, Sign In / Providers, Apple**: on. **Client IDs**: `com.postsznfantasy.web,com.postsznfantasy.app` (the Services ID **first**, or the website's Apple sign-in fails). **Secret key**: the token from 4. Save.
6. **Calendar reminder** 5 months from today: "Rotate the Apple sign-in secret" with a link to the [rotation runbook](apple-secret-rotation.md). If it lapses, Apple sign-in breaks on the website and Android (the iPhone app keeps working).
7. **Email relay**: members who choose "Hide My Email" get a relay address that only accepts mail from domains you register. Apple Developer, Services, **Sign in with Apple for Email Communication**: add `postsznfantasy.com` and the sending address Supabase's sign-in codes use ([Step 9](09-email-smtp.md)) and the support address. Their SPF/DKIM must pass (Resend sets them up).
8. The API also needs the key for token revocation on account deletion (workstream 02): `fly secrets set` with the names the coordinator gives, after the [draft rule](README.md#rules-that-protect-you) check.

## Verify

- After workstream 02 ships: Sign in with Apple works on the website, in the Android app and in the iPhone app, and a "Hide My Email" account receives a sign-in code email.
