# Delete a member's account

About 2 minutes, only when someone cannot use the app to do it themselves. Issue #330. Needs Step 6 and `SUPABASE_SERVICE_ROLE_KEY` (Step 20). [Back to the list](README.md)

Members delete their own account in the app: tap the profile picture, then **Delete my account**. The Privacy Policy promises the same, and promises an answer to `support@postsznfantasy.com` within 30 days.

## What deletion does

- Deletes the Supabase Auth user (the sign-in), the member's push subscriptions and profile picture.
- Keeps the `fantasy.users` row as **Former member** with no email, so finished seasons, drafts and chat still read correctly. `author_name` on their chat messages and `actor_name` on feed events are overwritten with the same name.
- Marks every league membership as left and frees their teams in seasons still under way (the roster stays; a commissioner can reassign it). Teams in finished seasons keep their history under Former member.
- Refuses (409) while the member is the only commissioner of a league that still has other members. They hand over first in the league's member list.
- Does nothing, and says so, if Supabase cannot delete the Auth user (the account is left as it was).

Not touched: team and league names, picks, and anything a member typed into league notes. Encrypted backups keep the old data until they are replaced; no password hashes are ever in them.

## Steps (manual fallback)

1. Find the user id (`select id, username, email from fantasy.users where email = '<address>'`).
2. ```bash
   fly ssh console --app postszn-api -C "python -m api.scripts.delete_user <id>"
   ```
3. Reply to the person that it is done.

## Verify

1. The log says `User <id> deleted`. The same user id again prints nothing harmful: the row is already Former member and the Auth user is gone.
2. A sign-in with the same email now creates a brand-new account.

If it prints `Hand over commissioner ... first`, ask the person to make another member a commissioner, or do it yourself in the league's member list, then run it again.
