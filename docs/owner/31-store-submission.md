# Step 31: Submit the apps to the stores

About 2 hours across both stores, then review (a day to a week; rejections add rounds). Needs every [workstream](../mobile/README.md#workstreams-and-order), all three [gates](../mobile/README.md#gates), and the API awake (never submit while it is dormant: the reviewer would see the "back next postseason" page). Target: W−8 weeks (W = Wild Card Saturday). Part of the [native apps plan](../mobile/README.md) (not started). [Back to the list](README.md)

Everything you paste is in `docs/mobile/store/` ([workstream 10](../mobile/workstreams/10-store-submission.md)).

## 1. The demo league for reviewers

The Apple or Google employee who reviews the app signs in with **their own** Apple or Google account and joins a league with an invite code you give them.

1. Create a league named `PostSzn Demo` with your own account. Team count 4.
2. Fill three teams with friends' or test accounts, run a quick draft (the mock-draft steps in [Step 15](15-mock-draft.md)), and leave **one team open**.
3. Copy its invite code into the review notes.
4. After each review, reset it: [demo league reset](demo-league-reset.md).

## 2. App Store (App Store Connect)

1. **TestFlight** build from the release tag has passed beta testing.
2. **App Information**: name, subtitle, category Sports, content rights (third-party content: yes, per Step 29), age rating questionnaire.
3. **Pricing and Availability**: free; **United States only**.
4. **App Privacy**: the answers from `privacy-answers.md`; privacy policy URL.
5. **Version page**: screenshots, description, keywords, support and marketing URLs, the build, "Sign-in required": the review notes with the invite code.
6. **Release**: manual (you press Release after approval), so launch day is yours.
7. **Submit for Review.**

## 3. Google Play (Play Console)

1. **App content**: privacy policy URL, ads (none), app access (the review notes), content rating (IARC questionnaire), target audience 13+, Data safety (answers plus the `/delete-account` URL), government/financial/health: no.
2. **Store listing**: descriptions, icon, feature graphic, screenshots.
3. **Countries**: United States only.
4. **Production release**: promote the tested build from internal testing; managed publishing on, so you choose the moment it goes live.
5. **Send for review.**

## Verify

- Both stores show the app as approved and, after you release, live in the US.
- From a phone without the app: the store listing installs it, sign-in works, the demo league is back to one open team.

## If it goes wrong

- **Rejected under 4.2 (minimum functionality)**: reply in App Store Connect pointing at native push, Sign in with Apple, haptics and share in the draft room, and universal links; the coordinator helps word it. Resubmit.
- **Rejected for sign-in or the demo league**: check the invite code still works and the league still has an open team.
- **Not approved by W−2**: invite every league member to TestFlight and the internal testing track instead, and keep the submission going. Members use the beta for the season.
