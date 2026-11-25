# Rotate the Apple sign-in secret

10 minutes, every 5 months (Apple's limit is 6). Your calendar reminder from [Step 28](28-apple-sign-in.md) brings you here. Part of the [native apps plan](../mobile/README.md). [Back to the list](README.md)

If this lapses, Sign in with Apple stops working on the **website and the Android app** with an `invalid_client` error. The iPhone app keeps working, which is why it is easy to miss.

1. Get the Sign in with Apple `.p8` key, its key id and your Team ID from the password manager.
2. Make a new secret:
   ```bash
   python -m api.scripts.apple_client_secret --team-id <Team ID> --key-id <key id> --client-id com.postsznfantasy.web --key-file <path to .p8>
   ```
3. Supabase, Authentication, Sign In / Providers, **Apple**: paste it into **Secret key**. Leave the Client IDs as they are (`com.postsznfantasy.web` first). Save.
4. Delete the `.p8` copy from disk if you saved one.
5. Set the next reminder 5 months out.

## Verify

Sign out of the website, Sign in with Apple, and land back in the app.
