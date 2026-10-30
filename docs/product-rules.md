# Product rules

How PostSzn Fantasy is played. This is the source of truth for game behaviour; code and issues follow it. It comes from the commissioner's 15-year spreadsheet league plus a design interview, and anything marked **Open** is deliberately unsettled.

## 1. The game in one paragraph

Each league drafts once, before the Wild Card round, from players on the 14 playoff teams. Every round (Wild Card, Divisional, Conference Championship, Super Bowl) each owner sets a starting lineup from the drafted players whose teams are still alive. Starters score; the bench does not. One cumulative leaderboard decides the champion.

## 2. Draft

- Snake draft, one draft per league, 18 rounds by default (rounds equal the roster size).
- Only players on playoff teams are in the pool, and a draft cannot start until the playoff field is set.
- A draft cannot be scheduled or started after the first Wild Card kickoff. A draft already running may finish; players whose game has started are still draftable and lock on the bench for that round.
- Default 6 teams, 90-second pick clock. League size may be 2 to 14.
- Position caps (default QB 2, K 2, DST 2; RB, WR and TE uncapped). Once a team reaches a cap, that position's players are greyed out in its draft pool with a plain-language reason. Auto-pick (queue first, then the highest season fantasy points under the league's scoring) never picks an ineligible player.
- Create-league shows a yellow warning when teams times max-per-position exceeds the 14 available units of a position (QB, K, DST).
- Roster slots, caps and team count are locked when the draft starts.

## 3. Roster and lineup

- Default roster: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 K, 1 DST, plus 9 bench (18 total).
- Empty slots are allowed and score 0.
- Fullbacks are running backs: ingest maps FB to RB and users never see FB anywhere.
- Lineups are per round and set manually. Nothing is copied forward, pre-filled or auto-substituted. After the draft, all players are unassigned.
- Lineup edits are open at any time, subject to the lock rules below.
- **Locks.** Each player locks at their game's **scheduled kickoff**, in whatever slot they are in (starter, flex or bench). A locked player cannot be moved, swapped or dropped. A move is legal only if every player involved is unlocked.
- **Eliminated players.** A player whose NFL team lost is shown in a separate Eliminated section below the bench, from the next round onward (per round: a Wild Card loser is still valid for the Wild Card and eliminated for the Divisional). Eliminated players cannot be moved. When a round ends, eliminated players drop out of any slot they were placed in early, leaving it empty.
- **Byes.** A team on a bye is alive and its players score 0 that round.
- Players not placed in a slot are shown as "not in this lineup" and score nothing; placing a player on the bench is optional. (**Open:** whether unplaced players count toward "points left on the bench".)
- A banner on the team page warns about empty starter slots before the round's first kickoff. There is no email or push in v1.
- There is no free agency in v1. It may return later as an opt-in league setting.

## 4. Team QB and team K

Two independent league settings, each a required explicit commissioner choice with no default and a tooltip.

- When on, the owner drafts a QB (or K) by name, but the slot scores every player whose official roster position is QB (or K) on that NFL team in that game. A WR who throws a touchdown pass scores as a WR.
- The draft pool lists one QB (or K) per NFL team, the starter; the whole team's QBs (or Ks) leave the pool when one is drafted. The roster shows the drafted name with a tooltip such as "scores all Eagles QBs".
- DST is always a team unit.
- Switching on after the draft is blocked while any team holds two QBs (or Ks) from the same NFL team, and the conflicts are listed. Switching off is always allowed.
- Positions other than QB and K never combine (a backup RB is an ordinary player).

## 5. Scoring

- Defaults are full PPR with the commissioner's spreadsheet values; every item is commissioner-editable, and everything not listed below is 0 (completion, attempt and yardage bonuses, and so on).
- Passing: 0.04 per yard, 4 per TD, -2 per interception. Rushing and receiving: 0.1 per yard, 6 per TD. Reception: 1. Fumble lost: -2. Two-point conversion: 2.
- Kicker: 0.1 per made field-goal yard, 1 per extra point, -1 per missed field goal, -1 per missed extra point. No distance tiers.
- DST: sack 1, interception 1, fumble recovery 1, safety 2, TD 6, defensive two-point return 2. Kick and punt return TDs always go to the DST, never to the individual returner. Yards allowed: 0-99 = 6, 100-199 = 4, 200-299 = 2, 300+ = 0. Points allowed: 0 = 7, 1-13 = 5, 14-21 = 3, 22-28 = 1, 29+ = 0. Points allowed counts only what the defense gave up: the opponent's final score minus 6 for each touchdown the opponent's own defense or special teams scored (so a pick-six thrown by the defense's own offense is not charged to it). Yards allowed is the opponent's total offensive yards.
- A round's score is the sum of points from players in starter slots, multiplied by that round's multiplier (default 1x for all four, commissioner-editable).
- Scores always recompute from the latest data and settings. A stat correction or settings change reflows every round it touches; nobody edits scores by hand.

## 6. Standings and ties

- One cumulative leaderboard; no head-to-head.
- Rank order uses the tiebreaker chain, starting with the latest completed round: the higher score in that round wins, then the previous round, back to the Wild Card. If every round ties, the team with more rostered players (starters and bench) on the Super Bowl winner ranks higher; if that ties, they share the title.
- Wherever a tie decided the order, a tooltip says why one team is above the other.
- Players left is the number of players on the roster, starters or not, whose NFL team is still alive. A league-wide total is shown too and updates as soon as a team is eliminated.
- The home page updates live during games. Each team shows its points, plus nine starters (or however many) as finished, live, to-play and not-playing (colour-coded), and the number of games in progress. Six teams must be visible at once on a phone: rank, team and total in the collapsed row, with the round breakdown, players left and live counts on expand.
- Every team can show its round-by-round points, with each player's counted points and the points left on the bench.

## 7. Commissioner powers and settings

- A commissioner may edit any team's lineup at any time, including locked slots and past rounds. Locked-slot or past-round edits require an explicit "this is a commissioner-only move and the league will be notified" confirmation, and are marked prominently afterwards ("changed by commissioner after kickoff"). Slots set by a commissioner and still unlocked carry an asterisk with who and when. An owner may overwrite an unlocked slot; owners can only make valid unlocked moves.
- A league always has at least one commissioner. A team whose owner leaves stays exactly as it was; the commissioner can manage it or assign it to a new member.
- Roster slots, caps and team count lock at draft start. Scoring, multipliers and the team QB/K choices stay editable; changes recompute everything.
- League notes: a free-text box on the league page for things like buy-in and prizes. The app handles no money.

## 8. Activity feed

One feed per league and one per team, collapsed by default. It records lineup moves, commissioner edits, stat corrections (old score, new score, time) and settings changes (old and new values). A small dot on the league nav and on the feed section marks new activity and clears when the feed is expanded. Individual player scores that changed also carry a tooltip.

The league feed lists every event in the league, and a team's feed the events about that team (settings changes belong to the league only). A member's own actions never count as new for them, and activity from before they joined is not new. A commissioner move that touches a locked player is an override (confirmation, a permanent marker, a league-feed entry); one that touches only unlocked players is an ordinary move marked with an asterisk until the player locks or an owner overwrites the slot. A stat correction is a changed score for a rostered player in a game that was already final, per league because scoring differs.

## 9. Explaining the game

Several rules are unfamiliar (team QB/K, per-round lineups, kickoff locks, eliminated players). Explain them where they matter: a How to play page in the nav, the empty pre-draft roster showing every slot with its caps and the lock rules, tooltips on commissioner settings, and a "locks at kickoff" note on the lineup screen.

## 10. Season end and history

- When the Super Bowl is final, crown the champion and turn the league page into a recap.
- Awards (all use counted points, which means points scored while in a starter slot, multiplied): Playoff MVP, Champion's MVP, top player at each position, best single game, best round, most points left on the bench, best draft value, biggest bust.
- Draft value is the pick number minus the player's rank by counted points. **Open:** the exact formula is a working definition.
- Past seasons are a permanent read-only archive.
- "Run it back" (post-v1) creates next season's league from this one, keeping members and settings.

## Out of scope for v1

Free agency, injury tags, email or push reminders, any money handling, and mid-playoff leagues.
