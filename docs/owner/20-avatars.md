# Step 20: Turn on profile, team and league pictures

10 minutes. Issue #316. Needs Step 4 (Supabase project) and Step 6 (the API on Fly). [Back to the list](README.md)

Members can set a profile picture, team owners a team picture and commissioners a league picture (Settings). The API stores the cropped images in a **private** Supabase Storage bucket and serves them itself. Without the two steps below the app still works: every picture slot shows initials (the bracket tile for a league), and saving a picture says pictures are not set up yet. Free plan limit: Supabase Storage includes 1 GB; each picture is about 50 KB.

## 1. Create the private bucket

1. Supabase dashboard, project `postszn-prod`, **Storage**, **New bucket**.
2. Name `avatars`. Leave **Public bucket** **off**. Under restrictions (optional but good) set **Restrict file size** to `1 MB` and **Allowed MIME types** to `image/jpeg, image/png, image/webp`. **Create bucket**.
3. Do not add any storage policies. Only the API reads and writes it, with the service key below, which bypasses policies.

## 2. Give the API the service key

1. Supabase, **Project Settings**, **API Keys**. Copy the **secret** key (`sb_secret_...`; on an older project it is the `service_role` key). It can read everything in the project: keep it in your password manager, never paste it in a chat, a file in the project or a `VITE_` variable.
2. Not during a live draft (changing a secret restarts the API):
   ```bash
   cd ~/code/PostSznFantasy
   DATABASE_URL='<session pooler string>' scripts/check-live-drafts.sh
   ```
   ```bash
   fly secrets set SUPABASE_SERVICE_ROLE_KEY='<the secret key>' --app postszn-api
   ```
   The bucket name defaults to `avatars`; set `AVATAR_BUCKET` only if you named it differently.

## Verify

1. On https://postsznfantasy.com sign in, open a league, **More**, **Settings**, **Profile picture**.
2. Choose a photo, drag and zoom inside the circle, **Save picture**. Your picture replaces the initials in the top-right account button.
3. Supabase, **Storage**, `avatars`: one file with a random name appeared (a small WebP: the API re-saves every upload at 512 px or less and drops camera and location tags). **Remove picture** in the app deletes it.
4. Open the file's address from a signed-out window (`https://<api host>/api/avatars/<that name>`): it loads (the random name is the key). Opening the Supabase Storage URL for the same file does **not** (the bucket is private).

## If it goes wrong

- Saving says "Pictures are not set up yet": the secret is missing; `fly secrets list --app postszn-api` must list `SUPABASE_SERVICE_ROLE_KEY`.
- "We couldn't save that picture": `fly logs --app postszn-api` shows `Avatar not stored` with an error type. A 4xx usually means a wrong key or a bucket name that does not match `AVATAR_BUCKET`. Paste the line (not the key) to the coordinator.
- A picture shows initials after saving: the API could not read it back (`Avatar not read` in the logs), or the bucket is public/missing.

Leftovers from a failed delete are swept by the API's roster sync (about daily, needs `SCHEDULER_ENABLED`); run `fly ssh console --app postszn-api -C "python -m api.scripts.prune_avatars"` to sweep by hand. Files younger than a day are never swept.
