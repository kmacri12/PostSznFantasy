# Step 5: production Google sign-in

About 30 minutes, then Google may take a few days. Issue #91. Needs Steps 3 and 4. [Back to the list](README.md)

The **Sign in with Google** button needs a Google Cloud project that vouches for our site. Google renamed the old "OAuth consent screen" to **Google Auth Platform**, with the pages **Branding**, **Audience**, **Data Access** and **Clients**.

```bash
cd ~/code/PostSznFantasy
./scripts/wizards/production-google-oauth.sh
```

It first asks for: the domain `postsznfantasy.com` (no `https://`), your Supabase project ref (Step 4), and a support email you read.

1. **Create the project** (it opens the project page). Name `PostSzn Fantasy Prod`. Use the Google account that should own this long term. Make sure the new project is selected at the top of the console.
2. **Branding** (Google Auth Platform; if it says **Get started**, that is the same form):
   - App name `PostSzn Fantasy`, user support email: yours.
   - Audience: **External**. Contact info: your email. Accept the policy, **Create**.
   - **Do not upload a logo.** A logo needs Google's review before it shows.
   - App home page `https://postsznfantasy.com`
   - Privacy policy `https://postsznfantasy.com/privacy`
   - Terms of service `https://postsznfantasy.com/terms`
   - Authorized domains: `postsznfantasy.com`. **Save**.
3. **Scopes** (Google Auth Platform, **Data Access**, **Add or remove scopes**): select only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These basic scopes need no Google review. **Update**, then **Save**.
4. **Publish** (Google Auth Platform, **Audience**): click **Publish app** and confirm. The status must say **In production**.
5. **Clients**: **Create client**, type **Web application**, name `PostSzn Prod Web`.
   - Authorized JavaScript origins: `https://postsznfantasy.com`
   - Authorized redirect URIs: `https://<your Supabase ref>.supabase.co/auth/v1/callback` (Supabase shows this exact address on its Google provider page; copy it from there)
   - **Create**. Keep the window with the **Client ID** and **Client secret** open.
6. **Supabase**: project `postszn-prod`, **Authentication**, **Sign In / Providers**, **Google**. Turn it on, paste the Client ID and the Client secret, **Save**. This is the only place the secret goes.
7. **Supabase URLs**: **Authentication**, **URL Configuration**. Confirm Site URL `https://postsznfantasy.com` and Redirect URL `https://postsznfantasy.com/**` (set in Step 4).
8. The script then offers a sign-in test. Answer **later**: it only works once the site is live (Step 8).

**What users will see.** Until Google verifies the brand, the Google screen shows the Supabase address (`<ref>.supabase.co`) instead of "PostSzn Fantasy". To show the name, open **Verification Center** and submit the brand for verification (free; it can ask you to prove you own the domain with a TXT record in Cloudflare DNS, and takes a few days). Watch the support inbox for Google's emails.

## Verify

- **Audience** says **In production**.
- Supabase, **Sign In / Providers**, **Google** is enabled.
- The real test is [Step 8](08-test-google-sign-in.md), after the site is live.

## If it goes wrong

- `redirect_uri_mismatch` later: the redirect URI must be exactly `https://<ref>.supabase.co/auth/v1/callback`, no trailing slash, right ref.
- Google asks for anything in Verification Center: paste the exact message to the coordinator.
