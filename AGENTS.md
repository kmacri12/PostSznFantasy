# AGENTS.md — Agent Playbook for PostSzn Fantasy (`postsznfantasy`)

## 1. Project Overview & Architecture Status

**PostSzn Fantasy** is a fantasy football application tailored specifically for the NFL postseason (Wild Card, Divisional, Conference Championship, Super Bowl). Unlike full-season fantasy platforms, playoff fantasy features cascading elimination mechanics: as real NFL teams lose, their players are eliminated, making player survival and scoring progression central to league standings.

### Modern Architecture Spec
> [!IMPORTANT]
> **PRE-DEVELOPMENT / LOCAL-ONLY CONTEXT (ZERO MIGRATION CONSTRAINTS)**:
> This project is in an **early pre-dev, local-only prototyping phase**. There are **no production databases, no active users, no live data, and no backward-compatibility requirements**.
> Everything is on the table: schema redesigns, table wipes, dropping legacy code wholesale, replacing state management, or restructuring routes. Do not write complex data migrations or retain deprecated shims for existing data—build the cleanest target architecture from scratch.
>
> The codebase has been fully modernized to a **FastAPI** backend with async SQLAlchemy 2.0 and Pydantic v2 schemas, and a **React 19 + Vite** SPA in TypeScript.

| Component | Modern Implementation Stack |
| :--- | :--- |
| **Backend Framework** | **FastAPI** (ASGI, `uvicorn`, async routes, dependency injection) |
| **Package & Env Manager** | **`uv`** + standard **`pyproject.toml`** (`uv.lock`) |
| **Backend Lint / Format / Type** | **Ruff** (lint & format) + **Mypy** (strict static typing) |
| **API Validation** | Full Pydantic v2 schemas for all requests/responses (`BaseSchema` with `to_camel`) |
| **Real-Time / Sockets**| Native **FastAPI WebSockets** (`starlette.websockets` + `DraftConnectionManager`) |
| **ORM & Database** | SQLAlchemy 2.0 (`asyncpg` async session) + PostgreSQL 17 |
| **DB Migrations** | **Alembic** migrations (`alembic upgrade head`) |
| **Configuration** | **Pydantic Settings** (`api/core/config.py` cached singleton) |
| **Auth** | Supabase Auth (Google or an emailed one-time code; JWT verification via FastAPI `Depends(get_current_user)`) |
| **NFL Data Ingestion** | Async HTTP client (`httpx.AsyncClient`) with `tenacity` retries |
| **Frontend Runtime** | React 19, Vite 8, strict TypeScript |
| **Frontend Linter & Formatter** | **Biome** (`@biomejs/biome`, `biome.json`) |
| **UI Components** | MUI (`@mui/material` 9.5, Emotion 11.14) |
| **Table Component** | TanStack Table v8 (`@tanstack/react-table`) |
| **State Management** | React Context (`UserContext`) + native `useWebSocket` hook |

---

## 2. Directory Structure & Key Logic Map

```
PostSznFantasy/
├── docker-compose.yml          # PostgreSQL 17 container definition
├── Makefile                    # Single entry point for setup, run, lint, test
├── README.md                   # System documentation & developer quickstart
├── CONTRIBUTING.md             # Contribution guidelines, branching, & DoD
├── AGENTS.md                   # This agent operational playbook
├── ROADMAP.md                  # Active roadmap (phases 15+)
├── REWRITE_ROADMAP.md          # Archived modernization history (phases 1-14)
├── docs/owner/                 # Owner launch guide: one page per step, in launch order (23-monitoring.md: Metabase on the metrics views, uptime, Cloudflare Web Analytics, Sentry alerts)
├── docs/ui/                    # Approved UI redesign decisions (#232) and the link to the final Claude Design canvas: navigation, pages, information placement
├── api/                        # Backend service (Python 3.13 + FastAPI)
│   ├── alembic/                # Database migrations
│   │   ├── versions/           # Migration revisions (0024 adds the `metrics_daily` / `metrics_leagues` / `metrics_users` views and the `metrics_reader` role, #358: aggregates only, never emails or names; `tests/postgres/test_metrics_views.py` runs the view SQL)
│   │   └── env.py              # Alembic environment runner
│   ├── core/                   # Centralized application configuration
│   │   ├── rate_limit.py   # In-memory sliding-window `RateLimiter` (single API process, same reasoning as support) and the per-route dependencies: chat 20/min and 200/h, create-league 5/day, join 10/h, avatar PUT 10/h, login 30/min (all per user), invite preview 60/min per IP; 429 with `Retry-After` and a readable `detail`; `SocketThrottle` for the sockets; `reset_all()` runs before every test
│   │   ├── body_limit.py   # ASGI middleware counting the bytes a handler reads, so chunked bodies hit the cap too (413): 256 KB default, avatar routes 1 MB + slack, support its own cap
│   │   ├── config.py           # Settings model via pydantic-settings
│   │   └── logging.py          # Logging setup (JSON/console) + request-ID middleware
│   ├── db/                     # Async database sessions & models
│   │   ├── base.py             # DeclarativeBase metadata
│   │   ├── session.py          # asyncpg connection engine & get_db dependency
│   │   └── models/             # Domain-scoped SQLAlchemy 2.0 ORM models
│   │       ├── activity.py     # ActivityEvent (append-only feed), LeagueMessage (chat, soft delete) and ActivityView (last-viewed event and message per member and feed)
│   │       ├── user.py         # User model
│   │       ├── league.py       # League, Season, LeagueMember, SeasonSettings, Team, Roster, SeasonStanding models
│   │       ├── draft.py        # Draft and DraftPick models
│   │       ├── push.py         # PushSubscription (one row per device endpoint), LineupReminder (a lock reminder already sent per team and round)
│   │       ├── notification.py # Notification: one inbox entry per member (kind, league, ids-only payload, read_at), kept 30 days
│   │       └── nfl.py          # NFLTeam, NFLPlayer, Stats, Game models
│   ├── dependencies/           # FastAPI dependency providers
│   │   ├── clock.py            # `Today`: the current date, overridable in tests
│   │   ├── auth.py             # Supabase JWT validation (verify_token, get_current_user)
│   │   └── league.py           # LeagueMember (league routes, never read-only) and SeasonMember/DraftMember/TeamMember guards (403 for non-members and former members, except reads of a finished season they owned a team in; 409 on writes to a finished season))
│   ├── models/                 # Pydantic v2 DTO schemas (camelCase serialization)
│   │   ├── base.py             # BaseSchema with alias_generator = to_camel
│   │   ├── activity_models.py  # Activity event payloads (incl. the draft ones), event pages, slot marks, score changes
│   │   ├── feed_models.py      # Feed page (events + messages), message create, viewed marker
│   │   ├── auth_models.py      # Auth exchange DTOs
│   │   ├── recap_models.py     # SeasonRecap, RecapTeam, AwardWinner DTOs
│   │   ├── league_models.py    # League and season overviews, Standings, Team DTOs
│   │   ├── draft_models.py     # Draft status and pick DTOs
│   │   └── players_models.py   # Player directory DTOs
│   ├── routers/                # Modular APIRouters
│   │   ├── activity.py         # League and team activity feeds, the unified Feed, chat post/delete, viewed markers, Feed WebSocket
│   │   ├── admin.py            # Ingestion triggers (admin only)
│   │   ├── auth.py             # User onboarding & token exchange
│   │   ├── drafts.py           # Draft state/setup/order/controls/queue/REST picks + authenticated WebSocket
│   │   ├── invites.py          # Invite create/regenerate/revoke, public preview, join
│   │   ├── leagues.py          # League create/list/overview/rename+notes, members/roles, start a season
│   │   ├── seasons.py          # Season overview, team count, team owners, settings, teams, standings, recap
│   │   ├── teams.py            # Team page: per-round lineups, rename, lineup moves
│   │   ├── avatars.py          # Profile, league and team pictures: `GET /api/avatars/{key}` (public capability URL), `PUT/DELETE /api/avatars/me`, `/api/leagues/{id}/avatar` (commissioner), `/api/teams/{id}/avatar` (owner or commissioner)
│   │   ├── push.py             # VAPID public key, subscribe / unsubscribe a device
│   │   ├── notifications.py    # The inbox: `GET /api/notifications`, `POST /api/notifications/read`
│   │   ├── support.py          # POST /api/support: a member's problem report (multipart) emailed to support
│   │   └── players.py          # Player database & stats endpoints
│   ├── scripts/                # Database seeding & administrative CLI scripts
│   │   ├── generate_vapid_keys.py # Prints a VAPID key pair for web push (docs/owner/18-push-notifications.md)
│   │   ├── prune_avatars.py    # Deletes orphaned picture objects (also run by the scheduler's roster sync)
│   │   ├── delete_user.py      # Owner-only: the same account deletion by user id (docs/owner/account-deletion.md)
│   │   ├── restore_league.py   # Owner-only: clears deleted_at on a deleted league (docs/owner/league-restore.md)
│   │   ├── recreate_auth_users.py # Rebuild Supabase Auth users (same ids) from fantasy.users after a lost project; dry run by default, --rehearse for a fake Auth server
│   │   ├── seed_nfl_data.py    # Unified on-demand NFL data seeder
│   │   └── set_playoff_field.py # Sets the 14-team field by abbreviation (bye teams aren't ingested); run via fly ssh console
│   ├── services/               # Decoupled ingestion & domain services
│   │   ├── eliminations.py     # mark_eliminated_teams
│   │   ├── standings.py        # Recomputes the fantasy.standings snapshot (starters' round points, players left, ranks) for drafted leagues after polls, reconciles, admin score changes and draft completion; a failing league keeps its old rows
│   │   ├── standings_view.py   # GET standings: re-ranks the snapshot with the tiebreaker chain, adds tie reasons, current-round starter counts, league-wide players left
│   │   ├── ranking.py          # Pure tiebreaker chain (latest completed round back to the Wild Card, then players on the Super Bowl winner, then shared rank)
│   │   ├── season_recap.py     # Finished-season recap: champion(s) = rank 1, awards, next season link; `season_is_finished` (Super Bowl final) also drives the archive guard
│   │   ├── awards.py           # Pure award rules over counted/bench point lines and roster owners (MVPs, positions, best game/round, bench, draft value, bust)
│   │   ├── seasons.py          # current_season and start_season (next year's season from a finished one: teams, owners, settings; same members and invite)
│   │   ├── round_points.py     # Counted and bench points per team/round/player, computed on read; shared by standings, the breakdown and (Epic 18) awards
│   │   ├── round_progress.py   # Starter counts: finished / live / to play / not playing
│   │   ├── team_breakdown.py   # Round-by-round points data (`GET /api/teams/{id}/breakdown`; the SPA no longer calls it)
│   │   ├── draft_flow.py       # Draft state machine, order, pause/resume/undo, queue, auto-pick
│   │   ├── playoff_field.py    # Playoff field (draft pool), first Wild Card kickoff cutoff
│   │   ├── feed.py             # The Feed: events and chat merged newest first (one cursor), post/delete messages, GIF host allowlist
│   │   ├── activity.py         # Append-only activity feed: append, feed pages, per-member viewed markers, slot marks
│   │   ├── stat_corrections.py # Snapshots a final game's stats before ingest overwrites them; posts stat_correction events (team QB/K unit members' corrections post against the drafted player)
│   │   ├── settings_changes.py # record_settings_change (old/new diff to the feed) + the recompute hook; Epic 13 calls it too
│   │   ├── draft_clock.py      # 1s loop auto-picking expired server-side deadlines and any team on the clock with no owner
│   │   ├── notifications.py    # **The one way to notify a member** (#397): `notify(db, user_ids, Notice(kind, league_id, payload, push=PushMessage(...)))` writes an inbox entry for every recipient (whatever their push choices or devices; an unread repeat of the same kind and payload moves up instead of adding one), commits, then pushes through `push.send_to_users` under the kind's preference (`PUSH_KINDS`). A new kind: add it to `NotificationKind` and `PUSH_KINDS`, word and link it in the SPA's `components/notifications/inboxView.ts`, call `notify` (payload ids only, camelCase keys). Also the triggers (`notify_on_the_clock`, `notify_draft_phase`, `notify_draft_soon`, `notify_lineup_lock`, `notify_lineup_changed`), the inbox read (`inbox`, `mark_read`), `prune_old` (scheduler roster sync) and `delete_for_user` (account deletion). Chat is not in the inbox (the Feed has its own dot)
│   │   ├── push.py             # Web push transport (pywebpush, best-effort, prunes 404/410 subscriptions, `spawn` for background sends; `PushMessage.urgency`: on-the-clock and lineup-lock reminders go out `Urgency: high` so Android delivers them while idle, chat stays normal); `notify_league_message` pushes a new chat message to the other active members who turned chat on and have not muted the league (author and league name only, never the text)
│   │   ├── avatars.py          # Picture store (Supabase Storage private bucket, or `AVATAR_LOCAL_DIR` in dev/e2e; `_store_override` / `_transport` are the test seams), content check (PNG, JPEG, WebP, up to 1 MB), set/clear with a fresh random key per upload
│   │   ├── support.py          # Problem reports: image limits and content sniffing, diagnostics scrubbing, per-user rate limit (5 an hour, in memory), the Resend HTTP call (`_transport` is where tests stub the provider)
│   │   ├── player_alerts.py    # Player and score alerts (#391), all through `notifications.notify`, called by the scheduler tick: `send_starter_out_alerts` (a starter Out / Doubtful / on IR before his game starts, one push per team and round, every tick), `send_score_alerts` (touchdowns of starters in the games just polled, collapsed per team and game, at most one push per 3 minutes), `send_round_alerts` (after a standings recompute: "Your last player's team lost" when a team's `players_left` reaches 0, and the round summary with rank change and points when the latest round is final). The `alerts_sent` table (`key` per event) makes each event one push across ticks and restarts
│   │   ├── lineup_reminders.py # Inbox entry and push an hour before a round's first kickoff to owners with a fillable empty starter slot, once per team and round; runs inside the scheduler tick
│   │   ├── draft_reminders.py  # Inbox entry and push ~15 minutes before a draft's scheduled time (the start stays manual); runs inside the scheduler tick
│   │   ├── account_deletion.py # Delete my account (#330): Supabase Auth user (admin API, `_transport` is the test seam), push subscriptions, notifications, picture; the users row becomes "Former member" without email, memberships left, open-season teams freed, chat and feed names overwritten; refuses while the member is a league's only commissioner
│   │   ├── draft_events.py     # PICK_MADE / DRAFT_STATE broadcast payloads
│   │   ├── live_leagues.py     # Soft-deleted leagues: live_league_ids/live_season_ids filter every league query, delete_league, restore_league, LeagueDeletedError
│   │   ├── invites.py          # Invite codes and joining
│   │   ├── league_members.py   # Role changes with the never-zero-commissioners rule
│   │   ├── league_admin.py     # Team resizing and post-draft locks
│   │   ├── team_units.py       # Team QB / team K rules: conflicts, scoring members, pool exclusions
│   │   ├── team_starters.py    # The one QB / K per playoff NFL team (depth chart, stats fallback)
│   │   ├── lineups.py          # Per-round lineup: slot layout, legal moves, kickoff locks; each lineup player carries counted points (round multiplier applied), `statLine`, `gameState`, `gameClock`, `eliminatedRound`
│   │   ├── stat_lines.py       # One-line game stats per position ("14/21, 168 yds, 2 TD, 0 INT")
│   │   ├── round_status.py     # Per-round alive/eliminated/bye and kickoffs, derived from game results
│   │   ├── draft_picks.py      # Server-side pick validation (turn, availability, roster limits), reserved picks (`reservations`, `validate_candidate`, `settle_reservations` record a reserved slot when it comes up)
│   │   ├── scheduler.py        # Opt-in background sync/live-poll/elimination loop
│   │   └── ingestion/          # Async batch upsert services
│   │       ├── schemas.py      # Upstream DTOs & parsing helpers
│   │       ├── depth_chart_ingest.py # QB1 / PK1 depth chart starters (team QB / K pool)
│   │       ├── teams_ingest.py # Multi-row NFL team upserts (+ one synthetic DST player per team)
│   │       ├── dst_stats.py # Per-team DST stat rows from a box score (synthetic DST players, id = -teamID)
│   │       ├── guard.py    # Per-type advisory lock (skip overlapping runs) + last-synced record
│   │       ├── players_ingest.py # Chunked active player upserts
│   │       ├── season_stats_ingest.py # Chunked regular season stat upserts
│   │       └── box_scores_ingest.py # Playoff games & player box score upserts
│   ├── utils/
│   │   ├── calculations/       # Deterministic scoring & elimination logic
│   │   │   ├── fantasy_points_utils.py # Stat-to-points evaluator
│   │   │   └── standings_utils.py     # Round index/multiplier & player survival queries
│   │   ├── rapidapi/
│   │       └── rapidapi.py     # Resilient httpx client for NFL data
│   │   └── text.py             # `clean_text` and the `CleanLine` / `CleanNote` field types: NFC, control characters dropped, trimmed (one line collapses whitespace) before length checks; used by league, team and display names and notes
│   ├── ws/                     # Real-time WebSocket layer (join after AUTH via ws/auth.py; inbound events whitelisted in routers/drafts.py)
│   │   ├── feed_manager.py     # Second DraftConnectionManager for the Feed socket + announce_feed_change (own relay channel feed_events)
│   │   ├── draft_manager.py    # DraftConnectionManager (state, pick broadcasts)
│   │   └── broadcast_relay.py  # Opt-in (DRAFT_BROADCAST=postgres) LISTEN/NOTIFY fan-out across API instances
│   ├── tests/                  # Pytest backend test suite
│   │   ├── conftest.py         # Test fixtures & dependency overrides
│   │   ├── test_scoring.py     # Unit tests for scoring evaluator
│   │   ├── test_golden_2025.py # Replays 2025 box scores against the commissioner's sheet (fixtures/golden_2025)
│   │   ├── test_awards_golden_2025.py # Season awards over those box scores with fixed teams, lineups and picks (fixtures/golden_2025/awards_league.json)
│   │   ├── golden_league.py   # The real 2025 league (league_2025.json from the workbook) replayed: standings, awards, `python -m api.tests.golden_league` writes docs/research/awards-2025-replay.md
│   │   ├── test_awards_real_league_2025.py # Standings and awards of that league against the sheet
│   │   └── test_api_integration.py # Integration tests for API endpoints
│   ├── main.py                 # FastAPI application factory, CORS, lifespan
│   ├── pyproject.toml          # uv backend project specification & tool settings
│   └── uv.lock                 # Deterministic backend dependency lockfile
└── frontend/                   # Frontend SPA (React + TypeScript + Vite)
    ├── functions/join/[code].ts # Cloudflare Pages Function: link-preview crawlers get index.html with the invite's league name and open spots in the Open Graph / Twitter tags (public invite preview only, no member names); browsers get the SPA. `public/_routes.json` limits it to /join/*; optional `API_ORIGIN` variable. Tested in src/joinPreview.test.ts
    ├── package.json            # Scripts & dependencies
    ├── tsconfig.json           # Strict TypeScript configuration
    ├── vite.config.ts          # Vite build configuration
    ├── biome.json              # Biome linter, formatter & import sorting config
    └── src/
        ├── App.tsx             # Routes, league list state, wires NavBar
        ├── routes.ts           # Path builders: `leaguePath`, `seasonPaths(leagueId, year, current)` (clean paths for the current season, `/seasons/<year>` otherwise; home, draft, settings, players, feed, more, team)
        ├── theme.ts            # `palettes` (dark, light), `tokens` (CSS variables `--ps-*`; components use these, never hex), `createAppTheme(mode)`, `tint`
        ├── main.tsx            # Vite DOM mount point (a data router, `createBrowserRouter`, so `useBlocker` works); calls `registerServiceWorker()` once at startup
        ├── content/
        │   └── rules.ts        # Every plain-language rule string: How to play, pre-draft roster, lock note, setting tooltips, notes copy
        ├── contexts/
        │   ├── SeasonContext.tsx # The route's season (`useSeasonContext`: ids, year, `season` with `canEdit` / `canCommission`, `paths`), provided by SeasonLayout
        │   ├── ThemeModeContext.tsx # `ThemeModeProvider` / `useThemeMode`: Dark or Light, remembered per device (`utils/themeMode.ts`; the inline script in index.html applies it before first paint)
        │   └── UserContext.tsx # Authentication & current user context (`updateDisplayName` changes the Supabase name and the backend username together)
        ├── api/
        │   ├── failedRequests.ts # Ring buffer of the last 10 failed API calls (method, scrubbed path, status, `X-Request-ID`; never bodies), fed by an axios response interceptor in client.ts; read by the support diagnostics
        │   ├── queries.ts      # React Query hooks for every endpoint (`useDeleteLeague` leaves for `/` before refreshing the league list)
        │   └── leagueDeleted.ts # Reads the `leagueDeleted` 404; QueryBoundary renders LeagueDeletedNotice for it, and the query/mutation caches (main.tsx) plus the draft socket's 1008 close refetch `league-seasons` so the season layout shows that page from any guarded call
        ├── hooks/
        │   ├── usePushNotifications.ts # Push state machine (unsupported / needs-install / denied / off / on); permission asked only from `enable()`, which must be called from a tap
        │   ├── useWebSocket.ts # Native RFC 6455 WebSocket hook
        │   ├── useFeedLive.ts  # Feed socket: each content-free `FEED_CHANGED` refetches the feed; the page polls every 30s while it is down
        │   └── useWebSocket.test.ts # Hook test suite
        ├── pages/
        │   ├── LandingPage.tsx # Root route: signed out = hero with Sign in and How to play plus the privacy/terms footer; signed in = `YourLeagues` (no redirect, so the logo always reaches it; `dormant` swaps the hero for the off-season notice)
        │   ├── DormantPage.tsx # Dormant-mode notice (owner-declared with the `VITE_DORMANT=true` build variable, never inferred from a failed API call) and fallback for every route except landing, How to play, privacy, terms
        │   ├── CreateLeaguePage.tsx # Short path (name + team count stepper, default rules, Team QB/K off) and an optional "Customize rules" Roster, Scoring, Review wizard
        │   ├── JoinPage.tsx    # `/join/:code` invite preview (members, open slots), Sign in to join / Join league, a Take the tour button (works signed out), full-league state and the 409 `league_full` answer
        │   ├── DraftPage.tsx   # The Draft tab: sticky clock bar, commissioner strip, a cog for draft settings (`DraftSettingsSheet`), Players / Board / Roster / Queue views (all on screen from `lg` up); once the draft is complete just the league player list
        │   ├── DraftBoardPage.tsx # `/draft/board`: the board on its own, linked from More at any time
        │   ├── HowToPlayPage.tsx # The first-run tour inline (`TourViewer`) above the plain-language rules, all copy from src/content/rules.ts
        │   ├── SeasonLayout.tsx # `/leagues/:leagueId` (the current season) and `/leagues/:leagueId/seasons/:year` resolve to a season and provide SeasonContext to the pages below; the long form of the current season redirects (`replace`) to the clean one
        │   ├── FeedPage.tsx    # Feed tab: events and chat oldest-to-newest with the message box pinned above the tab bar, date rows, a "New" divider fixed when the page opens, read-only note in an archived season
        │   ├── MorePage.tsx    # More tab (no Settings entry, #315): Draft room and players (the Draft tab, with the draft status line; "Players" once the draft is complete), Draft board, Past seasons (sheet, only if any), Invite members (sheet, commissioners), How to play, Take the tour (full-screen `TourDialog`), Report a problem (sheet), Sign out
        │   ├── LeaguePage.tsx  # A season's home: phase block (invite, draft countdown, set your lineup, round progress) or the champion and awards, standings in every phase, collapsible notes, empty-state notices
        │   ├── SettingsPage.tsx# League settings, opened from the cog on the League tab: the same rows for every member, editable only by commissioners (rows that open sheets, rules as accordions; members read the forms locked and the members list without switches)
        │   ├── TeamPage.tsx    # Any team: header with the team-settings cog (rank, total), a hurt-starter banner with Go to bench (`hurtStarters` in `lineupView.ts`), round strip, Starters / Bench / Eliminated for the chosen round, player sheet
        │   └── NotFoundPage.tsx# 404 handler
        ├── components/
        │   ├── home/           # YourLeagues (league cards, Create, invite code, How to play), LeagueCard, leagueSummary (phase tag, rank), PastLeagues, InviteCodeForm, LegalFooter (privacy and terms)
        │   ├── invite/         # InviteMembers (members plus open slots), `inviteView` (sign-in / join / full / unavailable)
        │   ├── tour/           # TourViewer (swipe or Next/Back through the captured screens, a progress bar), TourDialog (full screen on phones, Skip always there), FirstRunTour (opens once per account on this device right after joining or creating a league; `utils/tourSeen.ts`; the notification prompt waits for it)
        │   ├── notifications/  # NotificationOptIn: the one-time push prompt after first sign-in and joining a league (bottom sheet / dialog), mounted once in App; InboxSheet (the bell's list: unread marked, tap marks read and opens the page, Mark all as read) and `inboxView.ts` (each kind's wording and link, the same page its push opens)
        │   ├── activity/       # ActivityFeed (collapsed, new dot), SlotMarker (override / asterisk), ChangedScore tooltip, describeEvent
        │   ├── feed/           # Feed pieces: `feedView.ts` (timeline rows, "New" divider, event wording), FeedEventRow, MessageRow, Composer (Enter sends with a mouse only), GifPicker, DeleteMessageDialog
        │   ├── layout/         # AppShell (header + bottom tabs on phones / left rail from md up), NavBar (header: logo, switcher, `InboxBell` (unread count, opens `InboxSheet`), the avatar that opens `ProfileSheet`), Brand, LeagueSwitcher, BottomTabBar, LeagueRail, leagueTabs (League, Team, Draft (labelled Players once the draft is complete), Feed, More)
        │   ├── draft/          # DraftClockBar + clockText (the sticky bar), CommissionerStrip (randomize, edit order, change date, start, pause/resume/undo/force pick), DraftOrderEditor + orderMoves (up/down, saved as one order change), DraftSetupDialogs (date with time zone, validated seconds per pick, type, timeout), ConfirmDraftAction + `preflight.ts` (the confirmations for Start, Undo and Auto-pick now), AssignPickDialog (tap a board slot, choose a player, confirm), DraftBoard (compact cells: last name, position, NFL team, pick number; tap a cell for the full pick in a sheet, which carries the commissioner's "Assign pick" button in a live draft; reserved cells), RosterView + rosterSlots (my picks in the league's slots), QueuePanel, PreDraftNotice
        │   ├── league/         # PhaseBlock (top block by phase), Standings (phone rows that expand in place, desktop round columns, pre-draft team slots), RankCell (tie tooltip), LeagueNotes (collapsible card), InviteLinkButton (copy and share the invite link), phase.ts / countdown.ts / standingsView.ts helpers, ArchivedBanner (tops every page of a finished season from SeasonLayout), LiveIndicator ("Live, updated 20s ago" in the playoff phase block while a game is live; `useStandings` polls only then, otherwise on focus), ArchivedNotice (shown where a finished season hides write controls; write controls follow the season's `canEdit` / `canCommission` from `useSeasonContext`), LeagueDeletedNotice (the "deleted by a commissioner" page)
        │   ├── players/        # PlayersView (the league player list: search, position / NFL team / fantasy team filters, sort, owner chip; with a `draft` prop it adds Draft and queue buttons and All / Available / Drafted), FilterMenu, playerRows.ts (pool + season stats rows, stat line, filters, sorts)
        │   ├── recap/          # SeasonRecap: champion card, Playoff MVP and champion's MVP, awards by position, start the next season (gated by `canStartSeason`)
        │   ├── team/           # RoundStrip, LineupRound (Starters / Bench / Eliminated groups), PlayerRow, PlayerSheet (bottom sheet: round line, season stats, tap-only moves; reusable from the Players list and draft room with a lineup), `moves.ts` (swap-aware move options), `lineupView.ts` (row states, subtotals), `seasonLines.ts`, OverrideDialog (commissioner confirm)
        │   ├── avatar/         # AvatarSheet (choose, drag and zoom inside a circle, save a 512 px JPEG; remove) and `crop.ts` (crop math, 5 MB source limit)
        │   ├── support/        # ReportProblemSheet (More, Report a problem: message, images, diagnostics preview) and `images.ts` (5 images, 5 MB each, 15 MB total, the API's wording)
        │   └── settings/       # ProfileSheet (profile settings from the avatar: display name, email, theme, notifications, sign out), TeamSettingsSheet (team name, owner; opened from the Team page cog), CogButton (a cog that links or opens a sheet), NotificationsToggle (the push switch in the profile sheet with a switch per kind and Quiet hours, which sends the browser's time zone, and the iPhone and Android tips); SettingsCard/SettingsRow (row primitives), SettingsSheet (bottom sheet on phones, dialog on desktop), EditTextSheet (one-field edits), MembersSheet + members.ts (commissioner toggle per member; the only commissioner's toggle is locked; removal confirms; `readOnly` for members), InviteSheet, NotificationsRow (placeholder until push ships), SettingsGroup (accordion row), SettingsSection/ScoringForm/RosterForm generated from src/settings schemas; DeleteLeagueDialog (three-step confirm: warning with season count, type the exact name, final "Are you sure?")
        ├── utils/
        │   ├── avatarUrl.ts    # `avatarSrc` (adds the API origin to a picture path) and `initialsOf`
        │   ├── draftCue.ts     # Web Audio on-deck beep
        │   ├── numberField.ts  # `numberProblem(s)`: per-field validation (blank, half-typed, out of range) shared by the settings and create forms; never coerce a bad value to 0
        │   ├── scoring.ts      # Numeric coercion + defaults diff for league forms
        │   ├── gifProvider.ts  # `GifProvider` interface plus the GIPHY adapter; `gifProvider()` is null without `VITE_GIPHY_API_KEY`, which hides the GIF button
        │   ├── logger.ts       # Leveled client logger (debug/info dev-only on the console) plus a 50-entry ring buffer of scrubbed messages, `recentLogEntries()`
        │   ├── diagnostics.ts  # `collectDiagnostics`: the optional, scrubbed diagnostic info for a problem report (versions, route, ids, device, time, logs, failed requests, latest Sentry event id)
        │   ├── shareInvite.ts  # `canShareInvite` / `shareInvite`: the native share sheet for the invite link (Copy stays the fallback)
        │   ├── pageTitle.ts    # `pageTitle(pathname, leagueName)`: per-route `document.title` ("Standings · League · PostSzn Fantasy"), set from App
        │   ├── maskEmail.ts    # `p**@x.co`: the address shown on the sign-in code step
        │   ├── inAppBrowser.ts # `isInAppBrowser`: Instagram / Facebook / Android web views, where the sign-in page swaps Google (refused there) for a note and the emailed code
        │   ├── pushSetup.ts    # `registerServiceWorker()` (call once at startup) and browser feature detection
        │   ├── notificationPrompt.ts # When the opt-in may show: at most two prompts per device ever (second only after Not now, on another day), fails closed without localStorage; routes where it never shows
        │   └── supabase.ts     # Supabase auth-only client (@supabase/auth-js), storage key "postszn-auth"
        └── test/               # Vitest environment setup
```

---

## 3. Core Development Commands

Everything is driven from the repository root through the `Makefile` (`make help` lists targets). CI runs the same `check-api` / `check-web` targets, so local and CI cannot drift.

```bash
make setup      # uv sync + npm install + create missing .env files
make db-up      # Postgres via Docker Compose        (make db-down / make db-reset)
make migrate    # alembic upgrade head               (make migration m="message" to autogenerate)
make api        # uvicorn api.main:app --reload on :8000
make web        # Vite dev server on :5173 (proxies /api)
make dev        # database + migrations + API + web
make seed       # NFL data seeder (SEED_ARGS="--season 2026 --with-box-scores"; --no-stats skips season stats)

make lint       # Ruff check + format check, Biome
make typecheck  # Mypy (strict) and tsc
make test       # pytest (incl. the Postgres tier, see below) and Vitest
make check      # all of the above plus the production build
make format     # auto-fix Ruff and Biome
```

`api/` is a Python package imported as `api.main` from the repo root; it has its own `pyproject.toml` and `uv.lock` (there is no root `pyproject.toml`). Tests under `api/tests/postgres/` need a throwaway database via `TEST_DATABASE_URL` and skip without one.

---

### End-to-end tests (`e2e/`)

`make e2e-install` (once), then `make e2e` (needs `make db-up`; `E2E_ARGS="--project=mobile -g draft"` filters). Playwright starts its own API (:8100) and Vite (:5273) against a throwaway `postszn_e2e` database that `python -m api.scripts.seed_e2e` rebuilds from the committed fixtures in `e2e/fixtures/` (regenerate with `python3 e2e/fixtures/build_fixtures.py`). Tests sign in through the **test-auth stub**: `Bearer e2e-user:<uid>` is accepted only when `TEST_AUTH_STUB=true` *and* `ENVIRONMENT` is `development` or `test` (Settings refuses to start otherwise; proven in `api/tests/test_test_auth_stub.py`). Never set it outside local/CI runs. The main project also lists `e2e-admin` in `ADMIN_SUPABASE_UIDS`/`VITE_ADMIN_SUPABASE_UIDS` so tests can exercise the admin-only "Refresh now" button.

**Writing stable e2e specs** (full list in [CONTRIBUTING.md](CONTRIBUTING.md#writing-stable-e2e-specs)): `retries` stay 0. When you change UI, grep `e2e/` for the selectors you affected and run those specs before opening a PR. Select by role and exact name (`exact: true`; unique test data can collide with UI strings), wait for loaded state before acting, finish `page.route` specs with `unrouteAll({ behavior: "wait" })`, and never race a timer: the e2e build (`VITE_E2E`, `frontend/src/utils/e2e.ts`) makes MUI transitions instant and freezes the draft confirm window and the refresh toast, so gate any new timer-driven UI on `E2E_BUILD`. `scripts/lint-e2e.sh` (`make lint-e2e`, in CI) fails on `waitForTimeout`, `networkidle`, `page.pause`, `test.only` and `.first()` / `.last()` / `.nth()` without a justifying `//` comment. `make e2e-stress` repeats the suite (`E2E_STRESS_REPEAT=5`); `.github/workflows/e2e-stress.yml` runs it nightly.

The e2e project also starts `e2e/support/resend-stub.mjs` (:8102), a stand-in for Resend that specs read with `GET /sent` and make fail with `PUT /mode`; `RESEND_API_KEY`, `SUPPORT_EMAIL` and `RESEND_API_URL` are set only for that API.

**The first-run tour** (`frontend/src/components/tour`, copy in `TOUR_STEPS` of `content/rules.ts`, screens in `frontend/public/tour/<step id>.jpg`) is built from real screenshots, never drawn by hand. `make tour` (needs `make db-up`, `make e2e-install`; about 6 minutes) drives the seeded e2e stack through `e2e/tour/run.mjs` and `e2e/tour/capture.spec.ts` (one run: `e2e/tour/build_fixtures.py` turns the 2025 golden fixtures, all 14 real box scores and the six managers' real rosters, into a seed and a replay file; the capture drafts the real picks, sets the real lineups and replays the postseason through the live poll) and rewrites the images and `public/tour/manifest.json`. `make tour-check` (in `make check-web`, so in CI) hashes the source listed in `frontend/tour-sources.json` and fails when a captured screen changed since the last capture. **A PR that touches the League, Team, Draft, Feed, layout, theme or recap screens must run `make tour` and commit the new images**; a tour that shows a design the app no longer has is a bug. Adding or renaming a step means a new capture in `capture.spec.ts` and a new id in `TOUR_STEPS`.

`e2e/live/` is the replay suite (`playwright.live.config.ts`, run by `make e2e` after the main suite): it starts its own API on :8101 with the scheduler in replay mode (`e2e/fixtures/replay.json`, 2000x) against `postszn_e2e_live`, and asserts eliminations land as each replayed game finishes.

## 3b. Route Map (Phase 20)

SPA routes: the league's current season (`current: true` on its entry of `GET /api/leagues/{id}/seasons`, the latest season, even for a former member who may open only older ones) has no year in its addresses: `/leagues/:leagueId` (index = standings and recap), `/draft`, `/draft/board`, `/feed`, `/more`, `/settings`, `/teams/:teamId`. Navigation inside a league is five destinations (League, Team = your own team, Draft, Feed with the new-activity dot, More): bottom tabs on phones, a left rail from `md` up, no drawer; the logo always opens `/`, and outside a league there is no tab bar and the logo is the wordmark. Any other season lives under `/leagues/:leagueId/seasons/:year` with the same pages (index = standings and recap, `draft`, `draft/board`, `settings`, `teams/:teamId`). `SeasonLayout` resolves the year through `GET /api/leagues/{id}/seasons`, loads `GET /api/seasons/{id}` and provides it as `SeasonContext`; the pages read `canEdit` / `canCommission` / `isFormerMember` from it instead of looking at the league list. There is no global `/players` page: the league player list is the Draft tab (`draft`), scored by that season's settings. `/seasons/<current year>/...` still works and redirects with `replace`; starting the next season moves the clean addresses to it and last year's pages to `/seasons/<last year>/...`. Build links with `routes.ts`, never by string (`src/routes.test.ts` fails on a hand-built season link).

| Area | Endpoints |
| :--- | :--- |
| Config | `GET /api/config` (season) |
| Account | `DELETE /api/auth/me` (body `{confirm: "DELETE"}` required, else 422; 204; deletes the caller's account, see services/account_deletion.py; 409 `detail` names the leagues that need another commissioner first; 502 when Supabase fails, nothing changes; 503 without `SUPABASE_SERVICE_ROLE_KEY`). In the app: profile sheet, Danger zone, Delete my account, where the member must type DELETE. Owner fallback: docs/owner/account-deletion.md |
| Leagues | `POST /api/leagues/create-league` (creates the league and its first season for the configured year; 201 `{leagueId, seasonId}`; 409 once that season's Super Bowl is final), `GET /api/leagues/user-leagues` (each league with its latest season: `id`, `seasonId`, `season` (year), `finished`, `draftStatus`, `userTeamId`, `hasNewActivity`, and `seasons[]` of every season), `GET /api/leagues/past-leagues` (leagues the caller left, each with the finished seasons they owned a team in), `GET /api/leagues/{id}/seasons` (the seasons the caller may open: all for a member, only those finished seasons after leaving; 403 for a stranger; each has `id`, `year`, `finished`, `draftStatus`, `myTeamId`), `GET/PATCH /api/leagues/{id}` (overview: `notes`, members, `seasons[]`, `currentSeasonId`, `canStartSeason`, `nextYear`; PATCH: `name` and `notes`, free text up to 5000 characters shown to every member, commissioner-only edit), `DELETE /api/leagues/{id}` (any commissioner; body `{leagueName}` must equal the league name, else 422; 409 while a draft in any season is in progress or paused; 204. Soft delete: sets `deleted_at`/`deleted_by`, revokes the invite, keeps every row. Every route behind the member guards then answers 404 `{detail, code: "leagueDeleted", leagueName, deletedAt}` to current and former members and the same 403 a live league gives strangers to others (no league-id probing). All league queries go through `services/live_leagues.py`; `tests/test_live_league_filter.py` fails on a direct read. The owner restores with `python -m api.scripts.restore_league <id>`, see docs/owner/league-restore.md), `PATCH/DELETE /api/leagues/{id}/members/{userId}` (DELETE sets `left_at`, it never deletes the row. Any active member may DELETE their own id to leave: 204, same last-commissioner rule, they may rejoin through a valid invite. Removing someone else is commissioner-only (403 otherwise), answers the league overview and revokes the league's invite in the same transaction so the removed person cannot rejoin with the old link; the SPA's members sheet then says so with a one-tap Regenerate. Settings has a Leave league row for every member), `POST /api/leagues/{id}/seasons` (commissioner starts next year's season once the latest is finished and December 1 of its Super Bowl's calendar year has come; 201 `{leagueId, seasonId}`; 409 if the season is not over, that date has not come or the next one already exists; `canStartSeason` in the overview folds in the same date; today's date is the injectable `dependencies/clock.py` `Today`). A league is never read-only. |
| Seasons | `GET /api/seasons/{id}` (overview: teams, members, draft status, `finished`, `canEdit`, `canCommission`), `PATCH /api/seasons/{id}` (`numberTeams`, locks at draft start), `GET/PATCH /api/seasons/{id}/settings` (roster/scoring/postseason; roster shape locks once the draft starts; every field is bounded: slot counts 0 to 20, `roster_total` 1 to 40 and equal to starters + bench (a PATCH that changes slots without it gets it recomputed), at least one starter, `roster_max_x` >= `roster_num_x`, scoring within ±100, no NaN/Infinity, else 422; the same rules as `RosterSettingsInput` on create-league and as CHECK constraints on `season_settings`), `GET /api/seasons/{id}/teams`, `GET /api/seasons/{id}/standings` (`{round, gamesInProgress, gamesFinal, playersLeft, teams[]}`; each team has `rank`, round points, `tieReason`, `progress`; ranked by the tiebreaker chain, ties for the title share a rank), `PUT /api/seasons/{id}/teams/{teamId}/owner` (commissioner assigns/unassigns a team; joining assigns one automatically, this is for reassigning). A former member may read these for a finished season they owned a team in; every write to a finished season answers 409 "read-only archive". |
| Recap | `GET /api/seasons/{id}/recap` (`{seasonId, leagueId, year, finished, champions[], standings, nextSeasonId, awards[]}`; no champion or awards until the Super Bowl is final; awards computed on read; the per-position draft awards `best_value_<pos>` / `bust_<pos>` carry `draftedAs`, `finishedAs`, `points`, with `value` = places gained and `pickNumber` = the overall pick he was taken at) |
| Invites | `GET/POST/DELETE /api/leagues/{id}/invite` (commissioner; a new invite lasts until the first Wild Card kickoff, at least 7 and at most 60 days, unless the body sets `expiresAt`), `GET /api/invites/{code}` (public preview, no login: `{code, leagueName, season, openSpots, full, members[{displayName, isCommissioner}], joinable, reason}`; member names only, never emails), `POST /api/invites/{code}/join` (idempotent and serialized: joins lock the invite row and a per-user advisory lock, and `uses` is bumped by an atomic conditional update so `max_uses` holds under simultaneous joins; claims the lowest-numbered open team of the current season in the same transaction as the membership, and a former member rejoins onto a free team without ever holding two; a league with no open team answers 409 `{detail: "This league is full", code: "league_full"}` until a commissioner raises `numberTeams`) |
| Teams | `GET /api/teams/{id}/breakdown` (each round's counted points per starter slot and the bench's points, computed on read; round scores equal the standings; each starter slot's `mark` and each player's `scoreChange`, restated in counted points after the round multiplier), `GET/PATCH /api/teams/{id}` (PATCH renames: the name is cleaned, 422 when blank, 409 when another team of the season has it, case-insensitive; the GET carries all four rounds' lineups: slots, unassigned and eliminated players, lock times, empty-starter count), `POST /api/teams/{id}/lineup` (`{round, playerId, slotIndex, confirmOverride?}`; `slotIndex: null` takes a player out; moves lock the team row so concurrent moves run one after another, and standings are recomputed only when the moved round has a live or final game or stats; undoing a pick also clears that player's lineup slots; 409 when any player involved is locked or eliminated; the owner or a commissioner. A commissioner moving a locked player gets 409 `{detail, code: "override_confirmation_required"}` until the request repeats with `confirmOverride: true`; there is no add/drop in v1) |
| Activity | `GET /api/seasons/{id}/activity`, `GET /api/teams/{id}/activity` (`?limit=&before=` keyset pages, newest first, members only; each event has `isNew`, the feed has `hasNew`), `POST .../activity/viewed` (`{upToEventId?}`, 204). The season feed is every event of the season; a team's feed is the events with its `team_id` (settings changes have none). `GET /api/leagues/user-leagues` carries `hasNewActivity` for the nav dot, which (like the season feed's `hasNew`) counts only overrides, stat corrections, settings changes and membership joins, leaves and role changes; the team feed counts every event. Events: `lineup_move`, `commissioner_override`, `stat_correction`, `settings_change`, and league-level `league_created`, `membership_joined`, `membership_left`, `role_changed` (written in the same transaction by the create route, `services/invites.py` and `services/league_members.py` through `activity.append_to_league`, posted to the league's current season feed; migration 0016 backfills them for existing leagues; the last three also light the nav dot and ignore the "before they joined" rule); the lineup slot `mark` (override or commissioner-set) is derived from them, and lineup players carry `points`, `statLine`, `gameState` (`scheduled` / `live` / `final`), `gameClock`, `eliminatedRound` and `scoreChange`. Epic 21 Feed: `draft_order_randomized` (`order[{position, teamId, teamName}]`), `draft_order_changed` (`moves[{teamId, teamName, fromPosition, toPosition}]`, positions from 1, none when nothing moved), `draft_started` (`teamCount`, `rounds`), `draft_pick_assigned` (`pickNumber`, `teamName`, `playerId`, `playerName`, `scheduled`, `replacedPlayerName`; a commissioner placed a player by hand) and `draft_completed` (`picks`, no actor, written by `record_pick`) are league-level, written in the same transaction as the action, and light the dot. **Feed**: `GET /api/seasons/{id}/feed?limit=&before=` (`{items, nextBefore, hasNew, canPost}`; events and chat merged newest first, `before` is the opaque `nextBefore` string, bad one 422; items are `type: "event"` (the event fields) or `type: "message"` (`id, createdAt, authorUserId, authorName, body, gifUrl, canDelete, isNew`); `lineup_move` events are stored but never listed, so they cannot light the dot), `POST /api/seasons/{id}/messages` (`{body (<= 2000), gifUrl?}`, 201 the message; body or GIF required, 422 otherwise; `gifUrl` must be https on `GIF_ALLOWED_HOSTS` or a subdomain, stored as given; 403 former member or stranger, 409 archived or non-current season), `DELETE /api/seasons/{id}/messages/{messageId}` (soft delete, 204; the author or any commissioner, else 403; 404 unknown; repeating is harmless), `POST /api/seasons/{id}/feed/viewed` (`{upToEventId?, upToMessageId?}`, 204; one marker covers events and messages, and the older league `activity/viewed` clears both too), `WS /api/seasons/{id}/feed/ws` (AUTH like the draft room; pushes `{eventType: "FEED_CHANGED", data: {itemType, id, deleted}}` on a new message, deletion, draft order change, start or completion, and the client refetches page 1; other events show on the next fetch; relayed over `feed_events` with `DRAFT_BROADCAST=postgres`). Messages count toward `hasNew` and `hasNewActivity` like the counted event types (not your own, not from before you joined, not deleted) |
| Push | `GET /api/push/vapid-key` (`{publicKey}`, null while unconfigured; no sign-in), `POST /api/push/subscriptions` (`{endpoint, keys:{p256dh, auth}}` as `PushSubscription.toJSON()`; 204; upserts by endpoint, so a device moves to whoever signed in last; 422 unless the endpoint is https on a known push service; 409 while unconfigured), `DELETE /api/push/subscriptions` (`{endpoint}`; 204; only the caller's own), `GET/PATCH /api/push/preferences` (`{draftAlerts, lineupReminders, chat, starterAlerts, scoreAlerts, roundResults, quietHours, timezone, mutedLeagueIds}`, defaults true/true/false/true/false/false/false/null; PATCH changes only the fields sent; `timezone` is an IANA name checked against zoneinfo (422 otherwise), sent by the SPA with `quietHours` and kept current while it is on; quiet hours are 11pm to 7am in that zone and hold back only the player-alert pushes (`push.QUIET_KINDS`: starter, score, round), never the inbox entry or the draft and lineup pushes; `users.push_*` columns, every `send_to_users` call names its kind and drops recipients who turned it off), `PUT /api/push/chat-mute/{leagueId}` (`{muted}`, 204; `league_members.chat_muted`; 404 unless an active member). Triggers: your draft pick is on the clock (`draft_events.announce_events`), a new chat message in your league (`POST /api/seasons/{id}/messages`; tag `chat-<season>` so a burst collapses, and the body says "N new messages" for a burst within 10 minutes; off by default and muteable per league), the draft lobby opens, the draft starts (`control/lobby`, `control/start`: every active member) and about 15 minutes before a scheduled draft time (`services/draft_reminders.py`, scheduler tick, once per draft and time, remembered in memory), lineup lock reminder 60 minutes before a round's first kickoff (scheduler tick, so needs `SCHEDULER_ENABLED`), a commissioner changing your lineup, and the player alerts of #391 (scheduler tick, `services/player_alerts.py`: `starter_out` for a starter ruled Out, Doubtful or on injured reserve before his game starts, `player_scored` for a starter's touchdown, `round_result` when a round is final, `team_eliminated` when a team's last player's team lost; the injury tag comes from the roster sync, so it can lag its report by `SCHEDULER_ROSTER_SYNC_HOURS`) (`POST /api/teams/{id}/lineup` on a team they do not own; `lineup` preference). Every trigger but chat goes through `services/notifications.notify`, so it also lands in the inbox, push on or not. The SPA deletes this device's subscription (server row and browser) on a deliberate sign-out, before the session ends, and re-posts it on every sign-in and app load so `last_seen` stays fresh; the scheduler's roster sync step prunes subscriptions not refreshed for 60 days (`push.prune_stale_subscriptions`). Inert without `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (all three or none). iPhone only receives push from the Home Screen app. The SPA must call `registerServiceWorker()` once at startup; `public/sw.js` handles `push` and `notificationclick` |
| Notifications | The inbox behind the header bell (#397). `GET /api/notifications` (`{items, unreadCount}`; the caller's entries of the last 30 days from live leagues they are still in, newest first, at most 100; each item `{id, kind, leagueId, leagueName, payload, createdAt, read}`, `payload` ids only (`seasonId`, `teamId`, `round`); a signed-in caller with no user row yet gets an empty inbox), `POST /api/notifications/read` (`{ids?}` (up to 200), omitted marks every entry; 204). Kinds: `draft_turn`, `draft_lobby`, `draft_started`, `draft_soon`, `lineup_lock`, `lineup_changed`, `starter_out`, `player_scored`, `round_result`, `team_eliminated`; the SPA words and links each in `components/notifications/inboxView.ts` (the same page the push opens; an unknown kind links to its league). Rows are written only by `services/notifications.notify`, pruned after 30 days by the scheduler's roster sync and deleted with the account |
| Support | `POST /api/support` (multipart: `message` required up to 5000 characters, `diagnostics` optional JSON text up to 100 KB, `images` up to 5; authenticated; 204. Emails `SUPPORT_EMAIL` through Resend (httpx) with reply-to the member's account email and the images attached; nothing is stored. Images are recognised by content (PNG, JPEG, GIF, WebP, HEIC), 5 MB each and 15 MB together, else 413/422 with a readable `detail`; 5 reports an hour per user, else 429 with `Retry-After`; 503 while `RESEND_API_KEY` or `SUPPORT_EMAIL` is unset; 502 when Resend fails. Diagnostics are scrubbed again server-side (credential keys dropped, tokens and addresses masked). Owner steps: docs/owner/19-support-email.md) |
| Avatars | `avatarUrl` (a path like `/api/avatars/<32 hex>`, null = initials, or the bracket tile for a league) rides on the login response (own), league list and overview, members, teams, `teamAvatarUrl` on standings and draft slots. `PUT /api/avatars/me`, `PUT /api/leagues/{id}/avatar` (commissioner), `PUT /api/teams/{id}/avatar` (owner or commissioner; 409 in a finished season): the raw image bytes as the body (`Content-Type` image), PNG, JPEG or WebP by content, 1 MB (the browser sends a cropped 512 px JPEG), else 413/422; the server decodes it with Pillow and stores a fresh WebP of at most 512 px with no metadata (#341; a file that does not decode is 422, over 25 megapixels 422); 200 `{avatarUrl}`; `DELETE` the same paths, 204. 503 while `SUPABASE_SERVICE_ROLE_KEY` (or `AVATAR_LOCAL_DIR`) is unset. Each upload gets a new random key, so `GET /api/avatars/{key}` (public, the key is the capability) is cached privately for a day (`Cache-Control: private`, so no CDN keeps a removed picture) and the old object is deleted; the scheduler's roster sync and `python -m api.scripts.prune_avatars` delete stored objects older than a day that no row points at. Owner step: docs/owner/20-avatars.md |
| Admin | `PUT /api/admin/playoff-field` (exactly 14 known NFL team ids, else 422; drafts need the field set; the owner uses `python -m api.scripts.set_playoff_field BUF KC ...`, same service), other ingest triggers Ingest triggers (`POST /api/admin/update/{all,nfl_teams,nfl_players,nfl_players_and_stats,box_scores}`) answer `{status: "started"}` and run in the background in their own session (progress in `ingestion_status` via `GET /api/players/sync-status`, failures in the logs); `?wait=true` runs inline and returns the result. `eliminate_teams` and `PUT /api/admin/games/{id}/result` reject unknown NFL team ids (422); a result also needs two different teams, scores 0 to 100, the game's own season, and `create: true` to enter a game id the schedule doesn't have (else 404). Every admin call logs one `Admin action` line (admin uid, method, path, short body) |
| Players | `GET /api/players/draft-pool` (draftable positions on playoff teams; `?seasonId=` applies that season's team QB / team K settings and flags `scoresWholeTeam`), `GET /api/players/player-list`, `GET /api/players/player-season-stats?season=&leagueId=&playerId=` (`playerId` returns just that player, any position, for the player sheet; `fantasyPoints` scored under that season's settings; draftable positions only unless `position` is given), `GET /api/players/sync-status` (last successful sync per ingestion type, plus `budgetExhausted` when the daily Tank01 cap has stopped polling); players carry `eliminated` (their NFL team is out) and `injuryStatus` (`Out`, `Doubtful`, `Questionable`, `Injured Reserve` or null; roster and lineup players carry it too) |
| Draft | `GET /api/drafts/draft-info/{seasonId}`, `PATCH /api/drafts/{seasonId}` (setup; `timePerPickSeconds` 15 to 600), `PUT .../order` (`teamIds` may contain `null` for unfilled slots; starting requires a full order), `POST .../order/randomize`, `POST .../control/{lobby,start,pause,resume,undo}`, `POST .../force-pick`, `POST .../assign` (commissioner: `{pickNumber, playerId, replace}`; places a player at the pick on the clock, a later slot (stored in `drafts.reserved_picks` and recorded when the slot comes up) or, with `replace: true`, a pick already made; same rules as a normal pick, 409 with `code` `slot_filled` / `slot_open` / `player_reserved` / `position_capped`; posts `draft_pick_assigned`), `DELETE .../assign/{pickNumber}` (clears a reservation), `POST .../picks`, `GET/PUT .../queue`, `WS /api/drafts/ws/{seasonId}` |

Draft rules (Epic 16): the pool is players on `nfl_teams.in_playoffs` (set by ingesting postseason games, which adds only the 12 Wild Card teams, so the two bye teams need the admin endpoint or `api.scripts.set_playoff_field`); `start_draft` needs `Settings.playoff_field_size` (14; the e2e stack uses 8) teams in it, and scheduling or starting after the first Wild Card kickoff (`nfl_games.game_week` 19) is refused with 409. Tank01 `FB` is stored as `RB`. `record_pick` rejects non-pool players and positions at their cap (`position_capped`); auto-pick skips both. Roster slots, position caps and team count lock at draft start; scoring, multipliers and team QB/K stay editable and go through `settings_changes.on_editable_settings_changed`.

Team QB / team K (Epic 13): `team_qb` and `team_k` are required, default-less `season_settings` columns (`teamUnitSettings` on create-league). Turning one on is refused (409, conflicts listed) while a fantasy team holds two of that position from one NFL team. With a setting on, `team_units.scoring_members` makes a slot score every QB/K of his NFL team (standings and lineup points), and `team_units.unavailable_in_pool` keeps non-starters out of the pool, pick validation and auto-pick. Starters come from `nfl.depth_chart_starters` (synced with the roster pipeline) with a most-attempts/kicks fallback.

Authorization (`api/dependencies/league.py`): `LeagueMember` / `LeagueCommissioner` for `/api/leagues/{id}` routes (active members only; never read-only), `SeasonMember` / `SeasonCommissioner` for `/api/seasons/{id}` routes and `TeamMember`/`DraftMember` for team and draft routes (the membership is checked through the season; writes to a finished season answer 409; a former member passes only for GETs of a finished season where they own a team). A league always keeps at least one commissioner. A team with no owner (never claimed, or its owner left) is auto-picked within one clock tick (queue, then best available) instead of waiting out the pick timer; its roster stays with the team for a later joiner, and the board marks those picks "auto". Start draft asks the commissioner to confirm when teams have no owner. Draft states: `unscheduled -> scheduled -> lobby -> in_progress <-> paused -> completed`; only an explicit commissioner action starts a draft, and the pick deadline is persisted server-side (clients render countdowns from `currentPickDeadline` + `serverTime`).

## 4. Coding Conventions & Architectural Patterns

### Core Engineering Principles
- **KISS (Keep It Simple, Stupid)**: Favor minimal, straightforward implementations over clever abstractions, indirection, or over-engineered scaffolding.
- **Intent-Driven Comments (Explain WHY, Not WHAT)**: Minimize comments to only what is strictly necessary. Never restate what the code clearly does; document the non-obvious *why*, edge-case rationale, or external constraints.
- **Self-Documenting Code**: Choose expressive identifier and symbol names so the code explains itself without narrative commentary.
- **Continuous Documentation Maintenance Mandate**: Whenever modifying architecture, endpoints, database models, environment variables, or workflows, you **must update the relevant documentation** (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, or `.env.example`).

### Tooling & Standards
- **Backend Formatting & Linting**: Managed by **Ruff** in `pyproject.toml` (target line length: 88, rule selection: `E`, `F`, `I`, `B`, `UP`).
- **Backend Type Safety**: Checked via **Mypy** in strict mode (`disallow_untyped_defs = true`, `plugins = ["pydantic.mypy"]`).
- **Frontend Quality**: Managed by **Biome** (`biome.json`) for unified AST-based linting, whitespace formatting, and automatic import organization.

### Backend Patterns
- **Product rules**: [docs/product-rules.md](docs/product-rules.md) is the source of truth for how the game is played (per-round lineups, kickoff locks, team QB/K, scoring defaults, tiebreakers). Read it before changing lineup, scoring, standings or draft behaviour, and update it with the code. Work is tracked as Epics 11-18 in GitHub Issues.
- **RapidAPI ingestion**: Tank01 nests stats by category with string values; all mapping lives in `api/services/ingestion/schemas.py`. Read [docs/rapidapi-tank01.md](docs/rapidapi-tank01.md) before touching ingest; it lists which keys are confirmed against real box scores. `getNFLBoxScore` is always called with `playByPlay=true` because missed field-goal distances (`kicking_fg_yards_missed`, scored by `scoring_kicking_fg_miss_yard`) exist only in `allPlayByPlay`. Blocked kicks (`dst_blocked_punts`, `_field_goals`, `_extra_points`, summed for the one `scoring_dst_blocked_kick` setting) and defensive 2-point returns are stored and scoreable; settings default to 1 and 2 points. **Raw samples:** when you call Tank01 to answer a question, save the full raw response in `docs/research/samples/` (trim only huge lists and say so), add a row to `docs/research/samples/INDEX.md`, and read that index before spending a call. `api/tests/fixtures` is for tests; `docs/research/samples` is for reference.
- **CamelCase API Contract**: All API JSON responses are formatted in `camelCase` for TypeScript consumption, while internal Python uses `snake_case`. The base schema `api/models/base.py` enforces this using Pydantic's `alias_generator = to_camel` with `populate_by_name = True`.
- **ERD**: [docs/erd.md](docs/erd.md) is the entity-relationship diagram. Any change to `api/db/models/` or an Alembic migration (table, column, foreign key) must update it in the same PR; `api/tests/test_erd.py` fails when the diagram drifts from the models.
- **Dual Model Layer**: 
  - SQLAlchemy models (`api/db/models/`) represent relational database tables.
  - Pydantic models (`api/models/`) define external API payloads and schemas.
- **Route Authorization**: Protected routes inject `Depends(get_current_user)`, which extracts and verifies Supabase JWT Bearer tokens from the `Authorization` header.
- **Async Database Connection**: All database access uses SQLAlchemy 2.0 async sessions injected via `DbSession` (`Annotated[AsyncSession, Depends(get_db)]`).
- **Logging**: Use `logger = logging.getLogger(__name__)`, never `print()`. `setup_logging()` (called in lifespan and CLI scripts) emits JSON unless `ENVIRONMENT=development`; `RequestLoggingMiddleware` logs every request and sets `X-Request-ID`. Frontend uses `createLogger(scope)` from `utils/logger.ts`, not `console.*`.
- **Deploys**: a push to `main` runs `.github/workflows/deploy.yml` (gate `scripts/check-live-drafts.sh`, plan `scripts/deploy-plan.sh`, API via Fly, smoke check `scripts/wait-for-api.sh`, then the Cloudflare Pages deploy hook; every 15 minutes it also catches up). `GET /api` reports `version` (the build commit, `GIT_SHA`); the git tag `deployed` marks what last shipped. Never remove an endpoint in the PR that stops using it ([fly.md](docs/deploy/fly.md#how-a-deploy-works)).
- **CI runners**: jobs pick their runner from the repo variables `CI_RUNS_ON` / `CI_E2E_RUNS_ON` (unset = GitHub-hosted), so CI can move to the home Ubuntu machine from a phone ([self-hosted-runner.md](docs/deploy/self-hosted-runner.md)). Postgres service containers use a random host port, never 5432; read it from `job.services.postgres.ports['5432']`.
- **Off-season lifecycle**: [shutdown](docs/deploy/shutdown-runbook.md), [wake-up](docs/deploy/wake-up-runbook.md) and [rehearsal](docs/deploy/dormancy-rehearsal.md) runbooks; `scripts/dormancy-check.sh dormant|awake` is the read-only verifier (it reads `/status.json`, which the build emits from `VITE_DORMANT`). An API outage shows a "Reconnecting" banner (`useApiHealth`, rechecked on focus/online) over the current page, never the dormant page. Stop the Fly machine with `fly machine stop`, never `fly scale count 0`. Sign-in accounts (Supabase Auth, not in the backup) are protected by keeping the project active and, after a lost project, `python -m api.scripts.recreate_auth_users` ([backup.md](docs/deploy/backup.md#recreating-sign-in-accounts), `make rehearse-auth-restore`); never add password hashes to backups.
- **Avatars**: images live in a private Supabase Storage bucket (`AVATAR_BUCKET`, default `avatars`) that only the API reads, with `SUPABASE_SERVICE_ROLE_KEY`; the browser never talks to Storage. Tests install `avatars._store_override` or `avatars._transport`; the e2e API uses `AVATAR_LOCAL_DIR` (refused in production). Cropping happens in the browser (`components/avatar/crop.ts`).
- **Support email**: the More tab's "Report a problem" sends through Resend with its own key (`RESEND_API_KEY`, named `api-support`, separate from Supabase's sign-in key) to `SUPPORT_EMAIL`; inert until both are set. Tests never call Resend: unit tests install `httpx.MockTransport` on `api/services/support._transport`, and the e2e API points `RESEND_API_URL` (refused when `ENVIRONMENT=production`) at `e2e/support/resend-stub.mjs` on :8102. Resend's free plan is 100 emails a day, shared with sign-in codes, so keep the per-user limit low.
- **Error tracking**: Sentry is inert without `SENTRY_DSN` (API, `api/core/observability.py`) / `VITE_SENTRY_DSN` (SPA, `utils/sentry.ts`, lazy-loaded). `logger.error` forwards to it, so never put PII in error messages; `RapidApiClient` also sends one "Tank01 daily request budget spent" message per UTC day. Extend the scrubbers when adding new fields. See [docs/deploy/sentry.md](docs/deploy/sentry.md).
- **Abuse limits**: `api/core/rate_limit.py` and `api/core/body_limit.py` (see the core/ entries above). Sockets close with 1008 on a message over 4096 characters or more than 20 messages in 5 seconds (`ws/auth.py` `receive_guarded`; uvicorn also runs with `--ws-max-size 8192`). Limits are per process and forgotten on restart; Cloudflare's rule is the outer layer ([docs/owner/21-rate-limiting.md](docs/owner/21-rate-limiting.md)). Add a new limiter by constructing a `RateLimiter` and a dependency alias beside the others. The SPA shows the 429 `detail` through `friendlyError`.
- **Security hardening (#324)**: `api/core/security_headers.py` adds nosniff, `default-src 'none'` and CORP `same-site` to every API response (not `/docs` in dev); `docs_urls()` in `main.py` turns the docs off in production; `dependencies/auth.py` pins `ALLOWED_ALGORITHMS`; `ws/disconnect.py` `close_league_sockets` closes sockets on member removal and league deletion (this instance only with `DRAFT_BROADCAST=postgres`); the SPA's CSP is Report-Only in `frontend/public/_headers` (its inline-script hash must match `index.html`, checked by `src/csp.test.ts`).
- **Centralized Configuration**: All environment variables are strongly typed and accessed via `get_settings()` from `api/core/config.py`.

### Frontend Patterns
- **Mobile-first, always**: The app is used primarily on phones. Design every screen for ~375px width first, then scale up. Default to one vertical column; do not spread a single control across rows/columns of a grid; no horizontal scrolling (exception: the draft board grid for leagues of more than 6 teams, which scrolls both ways with pinned headers; 6 teams fit a 375px phone) or hover-only interactions; touch targets at least 44px; drag-and-drop must work by touch (delayed `TouchSensor` so scrolling still works).
- **Visual verification is part of every UI change**: After each UI step, launch the app (the `run` skill / built-in browser), use `resize_window` with the `mobile` preset (375x812) and look at the actual rendering, then check desktop. Fix anything clipped, overlapping, cramped or oddly laid out before reporting the work done. Reset the viewport to `desktop` afterward.
- **Environment Configuration**: Runtime variables use Vite conventions (`import.meta.env.VITE_*`).
  - `VITE_API_URL`: Backend HTTP origin; optional locally because the Vite dev server proxies `/api` to `http://localhost:8000`.
  - `VITE_WS_URL`: WebSocket origin; optional for the same reason (defaults to the page origin). Both are required in production builds (Cloudflare Pages build vars). Full contract: `api/.env.example`, `frontend/.env.example`.
  - `VITE_GIPHY_API_KEY`: optional public GIPHY key for the Feed's GIF button (unset hides it); the API still only stores GIF links from `GIF_ALLOWED_HOSTS`.
  - `VITE_SUPPORT_URL`: optional link for the More tab's "Support PostSzn" row (the owner's Buy Me a Coffee page, opened in a new tab with `rel="noopener noreferrer"`); unset hides the row, so nothing ships with a placeholder. Owner step: docs/owner/24-support-link.md.
  - `VITE_SUPABASE_URL`: Supabase project URL.
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase project publishable API key (`sb_publishable_...`, with fallback to legacy `VITE_SUPABASE_ANON_KEY`).
- **Component Styling**: Material-UI (MUI v9) styled components and `sx` prop.
- **State Flow**: Supabase handles auth credentials client-side; on session initialization or auth state change, the Supabase access token is sent to `/api/auth/login` (body: optional `username` only) to resolve/upsert the relational `User.id` into `UserContext`. The email is never taken from the body: `dependencies/auth.py` `TokenEmail` reads the verified JWT's `email` claim (lowercased; null for e2e stub tokens), login stores it, and support reports use it as `reply_to`. If another account already holds that address (same address on two Supabase identities) the new identity signs in with a null email and the conflict is logged. The SPA shows the server's `detail` for a 4xx on login and the "Couldn't reach the server" text only for network errors and 5xx.
