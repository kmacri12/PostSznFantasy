# PostSzn Fantasy

Fantasy football for the NFL postseason. A league drafts once before the Wild Card round, owners set a lineup each round, and real teams losing eliminates their players.

## Language

### League and people

**League**:
The permanent group: its members and roles, notes and invite. It plays one season each year and is never read-only.
_Avoid_: Group, pool, contest

**Season**:
One year of a league: its settings, teams and owners, draft, rosters, lineups, standings, activity, awards and recap. Archived (read-only) once that year's Super Bowl is final.
_Avoid_: Year, edition

**Commissioner**:
A league member who sets up and manages the league. A league always has at least one.
_Avoid_: Admin, host, owner (reserved for team owners)

**Owner**:
The person who runs a fantasy team and sets its lineups.
_Avoid_: Manager, user, GM

**Fantasy team**:
A team an owner builds in a league. Always say "fantasy team" when "NFL team" could also be meant.
_Avoid_: Team (on its own, when ambiguous), squad

**NFL team**:
A real franchise that plays in the postseason. Its players are alive or eliminated.
_Avoid_: Club, franchise, real team

### Postseason

**Round**:
One of the four stages of the postseason: Wild Card, Divisional, Conference Championship, Super Bowl.
_Avoid_: Week, matchup

**Alive**:
An NFL team that has not lost in the playoffs, and so can still play in the next round. Its players are alive too.
_Avoid_: Active, surviving

**Eliminated**:
An NFL team that lost, and its players. Elimination is per round: a Wild Card loser is still valid for the Wild Card and eliminated from the Divisional on.
_Avoid_: Out, dead, knocked out

**Bye**:
A round an alive NFL team skips. Its players are alive and score 0 that round.
_Avoid_: Off week

**Kickoff**:
The scheduled start time of a player's game. It is the moment that player locks.
_Avoid_: Game time, start

**Completed round**:
A round in which every game is final.
_Avoid_: Finished round, past round

**Current round**:
The earliest round that is not complete, or the Super Bowl once it is final. It is the round the live standings describe.
_Avoid_: Active round, this week

### Roster and lineup

**Draft pool**:
The players still available to draft: players on playoff NFL teams not yet picked, and for team positions, not yet claimed.
_Avoid_: Player list, free agents

**Running back (RB)**:
The position shown for every running back and fullback. Fullbacks are never shown as FB.
_Avoid_: FB

**Playoff field**:
The 14 NFL teams in the postseason (12 Wild Card teams plus the two byes). The draft pool is built from it, and a draft cannot start until all 14 are known.
_Avoid_: Bracket, playoff teams (when the set being complete matters)

**Draft cutoff**:
The first Wild Card kickoff. A draft cannot be scheduled or started after it; one already running may finish, and picks whose game has started lock to the bench.
_Avoid_: Deadline

**Roster**:
All the players a fantasy team drafted, whether or not they are in a lineup.
_Avoid_: Squad

**Lineup**:
An owner's assignment of roster players to starter slots and bench for one round. Empty until the owner sets it; never copied forward.
_Avoid_: Depth chart, starting lineup (when the whole thing is meant)

**Starter**:
A player in a starter slot for a round. Only starters score.
_Avoid_: Active player

**Bench**:
The roster slots whose players do not score. Bench players are still alive and can move into starter slots before they lock.
_Avoid_: Reserves

**Unassigned**:
A rostered player not placed in any slot of a round's lineup. Everyone is unassigned after the draft. Unassigned players do not score.
_Avoid_: Free agent, inactive

**Eliminated section**:
The part of the roster below the bench showing, for a given round, players whose NFL team is eliminated. They cannot be moved.
_Avoid_: Graveyard, IR

**Lock**:
A player becoming immovable, in whatever slot they are in, at their kickoff. A locked player cannot be moved, swapped or dropped.
_Avoid_: Freeze, deadline

**Position cap**:
The most players of one position a fantasy team may draft (default QB 2, K 2, DST 2; RB, WR and TE uncapped). With team QB (or team K) on, the cap counts different NFL teams. A team at its cap sees that position greyed out in the draft pool with the reason, and neither REST nor WebSocket will accept the pick.
_Avoid_: Max roster spots, limit

### Team positions

**Team unit**:
A position scored by an NFL team rather than a person: always DST, and QB or K when the league turns on team QB or team K.
_Avoid_: Combined position

**Team QB / Team K**:
A league setting under which a drafted QB (or K) scores every player whose official roster position is QB (or K) on that NFL team in that game. The owner drafts by name, and the whole team's QBs (or Ks) leave the draft pool. Each is its own required commissioner choice, and a league can have one on and the other off.
_Avoid_: Combine QB, backup coverage

**Official roster position**:
The position the league data lists for a player on his NFL team's roster. It alone decides who counts as a QB or K for a team unit: a WR who throws a touchdown pass scores as a WR, and a kicker is a K.
_Avoid_: Stat position, listed role

**Depth-chart starter**:
The one QB (or K) per NFL team that the draft pool lists while team QB (or team K) is on. It is the first name on the NFL team's depth chart, or the player with the most pass attempts (or kicks) when the depth chart has no usable entry.
_Avoid_: Starter (a lineup term), QB1

**Same-team conflict**:
A fantasy team holding two QBs (or two Ks) from the same NFL team. It blocks turning team QB (or team K) on, because the unit would be drafted twice.
_Avoid_: Duplicate, overlap

**DST**:
A team defense and special teams, drafted and scored as a unit. Kick and punt return touchdowns score for the DST, never for the returner.
_Avoid_: Defense, D/ST, DEF

### Scoring and standings

**Counted points**:
Points a player scored while in a starter slot, multiplied by the round's multiplier.
_Avoid_: Fantasy points (ambiguous), actual points

**Bench points**:
Points a player scored in a round without being in a starter slot, whether placed on the bench or unassigned, multiplied by the round's multiplier like counted points so the two compare directly. They never count.
_Avoid_: Wasted points

**Points left on the bench**:
A fantasy team's bench points summed over every round.
_Avoid_: Wasted points, missed points

**Starter progress**:
Where a fantasy team's starter slots stand in the current round: **finished** (their game is over), **live** (in progress), **to play** (not kicked off) or **not playing** (empty slot, eliminated player or bye). Every starter slot is in exactly one.
_Avoid_: Live status, game status

**Multiplier**:
A per-round factor applied to a round's points. Defaults to 1x for every round.
_Avoid_: Weight, bonus

**Round score**:
A fantasy team's counted points for one round.
_Avoid_: Weekly score

**Total**:
A fantasy team's sum of round scores. Ranking is by total.
_Avoid_: Season points

**Players left**:
The number of players on a roster, starters or not, whose NFL team is still alive. Also summed league-wide.
_Avoid_: Survivors, alive count

**Tiebreaker chain**:
The ordered rule for breaking ties: the latest completed round's score, back to the Wild Card, then the number of rostered players on the Super Bowl winner, then a shared title. It is the same in every league.
_Avoid_: Tiebreak

**Tie reason**:
The step of the tiebreaker chain that put one fantasy team above another with the same total, with the two values compared.
_Avoid_: Tiebreak explanation

**League notes**:
Free text on the league page for house rules and a welcome message. A commissioner edits it and every member reads it.
_Avoid_: Rules text, description

### Oversight

**Commissioner override**:
A commissioner changing a lineup in a way an owner could not: moving a locked player, which includes anything in a past round. It requires confirmation and is permanently marked.
_Avoid_: Admin edit, manual fix

**Override marker**:
The permanent "changed by commissioner after kickoff" label on a slot a commissioner override changed, naming who and when.
_Avoid_: Flag, badge

**Commissioner-set slot**:
A slot a commissioner filled while its player was still unlocked. It carries an asterisk with who and when until the player locks or an owner overwrites it. It is not an override.
_Avoid_: Pinned slot

**Activity feed**:
The record of lineup moves, commissioner overrides, stat corrections and settings changes, per league and per fantasy team.
_Avoid_: Audit log, history

**Activity event**:
One entry in the activity feed. Events are only ever added, never edited or removed.
_Avoid_: Log line, notification

**Lineup move**:
An owner or commissioner placing, moving or removing one player in a round's lineup.
_Avoid_: Transaction, trade

**Stat correction**:
A change to a finished game's stats that changes a player's score, recorded with the old score, the new score and when. Stats moving during a live game are not corrections.
_Avoid_: Score edit, adjustment

**Changed score**:
A player's round score that differs from an earlier one because of a stat correction.
_Avoid_: Revised score

**Settings change**:
An edit to league scoring, multipliers or team QB/K after the league was created, recorded with each changed field's old and new value.
_Avoid_: Config update

**New activity**:
Activity events in a feed newer than the last time that member expanded it.
_Avoid_: Unread, unseen

### Season

**Champion**:
The fantasy team that ranks first once the Super Bowl is final. Teams level on the whole tiebreaker chain are co-champions.
_Avoid_: Winner

**Finished league**:
A league whose season's Super Bowl is final. It is derived from the games, never stored.
_Avoid_: Closed league, ended league

**Archive**:
The permanent read-only record of a finished league: readable, and every write through the API is refused (409).
_Avoid_: History

**Season awards**:
The recap's honours (Playoff MVP, Champion's MVP, top player per position, best single game, best round, most points left on the bench, best draft value, biggest bust), all computed on read from counted points.
_Avoid_: Trophies, badges

**Draft value**:
A drafted player's order among his position's picks minus his finish rank by counted points among that position's drafted players (1 = most). Positive means he outscored his draft slot; the most negative is the biggest bust.
_Avoid_: ADP delta

**Start a season**:
A league's commissioner starting next year's season once the last one's Super Bowl is final: the teams, owners and settings carry over, with fresh rosters and an empty unscheduled draft. The league, its members and its invite do not change.
_Avoid_: Run it back, rollover, clone
