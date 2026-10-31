# Injury tags on players (issue #188)

Question: does Tank01 give us an injury status we can show in the draft pool and the lineup?

## Findings

- **Verified** (recorded in `team-qb-k-starter-source.md`, section 2): `getNFLPlayerList` and
  `getNFLTeamRoster` rows carry `injury: {designation, description, injDate, injReturnDate}`.
  `designation` values actually observed: `Questionable`, `Injured Reserve`, and empty. No extra
  call is needed: the player list is already ingested daily (`ingest_nfl_players`), so the tag
  costs **0 additional requests**.
- **Unverified**: the strings `Out` and `Doubtful`. They are the NFL's standard game-status
  designations and the ones the issue names, but no response containing them was captured (the
  local dev environment has no RapidAPI key, so this research made no live call). The parser
  matches them case-insensitively and a wrong guess at the spelling simply shows no tag.
- **Unverified**: how quickly Tank01 refreshes `designation` (game-week reports are published
  Wednesday to Friday, with Saturday/Sunday inactive lists), and whether it clears the field after a
  player returns. The tag is only as fresh as the daily player sync; the UI must not promise more.
- **Unverified**: other designations (`Suspended`, `PUP`, `Day-To-Day`, `Physically Unable`).
  Not shown in v1; they are stored as no tag.
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
