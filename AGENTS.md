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
├── docs/owner/                 # Owner launch guide: one page per step, in launch order
├── docs/ui/                    # Approved UI redesign decisions (#232) and the link to the final Claude Design canvas: navigation, pages, information placement
├── api/                        # Backend service (Python 3.13 + FastAPI)
│   ├── alembic/                # Database migrations
│   │   ├── versions/           # Migration revisions
│   │   └── env.py              # Alembic environment runner
│   ├── core/                   # Centralized application configuration
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
│   │   ├── push.py             # VAPID public key, subscribe / unsubscribe a device
│   │   └── players.py          # Player database & stats endpoints
│   ├── scripts/                # Database seeding & administrative CLI scripts
│   │   ├── generate_vapid_keys.py # Prints a VAPID key pair for web push (docs/owner/18-push-notifications.md)
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
│   │   ├── team_breakdown.py   # Round-by-round points page data
│   │   ├── draft_flow.py       # Draft state machine, order, pause/resume/undo, queue, auto-pick
│   │   ├── playoff_field.py    # Playoff field (draft pool), first Wild Card kickoff cutoff
│   │   ├── feed.py             # The Feed: events and chat merged newest first (one cursor), post/delete messages, GIF host allowlist
│   │   ├── activity.py         # Append-only activity feed: append, feed pages, per-member viewed markers, slot marks
│   │   ├── stat_corrections.py # Snapshots a final game's stats before ingest overwrites them; posts stat_correction events (team QB/K unit members' corrections post against the drafted player)
│   │   ├── settings_changes.py # record_settings_change (old/new diff to the feed) + the recompute hook; Epic 13 calls it too
│   │   ├── draft_clock.py      # 1s loop auto-picking expired server-side deadlines
│   │   ├── push.py             # Web push sender (pywebpush, best-effort, prunes 404/410 subscriptions) and the on-the-clock trigger; `notify_league_message` pushes a new chat message to the other active members (author and league name only, never the text; no per-member mute yet)
│   │   ├── lineup_reminders.py # Push an hour before a round's first kickoff to owners with a fillable empty starter slot, once per team and round; runs inside the scheduler tick
│   │   ├── draft_events.py     # PICK_MADE / DRAFT_STATE broadcast payloads
│   │   ├── live_leagues.py     # Soft-deleted leagues: live_league_ids/live_season_ids filter every league query, delete_league, restore_league, LeagueDeletedError
│   │   ├── invites.py          # Invite codes and joining
│   │   ├── league_members.py   # Role changes with the never-zero-commissioners rule
│   │   ├── league_admin.py     # Team resizing and post-draft locks
│   │   ├── team_units.py       # Team QB / team K rules: conflicts, scoring members, pool exclusions
│   │   ├── team_starters.py    # The one QB / K per playoff NFL team (depth chart, stats fallback)
│   │   ├── lineups.py          # Per-round lineup: slot layout, legal moves, kickoff locks
│   │   ├── round_status.py     # Per-round alive/eliminated/bye and kickoffs, derived from game results
│   │   ├── draft_picks.py      # Server-side pick validation (turn, availability, roster limits)
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
│   │   └── rapidapi/
│   │       └── rapidapi.py     # Resilient httpx client for NFL data
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
    ├── package.json            # Scripts & dependencies
    ├── tsconfig.json           # Strict TypeScript configuration
    ├── vite.config.ts          # Vite build configuration
    ├── biome.json              # Biome linter, formatter & import sorting config
    └── src/
        ├── App.tsx             # Routes, league list state, wires NavBar
        ├── routes.ts           # Path builders: `leaguePath`, `seasonPaths(leagueId, year, current)` (clean paths for the current season, `/seasons/<year>` otherwise; home, draft, settings, players, feed, more, team, teamPoints)
        ├── theme.ts            # Dark-first MUI theme + design tokens
        ├── main.tsx            # Vite DOM mount point
        ├── content/
        │   └── rules.ts        # Every plain-language rule string: How to play, pre-draft roster, lock note, setting tooltips, notes copy
        ├── contexts/
        │   ├── SeasonContext.tsx # The route's season (`useSeasonContext`: ids, year, `season` with `canEdit` / `canCommission`, `paths`), provided by SeasonLayout
        │   └── UserContext.tsx # Authentication & current user context
        ├── api/
        │   ├── queries.ts      # React Query hooks for every endpoint (`useDeleteLeague` leaves for `/` before refreshing the league list)
        │   └── leagueDeleted.ts # Reads the `leagueDeleted` 404; QueryBoundary renders LeagueDeletedNotice for it, and the query/mutation caches (main.tsx) plus the draft socket's 1008 close refetch `league-seasons` so the season layout shows that page from any guarded call
        ├── hooks/
        │   ├── usePushNotifications.ts # Push state machine (unsupported / needs-install / denied / off / on); permission asked only from `enable()`, which must be called from a tap
        │   ├── useWebSocket.ts # Native RFC 6455 WebSocket hook
        │   └── useWebSocket.test.ts # Hook test suite
        ├── pages/
        │   ├── LandingPage.tsx # Root route: signed out = hero with Sign in and How to play plus the privacy/terms footer; signed in = `YourLeagues` (no redirect, so the logo always reaches it; `dormant` swaps the hero for the off-season notice)
        │   ├── DormantPage.tsx # Dormant-mode notice and fallback for every route except landing, How to play, privacy, terms
        │   ├── CreateLeaguePage.tsx # Short path (name + team count stepper, default rules, Team QB/K off) and an optional "Customize rules" Roster, Scoring, Review wizard
        │   ├── JoinPage.tsx    # `/join/:code` invite preview (members, open slots), Sign in to join / Join league, full-league state and the 409 `league_full` answer
        │   ├── DraftPage.tsx   # Live synchronized draft room
        │   ├── HowToPlayPage.tsx # Plain-language rules page (nav link), copy from src/content/rules.ts
        │   ├── SeasonLayout.tsx # `/leagues/:leagueId` (the current season) and `/leagues/:leagueId/seasons/:year` resolve to a season and provide SeasonContext to the pages below; the long form of the current season redirects (`replace`) to the clean one
        │   ├── FeedPage.tsx    # Feed tab (placeholder: the season's activity feed; chat comes with #265)
        │   ├── MorePage.tsx    # More tab (placeholder list of destinations; Settings split is #267)
        │   ├── LeaguePage.tsx  # A season's home: standings, notes, recap and start-next-season, empty-state notices
        │   ├── PlayersPage.tsx # Player directory with TanStack Table
        │   ├── SettingsPage.tsx# League configuration viewer
        │   ├── TeamPage.tsx    # Roster management view
        │   ├── TeamPointsPage.tsx # Round-by-round points and bench points
        │   └── NotFoundPage.tsx# 404 handler
        ├── components/
        │   ├── home/           # YourLeagues (league cards, Create, invite code, How to play), LeagueCard, leagueSummary (phase tag, rank), PastLeagues, InviteCodeForm, LegalFooter (privacy and terms)
        │   ├── invite/         # InviteMembers (members plus open slots), `inviteView` (sign-in / join / full / unavailable)
        │   ├── activity/       # ActivityFeed (collapsed, new dot), SlotMarker (override / asterisk), ChangedScore tooltip, describeEvent
        │   ├── layout/         # AppShell (header + bottom tabs on phones / left rail from md up), NavBar (header: logo, account), Brand, LeagueSwitcher, BottomTabBar, LeagueRail, leagueTabs (League, Team, Draft, Feed, More)
        │   ├── draft/          # DraftBoard, Countdown, PlayerSelector
        │   ├── league/         # StandingsTable (desktop), StandingsCards (phone), ProgressCounts, RankCell (tie tooltip), ArchivedNotice (shown where a finished season hides write controls; write controls follow the season's `canEdit` / `canCommission` from `useSeasonContext`), LeagueDeletedNotice (the "deleted by a commissioner" page)
        │   ├── players/        # PlayersTable (TanStack Table v8)
        │   ├── recap/          # SeasonRecap: champion card, awards grid, start the next season
        │   ├── team/           # LineupList (tap/drag lineup), OverrideDialog (commissioner confirm), BreakdownRounds (round-by-round points)
        │   └── settings/       # NotificationsToggle (push switch with the iPhone Home Screen explainer); SettingsSection/ScoringForm/RosterForm generated from src/settings schemas; DeleteLeagueDialog (three-step confirm: warning with season count, type the exact name, final "Are you sure?")
        ├── utils/
        │   ├── draftCue.ts     # Web Audio on-deck beep
        │   ├── scoring.ts      # Numeric coercion + defaults diff for league forms
        │   ├── logger.ts       # Leveled client logger (debug/info dev-only)
        │   ├── pushSetup.ts    # `registerServiceWorker()` (call once at startup) and browser feature detection
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

`e2e/live/` is the replay suite (`playwright.live.config.ts`, run by `make e2e` after the main suite): it starts its own API on :8101 with the scheduler in replay mode (`e2e/fixtures/replay.json`, 2000x) against `postszn_e2e_live`, and asserts eliminations land as each replayed game finishes.

## 3b. Route Map (Phase 20)

SPA routes: the league's current season (`current: true` on its entry of `GET /api/leagues/{id}/seasons`, the latest season, even for a former member who may open only older ones) has no year in its addresses: `/leagues/:leagueId` (index = standings and recap), `/draft`, `/feed`, `/more`, `/settings`, `/players`, `/teams/:teamId`, `/teams/:teamId/points`. Navigation inside a league is five destinations (League, Team = your own team, Draft, Feed with the new-activity dot, More): bottom tabs on phones, a left rail from `md` up, no drawer; the logo always opens `/`, and outside a league there is no tab bar and the logo is the wordmark. Any other season lives under `/leagues/:leagueId/seasons/:year` with the same pages (index = standings and recap, `draft`, `settings`, `players`, `teams/:teamId`, `teams/:teamId/points`). `SeasonLayout` resolves the year through `GET /api/leagues/{id}/seasons`, loads `GET /api/seasons/{id}` and provides it as `SeasonContext`; the pages read `canEdit` / `canCommission` / `isFormerMember` from it instead of looking at the league list. `/players` (no league) stays as a global page with a scoring-league picker. `/seasons/<current year>/...` still works and redirects with `replace`; starting the next season moves the clean addresses to it and last year's pages to `/seasons/<last year>/...`. Build links with `routes.ts`, never by string (`src/routes.test.ts` fails on a hand-built season link).

| Area | Endpoints |
| :--- | :--- |
| Config | `GET /api/config` (season) |
| Leagues | `POST /api/leagues/create-league` (creates the league and its first season for the configured year; 201 `{leagueId, seasonId}`; 409 once that season's Super Bowl is final), `GET /api/leagues/user-leagues` (each league with its latest season: `id`, `seasonId`, `season` (year), `finished`, `draftStatus`, `userTeamId`, `hasNewActivity`, and `seasons[]` of every season), `GET /api/leagues/past-leagues` (leagues the caller left, each with the finished seasons they owned a team in), `GET /api/leagues/{id}/seasons` (the seasons the caller may open: all for a member, only those finished seasons after leaving; 403 for a stranger; each has `id`, `year`, `finished`, `draftStatus`, `myTeamId`), `GET/PATCH /api/leagues/{id}` (overview: `notes`, members, `seasons[]`, `currentSeasonId`, `canStartSeason`, `nextYear`; PATCH: `name` and `notes`, free text up to 5000 characters shown to every member, commissioner-only edit), `DELETE /api/leagues/{id}` (any commissioner; body `{leagueName}` must equal the league name, else 422; 409 while a draft in any season is in progress or paused; 204. Soft delete: sets `deleted_at`/`deleted_by`, revokes the invite, keeps every row. Every route behind the member guards then answers 404 `{detail, code: "leagueDeleted", leagueName, deletedAt}` to current and former members and a plain 404 to others. All league queries go through `services/live_leagues.py`; `tests/test_live_league_filter.py` fails on a direct read. The owner restores with `python -m api.scripts.restore_league <id>`, see docs/owner/league-restore.md), `PATCH/DELETE /api/leagues/{id}/members/{userId}` (DELETE sets `left_at`, it never deletes the row), `POST /api/leagues/{id}/seasons` (commissioner starts next year's season once the latest is finished and December 1 of its Super Bowl's calendar year has come; 201 `{leagueId, seasonId}`; 409 if the season is not over, that date has not come or the next one already exists; `canStartSeason` in the overview folds in the same date; today's date is the injectable `dependencies/clock.py` `Today`). A league is never read-only. |
| Seasons | `GET /api/seasons/{id}` (overview: teams, members, draft status, `finished`, `canEdit`, `canCommission`), `PATCH /api/seasons/{id}` (`numberTeams`, locks at draft start), `GET/PATCH /api/seasons/{id}/settings` (roster/scoring/postseason; roster shape locks once the draft starts), `GET /api/seasons/{id}/teams`, `GET /api/seasons/{id}/standings` (`{round, gamesInProgress, playersLeft, teams[]}`; each team has `rank`, round points, `tieReason`, `progress`; ranked by the tiebreaker chain, ties for the title share a rank), `PUT /api/seasons/{id}/teams/{teamId}/owner` (commissioner assigns/unassigns a team; joining assigns one automatically, this is for reassigning). A former member may read these for a finished season they owned a team in; every write to a finished season answers 409 "read-only archive". |
| Recap | `GET /api/seasons/{id}/recap` (`{seasonId, leagueId, year, finished, champions[], standings, nextSeasonId, awards[]}`; no champion or awards until the Super Bowl is final; awards computed on read; the per-position draft awards `best_value_<pos>` / `bust_<pos>` carry `draftedAs`, `finishedAs`, `points`, with `value` = places gained) |
| Invites | `GET/POST/DELETE /api/leagues/{id}/invite` (commissioner), `GET /api/invites/{code}` (public preview, no login: `{code, leagueName, season, openSpots, full, members[{displayName, isCommissioner}], joinable, reason}`; member names only, never emails), `POST /api/invites/{code}/join` (idempotent; claims the lowest-numbered open team of the current season in the same transaction as the membership, and a former member rejoins onto a free team without ever holding two; a league with no open team answers 409 `{detail: "This league is full", code: "league_full"}` until a commissioner raises `numberTeams`) |
| Teams | `GET /api/teams/{id}/breakdown` (each round's counted points per starter slot and the bench's points, computed on read; round scores equal the standings; each starter slot's `mark` and each player's `scoreChange`, restated in counted points after the round multiplier), `GET/PATCH /api/teams/{id}` (the GET carries all four rounds' lineups: slots, unassigned and eliminated players, lock times, empty-starter count), `POST /api/teams/{id}/lineup` (`{round, playerId, slotIndex, confirmOverride?}`; `slotIndex: null` takes a player out; 409 when any player involved is locked or eliminated; the owner or a commissioner. A commissioner moving a locked player gets 409 `{detail, code: "override_confirmation_required"}` until the request repeats with `confirmOverride: true`; there is no add/drop in v1) |
| Activity | `GET /api/seasons/{id}/activity`, `GET /api/teams/{id}/activity` (`?limit=&before=` keyset pages, newest first, members only; each event has `isNew`, the feed has `hasNew`), `POST .../activity/viewed` (`{upToEventId?}`, 204). The season feed is every event of the season; a team's feed is the events with its `team_id` (settings changes have none). `GET /api/leagues/user-leagues` carries `hasNewActivity` for the nav dot, which (like the season feed's `hasNew`) counts only overrides, stat corrections, settings changes and membership joins, leaves and role changes; the team feed counts every event. Events: `lineup_move`, `commissioner_override`, `stat_correction`, `settings_change`, and league-level `league_created`, `membership_joined`, `membership_left`, `role_changed` (written in the same transaction by the create route, `services/invites.py` and `services/league_members.py` through `activity.append_to_league`, posted to the league's current season feed; migration 0016 backfills them for existing leagues; the last three also light the nav dot and ignore the "before they joined" rule); the lineup slot `mark` (override or commissioner-set) is derived from them, and lineup players carry `points` and `scoreChange`. Epic 21 Feed: `draft_order_randomized` (`order[{position, teamId, teamName}]`), `draft_order_changed` (`moves[{teamId, teamName, fromPosition, toPosition}]`, positions from 1, none when nothing moved), `draft_started` (`teamCount`, `rounds`) and `draft_completed` (`picks`, no actor, written by `record_pick`) are league-level, written in the same transaction as the action, and light the dot. **Feed**: `GET /api/seasons/{id}/feed?limit=&before=` (`{items, nextBefore, hasNew, canPost}`; events and chat merged newest first, `before` is the opaque `nextBefore` string, bad one 422; items are `type: "event"` (the event fields) or `type: "message"` (`id, createdAt, authorUserId, authorName, body, gifUrl, canDelete, isNew`); `lineup_move` events are stored but never listed, so they cannot light the dot), `POST /api/seasons/{id}/messages` (`{body (<= 2000), gifUrl?}`, 201 the message; body or GIF required, 422 otherwise; `gifUrl` must be https on `GIF_ALLOWED_HOSTS` or a subdomain, stored as given; 403 former member or stranger, 409 archived or non-current season), `DELETE /api/seasons/{id}/messages/{messageId}` (soft delete, 204; the author or any commissioner, else 403; 404 unknown; repeating is harmless), `POST /api/seasons/{id}/feed/viewed` (`{upToEventId?, upToMessageId?}`, 204; one marker covers events and messages, and the older league `activity/viewed` clears both too), `WS /api/seasons/{id}/feed/ws` (AUTH like the draft room; pushes `{eventType: "FEED_CHANGED", data: {itemType, id, deleted}}` on a new message, deletion, draft order change, start or completion, and the client refetches page 1; other events show on the next fetch; relayed over `feed_events` with `DRAFT_BROADCAST=postgres`). Messages count toward `hasNew` and `hasNewActivity` like the counted event types (not your own, not from before you joined, not deleted) |
| Push | `GET /api/push/vapid-key` (`{publicKey}`, null while unconfigured; no sign-in), `POST /api/push/subscriptions` (`{endpoint, keys:{p256dh, auth}}` as `PushSubscription.toJSON()`; 204; upserts by endpoint, so a device moves to whoever signed in last; 422 unless the endpoint is https on a known push service; 409 while unconfigured), `DELETE /api/push/subscriptions` (`{endpoint}`; 204; only the caller's own). Triggers: your draft pick is on the clock (`draft_events.announce_events`), a new chat message in your league (`POST /api/seasons/{id}/messages`; tag `chat-<season>` so a burst collapses; no per-member mute yet), lineup lock reminder 60 minutes before a round's first kickoff (scheduler tick, so needs `SCHEDULER_ENABLED`). Inert without `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (all three or none). iPhone only receives push from the Home Screen app. The SPA must call `registerServiceWorker()` once at startup; `public/sw.js` handles `push` and `notificationclick` |
| Admin | `PUT /api/admin/playoff-field` (exactly 14 known NFL team ids, else 422; drafts need the field set; the owner uses `python -m api.scripts.set_playoff_field BUF KC ...`, same service), other ingest triggers |
| Players | `GET /api/players/draft-pool` (draftable positions on playoff teams; `?seasonId=` applies that season's team QB / team K settings and flags `scoresWholeTeam`), `GET /api/players/player-list`, `GET /api/players/player-season-stats?season=&leagueId=` (`fantasyPoints` scored under that season's settings; draftable positions only unless `position` is given), `GET /api/players/sync-status` (last successful sync per ingestion type, plus `budgetExhausted` when the daily Tank01 cap has stopped polling); players carry `eliminated` (their NFL team is out) and `injuryStatus` (`Out`, `Doubtful`, `Questionable`, `Injured Reserve` or null; roster and lineup players carry it too) |
| Draft | `GET /api/drafts/draft-info/{seasonId}`, `PATCH /api/drafts/{seasonId}` (setup), `PUT .../order` (`teamIds` may contain `null` for unfilled slots; starting requires a full order), `POST .../order/randomize`, `POST .../control/{lobby,start,pause,resume,undo}`, `POST .../force-pick`, `POST .../picks`, `GET/PUT .../queue`, `WS /api/drafts/ws/{seasonId}` |

Draft rules (Epic 16): the pool is players on `nfl_teams.in_playoffs` (set by ingesting postseason games, which adds only the 12 Wild Card teams, so the two bye teams need the admin endpoint or `api.scripts.set_playoff_field`); `start_draft` needs `Settings.playoff_field_size` (14; the e2e stack uses 8) teams in it, and scheduling or starting after the first Wild Card kickoff (`nfl_games.game_week` 19) is refused with 409. Tank01 `FB` is stored as `RB`. `record_pick` rejects non-pool players and positions at their cap (`position_capped`); auto-pick skips both. Roster slots, position caps and team count lock at draft start; scoring, multipliers and team QB/K stay editable and go through `settings_changes.on_editable_settings_changed`.

Team QB / team K (Epic 13): `team_qb` and `team_k` are required, default-less `season_settings` columns (`teamUnitSettings` on create-league). Turning one on is refused (409, conflicts listed) while a fantasy team holds two of that position from one NFL team. With a setting on, `team_units.scoring_members` makes a slot score every QB/K of his NFL team (standings and lineup points), and `team_units.unavailable_in_pool` keeps non-starters out of the pool, pick validation and auto-pick. Starters come from `nfl.depth_chart_starters` (synced with the roster pipeline) with a most-attempts/kicks fallback.

Authorization (`api/dependencies/league.py`): `LeagueMember` / `LeagueCommissioner` for `/api/leagues/{id}` routes (active members only; never read-only), `SeasonMember` / `SeasonCommissioner` for `/api/seasons/{id}` routes and `TeamMember`/`DraftMember` for team and draft routes (the membership is checked through the season; writes to a finished season answer 409; a former member passes only for GETs of a finished season where they own a team). A league always keeps at least one commissioner. Draft states: `unscheduled -> scheduled -> lobby -> in_progress <-> paused -> completed`; only an explicit commissioner action starts a draft, and the pick deadline is persisted server-side (clients render countdowns from `currentPickDeadline` + `serverTime`).

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
- **Off-season lifecycle**: [shutdown](docs/deploy/shutdown-runbook.md), [wake-up](docs/deploy/wake-up-runbook.md) and [rehearsal](docs/deploy/dormancy-rehearsal.md) runbooks; `scripts/dormancy-check.sh dormant|awake` is the read-only verifier. Stop the Fly machine with `fly machine stop`, never `fly scale count 0`. Sign-in accounts (Supabase Auth, not in the backup) are protected by keeping the project active and, after a lost project, `python -m api.scripts.recreate_auth_users` ([backup.md](docs/deploy/backup.md#recreating-sign-in-accounts), `make rehearse-auth-restore`); never add password hashes to backups.
- **Error tracking**: Sentry is inert without `SENTRY_DSN` (API, `api/core/observability.py`) / `VITE_SENTRY_DSN` (SPA, `utils/sentry.ts`, lazy-loaded). `logger.error` forwards to it, so never put PII in error messages; `RapidApiClient` also sends one "Tank01 daily request budget spent" message per UTC day. Extend the scrubbers when adding new fields. See [docs/deploy/sentry.md](docs/deploy/sentry.md).
- **Centralized Configuration**: All environment variables are strongly typed and accessed via `get_settings()` from `api/core/config.py`.

### Frontend Patterns
- **Mobile-first, always**: The app is used primarily on phones. Design every screen for ~375px width first, then scale up. Default to one vertical column; do not spread a single control across rows/columns of a grid; no horizontal scrolling (exception: the draft board grid, which scrolls both ways with pinned headers) or hover-only interactions; touch targets at least 44px; drag-and-drop must work by touch (delayed `TouchSensor` so scrolling still works).
- **Visual verification is part of every UI change**: After each UI step, launch the app (the `run` skill / built-in browser), use `resize_window` with the `mobile` preset (375x812) and look at the actual rendering, then check desktop. Fix anything clipped, overlapping, cramped or oddly laid out before reporting the work done. Reset the viewport to `desktop` afterward.
- **Environment Configuration**: Runtime variables use Vite conventions (`import.meta.env.VITE_*`).
  - `VITE_API_URL`: Backend HTTP origin; optional locally because the Vite dev server proxies `/api` to `http://localhost:8000`.
  - `VITE_WS_URL`: WebSocket origin; optional for the same reason (defaults to the page origin). Both are required in production builds (Cloudflare Pages build vars). Full contract: `api/.env.example`, `frontend/.env.example`.
  - `VITE_SUPABASE_URL`: Supabase project URL.
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase project publishable API key (`sb_publishable_...`, with fallback to legacy `VITE_SUPABASE_ANON_KEY`).
- **Component Styling**: Material-UI (MUI v9) styled components and `sx` prop.
- **State Flow**: Supabase handles auth credentials client-side; on session initialization or auth state change, the Supabase access token is sent to `/api/auth/login` to resolve/upsert the relational `User.id` into `UserContext`.
