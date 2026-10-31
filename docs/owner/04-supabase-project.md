# Step 4: Supabase production project

About 30 minutes. Issue #105. Needs Step 1. [Back to the list](README.md) Screens checked 2026-10-30.

Supabase holds the database and the sign-in accounts.

```bash
cd ~/code/PostSznFantasy
./scripts/wizards/supabase-prod.sh
```

What the script asks, and what to do:

1. **Create the project.** It opens https://supabase.com/dashboard/new.
   - Project name: `postszn-prod`
   - Database password: click **Generate a password**, then **save it in your password manager now**. If it contains any of `@ : / ? # %`, click **Reset database password** later and pick one made only of letters and numbers, so it works inside a connection string.
   - Region: **East US (North Virginia)** (`us-east-1`). This matches the Fly region `iad`.
   - Plan: **Free**. Create it and wait until it finishes.
2. **Region**: type `us-east-1`.
3. **Project ref**: the part of the dashboard address after `/project/`. The script opens **Settings, Infrastructure**: it must say **Postgres 17**. Answer yes.
4. **Publishable key**: it opens **Settings, API Keys**. Copy the key that starts `sb_publishable_` and paste it. **Never** copy a `sb_secret_` or `service_role` key.
5. **Auth URLs** (it opens **Authentication, URL Configuration**):
   - Site URL: `https://postsznfantasy.com`
   - Redirect URLs: add `https://postsznfantasy.com/**`. Add `http://localhost:5173/**` too only if you want local sign-in against production.
   - Save.
6. **Connection strings**: click **Connect** at the top of the project page.
   - Copy the **Session pooler** string: host ends in `pooler.supabase.com`, port **5432**, user `postgres.<ref>`. Replace `[YOUR-PASSWORD]` with your password. Paste it when asked (hidden). The script tests it and stores it as the GitHub secret `PROD_DATABASE_URL`.
   - **Never use the Transaction pooler (port 6543).** The app uses prepared statements, which it does not support.
   - Also copy the **Direct connection** string (host `db.<ref>.supabase.co`, port 5432), put your password in it, and save it in your password manager as **Supabase direct URL**. Step 6 needs it.
   - Save the session pooler string in your password manager as **Supabase session pooler URL**. Steps 11, 13 and 16 need it.
7. **First migration**: answer **y** to run `alembic upgrade head`. It prints the database version.
8. **Size**: it opens the usage page. A few MB is normal. The Free limit is 500 MB.

Good to know: until Step 9 is done, Supabase's built-in email only sends to members of your Supabase organization, at most 2 an hour. So magic links work for you but not for friends until then.

## Verify

- The script finished and printed a version that matches the newest file name in `api/alembic/versions/`.
- The database password, the session pooler string and the direct string are in your password manager.
- `gh secret list --repo kmacri12/PostSznFantasy` shows `PROD_DATABASE_URL`.

## If it goes wrong

- "Could not connect": wrong password, or you pasted the port 6543 string. Run the script again and re-paste.
- Not Postgres 17: stop and tell the coordinator.
