# 05: Privacy Policy, Terms, delete-account page

Phase B. Needs 04 (the community rules it describes) and the LLC's name (owner step [25](../../owner/25-llc.md); use a placeholder until then). Ends at a gate: owner step [30](../../owner/30-legal-review.md), the lawyer review. [Back to the plan](../README.md)

## Goal

Privacy and Terms pages that are accurate for the web app and both native apps, name the LLC as the operator, and pass a lawyer's review; plus a public page where anyone can ask for their account to be deleted without the app.

## Why

Both stores require a privacy policy that matches what the app collects, and Google requires a deletion link that works without the app. The current pages (`pages/PrivacyPage.tsx`, `pages/TermsPage.tsx`) were written for a personal web project: they say "the site", mention the browser's push address, have no operator, no community rules and no country scope. An LLC protects the owner only if what it publishes is sound.

## Scope

Keep the existing plain-language style and `components/common/LegalDocument.tsx`. Write as a draft for the lawyer, not as final law.

**Privacy Policy**

1. Operator: the LLC, its contact email; mailing address if the lawyer advises.
2. Where it is offered: the United States; the apps are listed only in the US stores.
3. What is collected and why: email, name, display name, Google/Apple sign-in identifiers (Apple's private relay address), leagues, teams, picks, chat, reactions, mentions, pictures, problem reports and feedback, push tokens (web push address, or the Firebase/APNs token in the apps) and device labels, time zone and clock preference, crash reports.
4. Who processes it: Supabase (sign-in, database, picture storage), Fly.io (API), Cloudflare (website, analytics without cookies), Sentry (errors), Resend (email), GIPHY (GIF search, only when opened), Google Firebase and Apple (notification delivery in the apps), Google and Apple (sign-in), ESPN's image servers (team logos load from them where shown), RapidAPI/Tank01 (no personal data sent). Buy Me a Coffee only on the web.
5. Retention and deletion: what deletion removes and what stays under "Former member" (`services/account_deletion.py`); notifications kept 30 days; push devices pruned after 60 days; the data export.
6. Children: not for under-13s; what happens if one signs up (COPPA).
7. Changes: how members are told.

**Terms**

8. The LLC as the party; US only; who may use it (13+).
9. Keep "Free game, no money" and "Not affiliated with the NFL".
10. Community rules: zero tolerance for objectionable content and abusive members; reporting and blocking; action within 24 hours; removal of content and accounts.
11. Licence to display what members post, so chat and pictures can be shown to their league.
12. App store terms: either adopt Apple's standard end-user licence or include the minimum terms Apple requires of a custom one; the lawyer picks.
13. Disclaimers, liability, governing law: placeholders the lawyer fills in.

**Delete-account page**

14. `/delete-account`, public, no sign-in, linked from the Privacy Policy and the store listings: names the app and the LLC, explains the in-app path (profile, Danger zone, Delete my account), what is deleted and kept, and offers an email request to support for anyone who cannot sign in. Exempt from dormant mode like `/privacy` and `/terms`.

## Touches

`frontend/src/pages/PrivacyPage.tsx`, `frontend/src/pages/TermsPage.tsx`, a new `DeleteAccountPage.tsx`, `frontend/src/App.tsx` routes, `utils/pageTitle.ts`, the dormant-route allowlist, `LegalPages.test.tsx`, `docs/owner/account-deletion.md` (link the page).

## Done when

- Every data flow in the app is in the Privacy Policy (cross-check against the AGENTS.md route map and `.env.example` services).
- `/delete-account` loads signed out and in dormant mode.
- The owner has sent the drafts to the lawyer (step 30); the lawyer's changes are applied in a follow-up PR and the pages carry the new date.

## Re-verify before starting

- Apple's and Google's privacy-policy and account-deletion requirements.
- The current processor list (new services may have been added since `c1f1083`).
