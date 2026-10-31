# Injury tags on players (issue #188)

Question: does Tank01 give us an injury status we can show in the draft pool and the lineup?

## Findings

- **Verified (2026-10-31, one live `getNFLPlayerList` response, 3,833 players)**: rows carry
  `injury: {designation, description, injDate, injReturnDate}`. Counts of `designation`: empty
  3402, `Injured Reserve` 229, `Questionable` 100, `Out` 68, `Injured Reserve - Designated to
  Return` 31, `Doubtful` 3. No extra call is needed: the player list is already ingested daily
  (`ingest_nfl_players`), so the tag costs **0 additional requests**.
- `Injured Reserve - Designated to Return` is on injured reserve but allowed to practise; it maps to
  the `Injured Reserve` tag (a separate tag would add a fifth word to explain for no decision a
  manager can act on differently). Any other string is stored as no tag.
- **Unverified**: how quickly Tank01 refreshes `designation` (game-week reports are published
  Wednesday to Friday, with Saturday/Sunday inactive lists), and whether it clears the field after a
  player returns. The tag is only as fresh as the daily player sync; the UI must not promise more.
- No other designation appeared in that response (not `Suspended`, `PUP` or `Day-To-Day`). If one
  shows up later it is stored as no tag.
- `description`, `injDate` and `injReturnDate` exist but are free text or dates of unknown
  reliability. Not used.
- Depth-chart entries have no injury field; the player list is the only source covering injured
  reserve players.

## Decision

Store one nullable `nfl_players.injury_status` holding one of `Out`, `Doubtful`, `Questionable`,
`Injured Reserve` (canonical spelling), `NULL` otherwise. Replaced wholesale by each player sync,
so a cleared designation clears the tag. Exposed as `injuryStatus` on players (directory, draft
pool) and on roster / lineup players. Display only: the tag never blocks a pick or a lineup move,
because an `Out` player can still be drafted and a team QB / K slot is unaffected.
