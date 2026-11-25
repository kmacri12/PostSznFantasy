# Step 29: Rights check (NFL data and team logos)

An hour of reading and an email, then waiting for a reply. Gate: no public store submission until this is answered. Part of the [native apps plan](../mobile/README.md) (not started). [Back to the list](README.md)

A store listing is a commercial product from your company, and reviewers check intellectual property (Apple guideline 5.2). Two things are unverified:

1. **Tank01 data.** The stats come from the Tank01 NFL API on RapidAPI. Its terms of use could not be found when this was planned.
   - Read the API's page on RapidAPI: its terms, its plan descriptions, and RapidAPI's own API terms.
   - Email the provider through RapidAPI: "PostSzn Fantasy is a free fantasy game (no ads, no purchases) from <LLC>. May we show your player stats and scores in our free iOS and Android apps, as we do on our website?" Keep the reply.
   - If the answer is no or never comes: licensed feeds exist (Sportradar, Goalserve) but cost money; tell the coordinator, this changes the plan.
2. **Team logos.** The app shows logos loaded from ESPN's image servers (`a.espncdn.com`). They are NFL and team trademarks; nobody licensed them to PostSzn.
   - The native apps ship with logos **off** (kill switch `native_team_logos`, [workstream 06](../mobile/workstreams/06-native-behaviour.md)); they show the team abbreviation and colour instead.
   - Ask the lawyer ([Step 30](30-legal-review.md)) whether showing logos is acceptable, and whether the website should keep them.
   - Turn the switch on only with a clear yes.
3. Team and player **names** used factually (who plays whom, who scored) are normal for fantasy games; still mention them to the lawyer.

## Verify

- You have Tank01's written answer (or a decision to change providers) and the lawyer's view on logos.
- The answer is recorded in the plan's Decisions table ([docs/mobile/README.md](../mobile/README.md#decisions)) by the coordinator.
