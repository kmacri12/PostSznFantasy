# 11: Release operations

Two halves. **Phase B**: version-skew rules, metrics and the hotfix runbook (needs 01; the release workflow itself is built in 08 and 09). **Phase E**: after public launch, point the web's install prompts at the stores. [Back to the plan](../README.md)

## Goal

Old app versions in people's pockets never break, the owner can see who runs what, a bad build can be stopped or superseded fast, and once the apps are public the web sends phone users to them.

## How fast a fix reaches phones

Without over-the-air updates (a plan decision):

| Step | iOS | Android |
| :--- | :--- | :--- |
| Build and upload from CI | 30 to 60 min | 15 to 30 min |
| Store review | Often within a day; an expedited review can be requested for a critical bug | Hours to a day or two |
| In the store | Next day is realistic | Next day is realistic |
| On most phones | 1 to 2 days of automatic updates; some members have them off | Similar |

So: in the store the next day, on most phones in 2 to 3 days. The 426 minimum version (below) forces the rest. Kill switches (06) and the web app cover the hours in between.

## Scope

**Phase B**

1. **Per-platform minimum version**: `api/core/app_version.py` today compares `X-App-Version` (build time) with one `MIN_APP_VERSION`. Add `MIN_APP_VERSION_IOS` and `MIN_APP_VERSION_ANDROID`, chosen by `X-App-Platform` (01), so forcing an iOS update never locks out Android or the web. Same 426 `app_outdated` answer; native shows the store link (06).
2. **Version metrics**: a view in the metrics set (migration like 0024's `metrics_*` views, aggregates only) or a daily log aggregate: active users per platform and app version over the last 7 days. Read it in Metabase ([docs/owner/23-monitoring.md](../../owner/23-monitoring.md)).
3. **Deprecation rule** in AGENTS.md and CONTRIBUTING.md, next to "never remove an endpoint in the PR that stops using it": a field or endpoint the native apps use is removed only after at least 30 days and once the metrics show the versions that used it are below a few percent; never during the postseason.
4. **Release process** in CONTRIBUTING.md: native releases are tags (`mobile-vX.Y.Z`) pushed by the owner; web deploys continue on every push to `main`. A native release is cut when native code or a native-relevant web change lands, not for every web change, since the bundled web code is otherwise only refreshed by a release. Freeze at W−1.
5. **Hotfix runbook**: [docs/owner/mobile-hotfix.md](../../owner/mobile-hotfix.md) (written in this PR set; keep it true).

**Phase E (after public approval)**

6. **Install prompts point to the stores** on phones: `utils/install.ts` `installKind`, `components/install/InstallGuideSheet.tsx`, `InstallOffer.tsx` and the More row show App Store / Google Play badges on iOS and Android browsers; desktop keeps the Home Screen web app.
7. **Smart App Banner**: `<meta name="apple-itunes-app" content="app-id=...">` in `index.html` (check `index.test.ts` and the CSP hash test).
8. **"The app is here"**: a one-time notice for members using the Home Screen web app (`isStandalone()`) on a phone, with the store link and a note that their account and leagues carry over; remembered per device like the other once-only notices.
9. Docs: README quickstart, the owner list, AGENTS.md entries.

## Touches

`api/core/app_version.py`, `api/core/config.py`, `.env.example`, a metrics migration and its Postgres test, `docs/owner/23-monitoring.md`, AGENTS.md, CONTRIBUTING.md; Phase E: `frontend/src/utils/install.ts`, `components/install/*`, `pages/MorePage.tsx`, `index.html`.

## Done when

- Phase B: setting `MIN_APP_VERSION_IOS` refuses only old iOS builds; the metrics view shows platform and version counts; the deprecation rule and release process are in the contributor docs.
- Phase E: a phone browser offers the store, not the Home Screen; the Smart App Banner shows in iPhone Safari; standalone web-app users see the notice once.
