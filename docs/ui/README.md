# UI redesign decisions (from the #232 grilling session)

Phone first (375px). Desktop adapts. Visuals are decided later in Claude Design; this records information placement.

## Principles

- The member on a phone is the user. A commissioner is the same person with extra controls on the same pages. Say "commissioner", never "admin".
- A non-member sees nothing of a league.
- Standings are always visible, even before the draft, so they double as the member list.

## Navigation and header

- Header, always: a square logo mark top-left (links to the leagues page); inside a league, the league name with a chevron (switcher) next to it; the avatar top-right (account, sign out). No hamburger.
- Outside a league the square mark becomes the wide "PostSzn Fantasy" logo.
- Switcher: the user's leagues with feed dots, then "Create a league". No "All leagues" (the logo does that) and no "Join with a code" (landing only).
- Bottom tabs inside a league: **League**, **Team**, **Players**, **Feed** (dot), **More**. The first tab is called League, not Home.
- Tapping Team opens your own team. The same page opens for anyone's team from the standings.
- No tab bar outside a league.

## League tab (a season's home)

Order: phase block, standings, notes (collapsible card). No activity teaser.

Phase block:

| Phase | Block |
| :--- | :--- |
| Draft not scheduled | Commissioner: "Invite your friends" with copy-link and share. Members: "Draft not yet scheduled by your commissioner" |
| Scheduled, lobby, live | Date and countdown, **Enter draft** button (the draft room has Start for commissioners) |
| Drafted, before first kickoff | "Set your lineup, locks at kickoff <time>" with a button to Team |
| Playoffs | Current round, games in progress and final, your lineup's live / to play / out counts |
| Finished | Champion card, then the awards shown directly, then standings pushed down |

Standings rows: rank, team and owner, **total points** (prominent), current round points (secondary), "N left, N live", tie marker. Tapping a row expands it (one at a time) to a four-round points table (current round outlined, future rounds a dash) and an **Open team page** button. Before the draft every team slot shows with its owner or "open slot" (commissioner gets an invite action).

"Start next season" is hidden until December 1 of the year after the Super Bowl; the API enforces the same date.

## Team page (replaces the lineup page and the team points page)

- Header: team name, rank, total.
- Round strip, four cells wide (Wild Card, Divisional, Conference Championship, Super Bowl) with each round's team score; the current round is selected by default; tapping one shows that round's lineup.
- Groups per round: Starters, Bench, Eliminated (red treatment), each with a subtotal. Every player shows a score, including bench and eliminated players, and a one-line stat line.
- No separate team feed.
- Your own team: lineup editing for the current and future rounds only, via the player sheet.

## Player sheet (bottom sheet)

- Opens from a player's name on the team page, the Players list and the draft room.
- Top: the full scoring breakdown (each stat and its points) and season stats.
- Own editable team, bottom: move actions, tap only, no drag-and-drop.
  - Bench player: each slot he can fill; empty slot reads "Start at WR1", occupied slot reads "Swap with <player>".
  - Starter: "Move to bench" (always allowed) plus swaps with eligible bench players.
  - Flex slots follow eligible positions; eliminated players cannot start; a locked player (game started) cannot move, and a swap needs both players unlocked. Greyed options say why ("Game started").
  - A commissioner on someone else's team sees the same sheet; moving a locked player asks for override confirmation as today.

## Players tab

- League-scoped, scored by the league's settings. Search, filters for position, team, FLEX (only if the league has a flex slot) and All / Available / Drafted. Each row shows the owner team in this league and a regular-season stat line.
- The global `/players` page goes away.
- The draft room's Players view is the same list with Draft and queue buttons added during a live draft; default filter Available during a live draft, All otherwise.

## Feed tab (chat plus league events)

- One newest-first stream with a message box at the bottom; the tab dot covers new events and new messages.
- Events kept: commissioner overrides, stat corrections, settings changes, joins, leaves and role changes, league created, draft started and completed. Lineup moves are not shown.
- Chat v1: text and GIFs (a GIF search provider is needed; check which are open to new apps). Members delete their own messages, commissioners delete any. No threads, edits or reactions yet.
- Chat posting is for the current season only; an archived season's feed is read-only.
- Push notifications (own epic, before release, iPhone and Android): web push through a manifest, service worker and stored subscriptions. iPhone needs the site added to the Home Screen (iOS 16.4+), so onboarding includes an explainer. First triggers: your pick is on the clock, new chat message (mutable), lineups about to lock.

## Draft room

- Sticky bar: round and pick, team on the clock, countdown (green "You're on the clock" on your turn).
- Collapsed commissioner strip (schedule, start, pause, resume, undo, force pick).
- Views: **Players** (default), Board, Roster, Queue.
- Before the draft: Players browsable, empty Board with the draft order, no clock; the bar says "Draft scheduled for <time>" or "Draft not scheduled yet".
- Board is also under More at all times.

## More and Settings

- More: Settings, How to play, Draft board (always), Past seasons (if any), Invite members (commissioners), sign out. No privacy and terms (landing footer only).
- Settings page, two sections: **Your settings** (display name, team name, notifications, sign out) for everyone; **Commissioner settings** for commissioners (league name and notes, roles, team count, roster and scoring rules, invite link, delete league).

## Landing, create league, invite, small pages

- Landing, signed out: short hero, the four-round explainer linking to How to play, Sign in.
- Signed in with one league: sign-in goes straight to that league. Several leagues: league cards first (phase, your rank, feed dot); Create a league, Join with an invite code and How to play are secondary. No leagues: Create a league and Join with an invite code.
- The logo always opens the leagues page; the redirect only follows sign-in.
- Create league: league name and number of teams, defaults for the rest, optional "Customize rules" (the roster and scoring steps). Then the new league's League tab with "Invite your friends".
- Invite link: preview shows the league name, commissioner, every current member and open slots. Signed out: sign in with an emailed code, then join. Signed in: a "Join league" button. A joiner is auto-assigned an open team. Full league: "This league is full", join disabled, ask the commissioner.
- How to play is public. Dormant notice replaces the landing hero off-season. Not found offers "Go to your leagues". Privacy and terms are landing footer links only.

## Archived seasons, desktop, live updates

- Archived: the same pages, read-only, with an "archived" banner; former members see only finished seasons they had a team in (as today). Past seasons are listed under More.
- Desktop: left rail instead of bottom tabs, a wider centered column, standings with inline round columns, a two-pane draft room (player list left, board and queue right).
- Live: scores and standings refresh automatically while games are on with a "Live, updated 20s ago" indicator; nothing refreshes outside game windows.
- Claude Design brief covers: Settings accordions on phones, invitation-style empty states, and the Eliminated red treatment.

## Behavior changes this implies (backend)

- Auto-assign an open team on join; refuse joins to a full league.
- Hide lineup-move events from the feed (keep storing them; slot marks derive from them).
- Chat messages (table, endpoints, delete rules, live delivery), GIF provider.
- Web push (VAPID keys, subscription table, sender, triggers).
- "Start next season" gate: December 1 of the year after the Super Bowl.

## Proposed follow-up issues

1. Claude Design mockups for every page, phone then desktop (blocks the UI issues below).
2. App shell: header, logo, switcher, five-tab bar, desktop rail.
3. League tab: phase blocks, standings rows with expand, awards, notes.
4. Team page: round strip, groups, stat lines, remove points page and team feed.
5. Player sheet: breakdown and swap moves.
6. Players list: shared with the draft room, filters, owner column, remove the global page.
7. Draft room restructure.
8. Feed and chat (backend and UI), lineup moves hidden.
9. Push notifications.
10. More and Settings split.
11. Landing, leagues page, create-league short path, invite flow, auto-assign team, full-league state.
12. Start-next-season date gate.
13. Archived banner and read-only chat; live refresh indicator.
