# Fix a bad app release

Only when something is broken in the iOS or Android app. Part of the [native apps plan](../mobile/README.md). [Back to the list](README.md)

There are no instant app updates (a plan decision): a fixed app reaches the store in about a day and most phones in 2 to 3 days. So first stop the damage, then ship the fix.

## 1. Stop the damage (minutes)

- **Is it a server problem?** Then it is a normal API fix and deploy; the apps need nothing. Follow the [draft rule](README.md#rules-that-protect-you).
- **Is it one feature?** Turn its kill switch off ([kill switches](bracket-kill-switch.md)): `chat`, `gifs`, `share_cards`, `draft_audio`, `native_team_logos`, `bracket`. It disappears from every app and the website within a minute:
  ```bash
  fly ssh console --app <api app> -C "python -m api.scripts.set_feature_flag chat off"
  ```
- **Is the whole app unusable?** Tell members to use the website (postsznfantasy.com) meanwhile; it is always the latest version. During a draft, that message goes in the league chat.

## 2. Ship the fix (a day)

1. The coordinator fixes it on a branch, merges, and you push a new release tag (`mobile-vX.Y.Z`). CI uploads both builds.
2. **App Store Connect**: submit the new build. If it blocks the game (a draft, lineups before a lock), **request an expedited review** (App Review contact form, "Request an expedited app review") and say why in one sentence.
3. **Play Console**: promote the build to production. Updates are usually reviewed within hours.

## 3. Make sure everyone has it (2 to 3 days)

Once the fixed build is **live in that store**, not before:

```bash
fly secrets set MIN_APP_VERSION_IOS=<the fixed build's build time> --app <api app>
```

(or `MIN_APP_VERSION_ANDROID`). Older apps on that platform then show "Update PostSzn" with a store link. Setting it before the fix is live locks everyone out, so check the store first. Follow the draft rule: `fly secrets set` restarts the API.

## 4. Afterwards

Turn the kill switch back on, and write down what happened for the season's retro.
