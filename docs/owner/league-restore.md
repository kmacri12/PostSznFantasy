# Restore a deleted league

About 2 minutes, only when a commissioner asks. Issue #231. Needs Step 6. [Back to the list](README.md)

A commissioner can delete a league for good from the app; there is no undo button and none is shown to users. Nothing is removed from the database, so you can bring it back for support or a real accident. Never mention this in the app.

## Steps

1. Find the league id (the number in the league's page address, `/leagues/<id>`), or ask the commissioner for the league name and look it up:
   ```bash
   fly ssh console --app postszn-api -C "python -m api.scripts.restore_league <id>"
   ```
2. The league comes back with all its seasons, members and teams. Its invite stays revoked: ask a commissioner to create a new one.

## Verify

1. The output has `League <id> restored`. A league that is not deleted or does not exist prints `does not exist or is not deleted` and changes nothing.
2. The commissioner sees the league in their list again.

A restored backup keeps deleted leagues deleted (they are rows with `deleted_at` set), so restoring from a dump never needs this step unless the owner wants the league back.
