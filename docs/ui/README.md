# UI redesign decisions (from the #232 grilling session and the canvas review)

Phone first (375px). Desktop adapts.

## Design canvas

The final Claude Design canvas is the **visual source of truth**: [PostSzn Fantasy UI redesign](https://claude.ai/artifact/FUjz9DdcVVKy9PsEMwgvvV). It has one board per page and state (League tab by phase, Team page current and past round, Player sheet, Draft tab Players view, Draft room, Feed, More, Settings and Edit members, Landing, Your leagues, Create league, Invite preview, four Desktop boards, and the Header and Tab bar components).

This doc records behavior and decisions: what each page shows and why it sits where it does. When the two disagree, the canvas wins, because the owner's review comments were applied to the boards. Sample names, numbers and `[PLACEHOLDER]` text on the boards are not copy to ship. Implementation issues read both.

## Principles

- The member on a phone is the user. A commissioner is the same person with extra controls on the same pages. Say "commissioner", never "admin".
- A non-member sees nothing of a league.
- Standings are always visible, even before the draft, so they double as the member list. The commissioner is labeled "commissioner" in every standings row in every League tab state.

## Palette

Sky blue on graphite (dark, the default) or on white (light, #297 and #298). The member picks in Settings > Your settings > **Theme** (Dark or Light, no "match my device" in v1); it applies at once and is remembered per device. The tokens live in `frontend/src/theme.ts` (`palettes`); components use the tokens or the MUI palette, never a hex value. Each token is a CSS variable (`--ps-<name>`) switched by `data-theme` on `<html>`; `ThemeModeContext` holds the mode, and an inline script in `index.html` sets it before first paint so there is no dark flash. The same switch moves `<meta name="theme-color">` and the manifest (`manifest.webmanifest` dark, `manifest-light.webmanifest` light). `src/theme.test.ts` fails if a pair drops below WCAG AA in either mode, and `src/indexHtml.test.ts` fails if the inline script, page background or manifests drift from the palette.

| Role | Token | Dark | Light |
| --- | --- | --- | --- |
| Page background | `bg` | `#121416` | `#ffffff` |
| Card / surface | `surface` | `#1b1e21` | `#f4f6f8` |
| Border | `border` | `#2a2e33` | `#dfe3e8` |
| Text | `text` | `#eceff1` | `#14181c` |
| Muted text | `muted` | `#8d969e` | `#5b6670` |
| Accent fill (buttons, logo mark, on-the-clock cell) | `accentFill` | `#5cb8ff` | `#5cb8ff` |
| Text on accent fill | `accentInk` | `#04233d` | `#04233d` |
| Accent as text, links, icons, borders, focus ring | `accent` | `#5cb8ff` | `#0868b4` |
| Accent tint (pills, selected rows) | `accentSurface` | `#12293d` | `#e3f2ff` |
| Live | `live` | `#34d399` | `#0b7a4b` |

Sky blue `#5cb8ff` on white is only about 2.1:1, so in light mode it is a fill with dark text on it and never small text or a thin icon; those use the darker `accent`. Contained buttons keep the sky-blue fill in both modes.

Green is a status color only: live games and live scores (the live dot, the live indicator, an in-progress player row). Red is for eliminations, errors and the new-activity dot; amber for cautions. Each has its own light shade that passes on white.

## Logo

An eight-team playoff bracket meeting in the middle: rounded corners, line weight growing toward the center, round outer leaf ends, flat inner joints (butt caps, so nothing pokes out), one bold line joining the two halves. No dot, checks or X's. Do not redesign it. The strokes live in `frontend/src/assets/logoGeometry.ts`; `logo-tile.svg` is the same paths on the sky-blue tile (`src/assets/logoGeometry.test.ts` keeps them identical).

One component, `components/common/Logo`: `variant` mark | lockup | stacked, `size` (mark height in px), `tile`.

- **Tile** (sky blue `#5cb8ff`, `#04233d` lines, rx 22): the league header and the desktop rail at 32px, the app icons and the favicon. Use it under 40px; bare lines go faint there.
- **Bare mark**: lines only, in the `accent` token (`#5cb8ff` dark, `#0868b4` light; the issue's about `#0a74c4` failed AA on the accent tint). 40px and up.
- **Lockup** (mark + wordmark): the header with no league switcher (home, signed out, invite and sign-in pages) at a 40px mark.
- **Stacked** (large mark above the wordmark): the sign-in card. The landing hero shows only the bare mark (72px phone, 96px desktop) because the top bar already carries the lockup.
- **Wordmark**: "PostSzn" in Space Grotesk 700 with "Szn" in `accent`, tight tracking, the rest in `text`; "FANTASY" beneath in Space Grotesk 500 at about 0.28em tracking. The font is self-hosted (`@fontsource/space-grotesk`, `assets/fonts.css`, `font-display: block` so the lockup does not reflow).
- **App icons** (`public/icons/`): `icon-180` (full-bleed, iOS masks it), `icon-192`, `icon-512`, `icon-maskable-512` (mark inside the central 80% safe zone), `favicon-32`; `public/favicon.svg` is the tile. Both manifests list the maskable icon. To regenerate, render `logo-tile.svg` with Playwright's chromium.

## Navigation and header

- Header, always: a square logo mark top-left (links to the leagues page); inside a league, the league name with a chevron (switcher) next to it; the avatar top-right (account, sign out). No hamburger.
- Outside a league the square mark becomes the wide "PostSzn Fantasy" logo. The logo is a placeholder (see Open items).
- Switcher: the user's leagues with feed dots, then "Create a league". No "All leagues" (the logo does that) and no "Join with a code" (landing only).
- Bottom tabs inside a league: **League**, **Team**, **Draft**, **Feed** (dot), **More**. The first tab is called League, not Home. The third tab is Draft in every state, before, during and after the draft; there is no Players tab.
- The tab bar is also visible inside the draft room (Draft highlighted), so a member never loses the other tabs while drafting.
- Tapping Team opens your own team. The same page opens for anyone's team from the standings.
- No tab bar outside a league.

## League tab (a season's home)

Order: phase block, standings, notes (collapsible card titled "Commissioner notes", collapsed, "Show"). No activity teaser.

Phase block:

| Phase | Block |
| :--- | :--- |
| Draft not scheduled | Commissioner: "Invite your friends" with a **Copy invite link** button and "N of M teams filled. Draft date not set yet." Members: "Draft not yet scheduled by your commissioner" |
| Scheduled, lobby, live | "Draft starts in" with a large countdown, date and time and "you pick 3rd", **Enter draft** button (the draft room has Start for commissioners) |
| Drafted, before first kickoff | "Set your lineup, locks at kickoff <time>" with a button to Team |
| Playoffs | Current round, "N games live, N final", "Your lineup: N live, N to play". Eliminated players are not counted here |
| Finished | Champion card, then the awards shown directly, then final standings pushed down |

Standings header names the two figures: **Total** and **This rd** (the latter in the same accent outline as the current round cell below). Rows: rank, team and owner ("commissioner" marked), **total points** (prominent), current round points as a small outlined badge in the current-round color (no "+"), "N left, N live", tie marker. Tapping a row expands it (one at a time) to a four-round points table (current round outlined, future rounds a dash) and an **Open team page** button. Before the draft every team slot shows with its owner or "Open slot, waiting for a player"; there is no per-row invite action because the invite block above is the one obvious place. While the draft is only scheduled, every team shows 0.0 and shares rank 1.

Finished season, top to bottom:

1. Champion card: "2025 champion", team name on the top row, owner underneath, final score large on the right (no "points" label).
2. Awards: two cards, **Playoff MVP** and **<Champion team name> MVP**, each with player and points. Then **By position** (QB, RB, WR, TE, K), each position with three rows: **Highest scoring**, **Best value**, **Biggest bust**. Best value and biggest bust show the player, the **overall pick number** he was taken at, and his points (not "+6 places"). A tap-help explains each of the three terms, on the QB section only (repeating it per position is redundant).
3. Final standings: gold, silver and bronze color on rank, team, owner and score for places 1 to 3.
4. Notes.

The old overall "best draft value", "biggest bust", "best bench" and "best game" awards are gone.

"Start next season" is hidden until December 1 of the year after the Super Bowl; the API enforces the same date.

## Team page (replaces the lineup page and the team points page)

- Header: team name, "You" or owner and rank (no "read only" label on any team or round), total.
- Round strip, four cells wide (Wild Card, Divisional, Conference Championship, Super Bowl) with each round's team score; the current round is selected by default; tapping one shows that round's lineup. The round score is the sum of that round's starter scores and appears prominently in the Starters header; Bench has its own subtotal, the sum of its players.
- Groups per round: **Starters**, **Bench**, **Eliminated** (red treatment), each with a subtotal. A finished round shows a "Final" pill on Starters. Every row shows the player's **position** (never "BN"; a bench player is a WR or RB), name, a one-line stat line and a score.
- Starter slots are QB, RB, WR, TE, FLEX, K and **DST**; the league's roster settings decide which appear. The DST shows the team defense with its stat line and points.
- Each player has a visual state, shown on the position label and (for live players) the whole row:
  - **White**: movable, his game has not kicked off.
  - **Green**: in progress. Position, name, stat line and score all take the live green.
  - **Grey**: his game is done.
- Before kickoff the stat line is the **day and time** of the game ("Sun 6:30 pm"), never the word "kickoff". The same wording is used on the player sheet.
- **Eliminated** lists only players whose NFL team went out in the **previous** round, so they were not eligible for Starters or Bench this round. Each shows "Eliminated in Divisional" (or whichever round). A player eliminated earlier does not reappear. If the Ravens lose in this round, Zay Flowers still sits in Starters or Bench for this round and moves to Eliminated next round.
- No separate team feed.
- Your own team: lineup editing for the current and future rounds only, via the player sheet.

## Player sheet (bottom sheet)

- Opens from a player's name on the team page, the Draft tab's Players view and the draft room.
- Header: name, "WR · Jaguars · bench · Divisional", the round score and the game day and time.
- Stats are the player's regular-season line (the round's own game is empty before kickoff, so it cannot lead), chosen by position:
  - QB: completions / attempts, passing yards, passing TDs, rushing yards, rushing TDs.
  - RB, WR, TE: three main stats, rushing and receiving (receptions, receiving yards and TDs; carries, rushing yards and TDs), and rushing is hidden when it is zero.
- Own editable team, bottom: "Move in your lineup", tap only, no drag-and-drop.
  - Bench player: each slot he can fill. An empty slot reads "Start at FLEX" with "Empty slot"; an occupied slot reads "Swap with <player>" with his slot and game day and time ("WR1 · Sun 6:30 pm").
  - Starter: "Move to bench" (always allowed) plus swaps with eligible bench players.
  - Flex slots follow eligible positions; eliminated players cannot start; a locked player (game started) cannot move, and a swap needs both players unlocked. Greyed options say why ("game started, locked").
  - A commissioner on someone else's team sees the same sheet; moving a locked player asks for override confirmation as today.

## Draft tab (the league player list)

- Replaces the old Players tab and the global `/players` page. League-scoped, scored by the league's settings. Search; filters for position (All, QB, RB, WR, TE, FLEX only if the league has a flex slot, K, DST), **NFL team** and **fantasy team** (a team in this league); a **sort** menu with the relevant stats (fantasy points by default, plus the stats for the selected position).
- Each row shows name, position and NFL team, a regular-season stat line, the fantasy team that owns him in this league (a chip; none if unowned), and points.
- Outside a live draft there is no Available / Drafted filter and no draft concept at all.
- During a live draft, the draft room's Players view is this same list with a team filter, **Draft** and queue buttons, and the **All / Available / Drafted** filter. "Drafted by <team>, R1 #3" shows only under All or Drafted, never under Available.
- After the draft, the Draft tab opens on this list.

## Feed tab (chat plus league events)

- One newest-first stream with a message box at the bottom ("Message the league" and a GIF button); the tab dot covers new events and new messages. A "New" divider marks the first unseen item.
- Dates are small separator rows ("Tue, Jan 6"); each item carries its time next to it.
- Events kept: commissioner overrides, stat corrections, settings changes, joins, leaves and role changes, league created, draft started and completed (with the pick count), and **draft order changes**: "randomized the draft order" followed by the full resulting order, and manual changes say who moved where ("Sam's Squad moved from 2 to 4"). Lineup moves are not shown.
- Chat v1: text and GIFs. GIFs come from GIPHY (`utils/gifProvider.ts`, a small interface so another provider can replace it; enabled by `VITE_GIPHY_API_KEY`, hidden without it; the picker says "Powered by GIPHY"). The page reads the feed over a live socket (a content-free nudge refetches it) and polls every 30 seconds while the socket is down. On screen the newest item sits at the bottom above the message box, as on the canvas; the API order is newest first. Members delete their own messages, commissioners delete any. No threads, edits or reactions yet.
- Chat posting is for the current season only; an archived season's feed is read-only.
- Push notifications (own epic, before release, iPhone and Android): web push through a manifest, service worker and stored subscriptions. iPhone needs the site added to the Home Screen (iOS 16.4+), so onboarding includes an explainer (also a tap-help on the Notifications setting). First triggers: your pick is on the clock, new chat message (mutable), lineups about to lock.

### Notification opt-in prompt

Offered right after a member's first sign-in and right after they join a league (never after creating one), so the Settings switch is not the only way to find notifications. A bottom sheet on phones, a centered dialog on desktop, in both themes, colors from the theme tokens only.

- Title "Get notified when it matters", one line on why (your pick is on the clock, lineups about to lock, league chat), primary **Turn on notifications** (it asks the browser for permission from that tap, never on page load), secondary **Not now**, and a footer line "You can change this any time in More, Settings, Notifications." Closing the sheet counts as Not now. After success the sheet says "Notifications are on" with a Done button.
- Steps match the device: Android ("Tap Turn on notifications, then Allow when Chrome asks."), desktop ("Click Turn on notifications, then Allow in the browser popup."), and iPhone in a normal Safari tab (Share, Add to Home Screen, open from the icon; no main button there, iOS 16.4 or later). If the browser blocks the permission from the sheet, it switches to the steps for unblocking it for that platform.
- **Never pepper members.** At most two prompts per device, ever: the second only after Not now and on a different calendar day. Never when notifications are on, blocked, unsupported or not configured on the server; never on a draft screen, the sign-in page, the invite page or while creating a league (it waits and shows once they land somewhere else); never more than once per visit. The count lives in `localStorage` (`postszn-notification-prompt`); a device that cannot remember it shows nothing. Rules in `utils/notificationPrompt.ts`, copy in `content/rules.ts`.
- The Settings row stays the place to manage it. Its tap-help has iPhone and Android sections, and the blocked note says how to re-allow on each platform.
- Claude Design canvas: still to add (phone sheet in the Android, iPhone-needs-install and blocked variants; desktop dialog; light theme versions). The screens are implemented in `components/notifications/NotificationOptIn.tsx`.

## Draft room

- It lives under the Draft tab and keeps the tab bar.
- Sticky bar: round and pick, team on the clock, countdown (accent-colored "You're on the clock" on your turn). Before the draft the bar says "Draft scheduled for <time>" with the time left, or "Draft not scheduled yet"; there is no clock.
- Collapsed commissioner strip ("Commissioner controls", Hide). Before the draft its four actions are the same size and color: **Randomize draft order**, **Edit draft order**, **Change date** (shows the current date) and **Start draft**. Editing the order moves teams up and down. There is no "Open lobby": the lobby is always open. Every order change is posted to the Feed, with the full new order when randomized. During a live draft the strip holds pause, resume, undo and force pick.
- Views: **Players** (default), Board, Roster, Queue. The Board shows picks colored by position with the player as "J. Allen" (first initial and last name) and position and NFL team; your column is outlined and the pick on the clock is highlighted.
- Before the draft: Players browsable, empty Board with the draft order, no clock.

## More and Settings

- More: Settings ("Your settings and commissioner settings"), Players (the league player list, with the draft status line), Past seasons (**only if the league has any**), Invite members (commissioners), Help: How to play and **Report a problem** (opens the modal below), Account: Sign out. No privacy and terms (landing footer only).
- **Report a problem** (#296) is a modal, a bottom sheet on phones and a dialog on desktop, opened only from this More row (no other entry point). Fields: **What went wrong?** (required, multiline), **Screenshots (optional)** (images only, up to 5, 5 MB each, 15 MB together; the phone picker accepts `image/*`; one line says a screenshot and the diagnostic info each help and both together get it fixed faster; an inline warning next to the picker explains any image or file that was not attached, for example "That image is 7.2 MB. The limit is 5.0 MB per image."; a running line "3 of 5 images, 9.1 MB of 15.0 MB"), and an **Include diagnostic info** checkbox (on by default) with an expandable **What's included** preview that shows exactly what is sent. States: empty (Send disabled), filled, with images, too-large image message, sending ("Sending…"), error (inline, the message stays), sent (the sheet closes and a toast says "Sent. We'll reply by email."). Colors come from theme tokens only. The Claude Design canvas still needs this board added.
- Settings page, two sections: **Your settings** (display name, team name, **Theme** (Dark / Light), notifications with a tap-help on iPhone setup) for everyone; **Commissioner settings** for commissioners, in this order: Edit league name (shows the current name), Edit league note (shows an abbreviated preview, "Hello all and welco..."), **Number of teams** (locks at draft start), **Edit members**, Scoring, Invite link, Delete league.
- **Edit members** opens a modal: each member with a Commissioner toggle and **Remove from league**. A league always keeps at least one commissioner (the only commissioner's toggle is locked on). Removing a member frees their team slot; their picks stay in the draft history.
- Scoring is a section of subsections (Passing, Rushing, Receiving and so on), each with its own rows.
- Delete league is one row with a warning; the confirmations happen in the dialog, not described on the row.

## Landing, create league, invite, small pages

- Landing, signed out: a short hero ("Fantasy football for the playoffs only"), **Sign in** and an accent-outlined **How to play** button the exact size of Sign in (to its right on desktop, centered), then Privacy and Terms footer links. No round explainer on the page.
- Signed in with one league: sign-in goes straight to that league. Several leagues: league cards first (phase, your rank and points, or draft time and teams filled; feed dot); Create a league and Join with an invite code are secondary, then a **"Read how to play"** link in the same accent color as the landing page's How to play, then Privacy and Terms. No leagues: Create a league and Join with an invite code.
- The logo always opens the leagues page; the redirect only follows sign-in.
- Create league: league name and a number-of-teams stepper (changeable until the draft starts), a "Default rules" summary of the roster and reception scoring, optional "Customize rules" (the roster and scoring steps). Defaults do not make later rounds count for more: every round multiplier defaults to 1x, as in `docs/product-rules.md`. Then the new league's League tab with "Invite your friends".
- Invite link: preview shows "You're invited", the league name, commissioner and year, "N of M teams filled", every current member (commissioner marked) and the open slots. Signed out: sign in with an emailed code, then join. Signed in: a **Join league** button and "Signed in as <email>". A joiner is auto-assigned an open team (no "this will be your team" text). Full league: "This league is full", join disabled, ask the commissioner.
- How to play is public. Dormant notice replaces the landing hero off-season. Not found offers "Go to your leagues". Privacy and terms are links on the landing and leagues pages only.

## Archived seasons, desktop, live updates

- Archived: the same pages, read-only, with an "archived" banner; former members see only finished seasons they had a team in (as today). Past seasons are listed under More.
- Desktop: the bottom tabs become a top navigation bar, each item an icon with its label right next to it (the same icons as the phone tabs), under the header with the league name. A wider centered column. Per page:
  - League: standings as a table with inline round columns (Wild Card, Divisional, Conf., Super Bowl) and Total, plus "Live, updated 20s ago".
  - Team: the round cells and lineup side by side in the wider column.
  - Draft room: the queue sits above the player list on the left; the board and a vertical roster (every slot on its own row, bench included) are always on screen on the right, with no Roster or Board buttons and no separate Queue tab.
  - Landing: the same hero with Sign in and How to play side by side, centered.
- Live: scores and standings refresh automatically while games are on with a "Live, updated 20s ago" indicator; nothing refreshes outside game windows. In code the standings poll every 20 seconds only while the standings report a live game, and refresh when the page regains focus otherwise; the indicator appears in the playoff phase block of the League tab. The team breakdown still polls on its own timer.

## Behavior changes this implies

Backend:

- Auto-assign an open team on join; refuse joins to a full league.
- Hide lineup-move events from the feed (keep storing them; slot marks derive from them).
- Draft-order events in the feed: randomize (with the full order) and manual changes (who moved where), written from the order endpoints.
- Chat messages (table, endpoints, delete rules, live delivery), GIF provider.
- Web push (VAPID keys, subscription table, sender, triggers).
- "Start next season" gate: December 1 of the year after the Super Bowl.
- Awards: Playoff MVP and champion team MVP; per position (QB, RB, WR, TE, K) highest scoring, best value and biggest bust, the last two reporting the **overall pick number** and points; drop best game, best round, best bench and the overall draft value and bust awards.
- Player list: sort by stat and a fantasy team filter on the league-scoped list; per-position stat lines for the player sheet.
- Removing a member (Edit members) frees the team slot and keeps picks in history.

Frontend:

- Draft tab replaces Players; the tab bar stays in the draft room; the global `/players` page goes away.
- Team page: positions instead of "BN", DST slot, movable / live / done states, eliminated only from the previous round, day and time instead of "kickoff".
- Settings: Number of teams row and an Edit members modal (replacing "Teams and roles").

## Open items

- The logo (square mark and wide wordmark) is a placeholder.
- GIF provider for chat: GIPHY is wired because its API shape is documented and open to new apps; Tenor is closed to new apps and Klipy is the free alternative (add an adapter next to `giphyProvider`). A production GIPHY key needs their approval and the "Powered by" credit.
- Team page DST: built as `<NFL team> Defense` with a line of sacks, INTs, fumble recoveries, touchdowns, safeties and points allowed; before the game it shows the day and time like any player.
- Player sheet: the round's scoring breakdown (each stat and its points) is not on the board. The sheet shows the round's stat line ("This round") once the game has started, above the regular season line; a per-stat points breakdown is still open.
- The live game clock is shown as the upstream reports it ("Live 8:42"); the quarter is not stored, so the board's "Q3" is not built yet.
- Decided (#264): More keeps a **Draft board** row (`/draft/board`) next to **Players** (the Draft tab), so the board is reachable before, during and after the draft; the Draft tab after the draft shows only the player list.
- Draft room details the canvas leaves open: the date, seconds per pick, draft type and clock-expiry rules live behind "Draft settings" in the commissioner strip (they left Settings); "Edit draft order" saves with one button so a reshuffle is one Feed event.
- Awards: DST has no per-position section on the board; the awards boards show `[PLAYER]` placeholders for values to be computed.
- The desktop Team page board still shows older wording ("BN", "Ravens out in Divisional", `[TEAM] D/ST`); the phone Team boards and the rules above apply to desktop too.
- Whether Sign out also appears inside Settings (the board has it only in More and the avatar menu).

- The Settings board has no Roster row (the owner could not tell what "Locked after draft" meant, and a non-editable row was removed). Decide where roster shape is edited before the draft; today it is a Settings form.

## Proposed follow-up issues

1. Claude Design mockups for every page, phone then desktop (done; the canvas above).
2. App shell: header, logo, switcher, five-tab bar (League, Team, Draft, Feed, More), desktop top navigation.
3. League tab: phase blocks, standings rows with expand, awards, notes.
4. Team page: round strip, groups, stat lines and player states, DST, remove points page and team feed.
5. Player sheet: per-position stats and swap moves.
6. Draft tab player list: shared with the draft room, filters and sorts, owner chip, remove the global page.
7. Draft room restructure (tab bar kept, commissioner strip, desktop two-pane).
8. Feed and chat (backend and UI), lineup moves hidden, draft-order events.
9. Push notifications.
10. More and Settings split (Number of teams, Edit members modal, scoring subsections).
11. Landing, leagues page, create-league short path, invite flow, auto-assign team, full-league state.
12. Start-next-season date gate.
13. Archived banner and read-only chat; live refresh indicator.
