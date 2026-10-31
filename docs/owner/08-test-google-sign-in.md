# Step 8: test Google sign-in on the live site

5 minutes. Issue #91. Needs Steps 5 and 7. [Back to the list](README.md)

1. Use a Google account that is **not** the owner of the Google Cloud project: a friend's, or a second account of yours.
2. On a phone, open https://postsznfantasy.com, tap **Sign in**, then **Continue with Google**.
3. Pick the account. You land back on the app, signed in.
4. Sign out. Repeat once in a private (incognito) window.

## Verify

- Signed in both times, with no "This app isn't verified" screen and no `redirect_uri_mismatch` error.
- Google's screen names `postsznfantasy.com` or `<ref>.supabase.co`. Seeing the Supabase address is expected until the brand is verified (see [Step 5](05-google-sign-in.md)).

Close #91 once both are true and Google's brand verification is done or not needed.

## If it goes wrong

- `redirect_uri_mismatch`: the redirect URI in the Google client must be exactly `https://<ref>.supabase.co/auth/v1/callback`.
- "This app isn't verified": the app is still in **Testing**. Google Auth Platform, **Audience**, **Publish app**.
- You land on the site but are not signed in: Supabase, **Authentication**, **URL Configuration** is missing `https://postsznfantasy.com/**`.
