"""Who may call what: the expected answer of every API route for every kind of caller.

`test_authz_coverage.py` fails when a route in the OpenAPI schema has no entry here
(or an entry has no route), so a new endpoint must declare its access rule in the
same PR. `postgres/test_authorization_matrix.py` then calls every route as every
role against a real database and compares.

To declare a new route, add one line to `EXPECTED` with the policy that fits, or
build a one-off with `Policy(...)` when it differs (see `MEMBER_REMOVAL`).
"""

from dataclasses import dataclass

ROLES = ("anonymous", "stranger", "former", "member", "owner", "commissioner")
"""The callers, in the order a `Policy` lists them:

anonymous     no Authorization header
stranger      signed in, never in the league
former        left the league (their `left_at` is set; the season is not finished)
member        active member who owns a different team than the one probed
owner         active member who owns the team (and the message) probed
commissioner  commissioner of the league
"""


class Allowed:
    """Reached the handler: anything but 401/403 (and never a 5xx).

    The probe sends an empty body, so a permitted call usually ends in 422 or 409;
    what matters is that the guard let it through.
    """


ALLOWED = Allowed()
DENIED = 403
UNAUTHENTICATED = (401, 403)

Expect = Allowed | int | tuple[int, ...]


@dataclass(frozen=True)
class Policy:
    anonymous: Expect
    stranger: Expect
    former: Expect
    member: Expect
    owner: Expect
    commissioner: Expect

    def for_role(self, role: str) -> Expect:
        expect: Expect = getattr(self, role)
        return expect


A, D, U = ALLOWED, DENIED, UNAUTHENTICATED

PUBLIC = Policy(A, A, A, A, A, A)
SIGNED_IN = Policy(U, A, A, A, A, A)
ADMIN = Policy(U, D, D, D, D, D)
LEAGUE_MEMBER = Policy(U, D, D, A, A, A)
COMMISSIONER = Policy(U, D, D, D, D, A)
TEAM_OWNER_OR_COMMISSIONER = Policy(U, D, D, D, A, A)
MESSAGE_AUTHOR = Policy(U, D, D, D, A, D)
MESSAGE_AUTHOR_OR_COMMISSIONER = Policy(U, D, D, D, A, A)
# Leave (yourself) is for any member; removing someone else is the commissioner's.
# The probe targets the plain `member`, so the owner removes someone else.
MEMBER_REMOVAL = Policy(U, D, D, A, D, A)
# 404 rather than 403: the route reveals nothing about leagues the caller is not in.
MEMBER_OR_NOT_FOUND = Policy(U, 404, 404, A, A, A)

EXPECTED: dict[str, Policy] = {
    # Health, config and feature flags
    "GET /api": PUBLIC,
    "HEAD /api": PUBLIC,
    "GET /api/config": PUBLIC,
    "GET /api/features": PUBLIC,
    "GET /api/push/vapid-key": PUBLIC,
    "GET /api/invites/{code}": PUBLIC,
    # Account and profile (the caller's own data, any signed-in user)
    "GET /api/account": SIGNED_IN,
    "DELETE /api/account/devices": SIGNED_IN,
    "DELETE /api/account/devices/{device_id}": SIGNED_IN,
    "GET /api/account/export": SIGNED_IN,
    "PATCH /api/account/preferences": SIGNED_IN,
    "POST /api/auth/login": SIGNED_IN,
    "DELETE /api/auth/me": SIGNED_IN,
    "PATCH /api/auth/me": SIGNED_IN,
    "PUT /api/avatars/me": SIGNED_IN,
    "DELETE /api/avatars/me": SIGNED_IN,
    "GET /api/notifications": SIGNED_IN,
    "POST /api/notifications/read": SIGNED_IN,
    "GET /api/push/preferences": SIGNED_IN,
    "PATCH /api/push/preferences": SIGNED_IN,
    "POST /api/push/subscriptions": SIGNED_IN,
    "DELETE /api/push/subscriptions": SIGNED_IN,
    "PUT /api/push/chat-mute/{league_id}": MEMBER_OR_NOT_FOUND,
    "POST /api/support": SIGNED_IN,
    "POST /api/support/feedback": SIGNED_IN,
    # Leagues (any signed-in user may create or join; the rest is the league's)
    "POST /api/leagues/create-league": SIGNED_IN,
    "GET /api/leagues/past-leagues": SIGNED_IN,
    "GET /api/leagues/scoring-defaults": PUBLIC,
    "GET /api/leagues/user-leagues": SIGNED_IN,
    "POST /api/invites/{code}/join": SIGNED_IN,
    "GET /api/leagues/{league_id}": LEAGUE_MEMBER,
    "PATCH /api/leagues/{league_id}": COMMISSIONER,
    "DELETE /api/leagues/{league_id}": COMMISSIONER,
    "PUT /api/leagues/{league_id}/avatar": COMMISSIONER,
    "DELETE /api/leagues/{league_id}/avatar": COMMISSIONER,
    "GET /api/leagues/{league_id}/invite": COMMISSIONER,
    "POST /api/leagues/{league_id}/invite": COMMISSIONER,
    "DELETE /api/leagues/{league_id}/invite": COMMISSIONER,
    "PUT /api/leagues/{league_id}/announcement": COMMISSIONER,
    "DELETE /api/leagues/{league_id}/announcement": COMMISSIONER,
    "PATCH /api/leagues/{league_id}/members/{user_id}": COMMISSIONER,
    "DELETE /api/leagues/{league_id}/members/{user_id}": MEMBER_REMOVAL,
    "GET /api/leagues/{league_id}/seasons": LEAGUE_MEMBER,
    "POST /api/leagues/{league_id}/seasons": COMMISSIONER,
    # Seasons
    "GET /api/seasons/{season_id}": LEAGUE_MEMBER,
    "PATCH /api/seasons/{season_id}": COMMISSIONER,
    "GET /api/seasons/{season_id}/activity": LEAGUE_MEMBER,
    "POST /api/seasons/{season_id}/activity/viewed": LEAGUE_MEMBER,
    "GET /api/seasons/{season_id}/bracket": LEAGUE_MEMBER,
    "GET /api/seasons/{season_id}/recap": LEAGUE_MEMBER,
    "GET /api/seasons/{season_id}/settings": LEAGUE_MEMBER,
    "PATCH /api/seasons/{season_id}/settings": COMMISSIONER,
    "GET /api/seasons/{season_id}/standings": LEAGUE_MEMBER,
    "GET /api/seasons/{season_id}/teams": LEAGUE_MEMBER,
    "PUT /api/seasons/{season_id}/teams/{team_id}/owner": COMMISSIONER,
    # Feed and chat
    "GET /api/seasons/{season_id}/feed": LEAGUE_MEMBER,
    "POST /api/seasons/{season_id}/feed/viewed": LEAGUE_MEMBER,
    "POST /api/seasons/{season_id}/messages": LEAGUE_MEMBER,
    "PATCH /api/seasons/{season_id}/messages/{message_id}": MESSAGE_AUTHOR,
    "DELETE /api/seasons/{season_id}/messages/{message_id}": (
        MESSAGE_AUTHOR_OR_COMMISSIONER
    ),
    "PUT /api/seasons/{season_id}/messages/{message_id}/reactions": LEAGUE_MEMBER,
    # Teams
    "GET /api/teams/{team_id}": LEAGUE_MEMBER,
    "PATCH /api/teams/{team_id}": TEAM_OWNER_OR_COMMISSIONER,
    "GET /api/teams/{team_id}/activity": LEAGUE_MEMBER,
    "POST /api/teams/{team_id}/activity/viewed": LEAGUE_MEMBER,
    "PUT /api/teams/{team_id}/avatar": TEAM_OWNER_OR_COMMISSIONER,
    "DELETE /api/teams/{team_id}/avatar": TEAM_OWNER_OR_COMMISSIONER,
    "GET /api/teams/{team_id}/breakdown": LEAGUE_MEMBER,
    "POST /api/teams/{team_id}/lineup": TEAM_OWNER_OR_COMMISSIONER,
    # Draft
    "GET /api/drafts/draft-info/{season_id}": LEAGUE_MEMBER,
    "GET /api/drafts/draft-picks/{draft_id}": LEAGUE_MEMBER,
    "PATCH /api/drafts/{season_id}": COMMISSIONER,
    "POST /api/drafts/{season_id}/assign": COMMISSIONER,
    "DELETE /api/drafts/{season_id}/assign/{pick_number}": COMMISSIONER,
    "POST /api/drafts/{season_id}/control/{action}": COMMISSIONER,
    "POST /api/drafts/{season_id}/force-pick": COMMISSIONER,
    "PUT /api/drafts/{season_id}/order": COMMISSIONER,
    "POST /api/drafts/{season_id}/order/randomize": COMMISSIONER,
    "POST /api/drafts/{season_id}/picks": LEAGUE_MEMBER,
    "GET /api/drafts/{season_id}/queue": LEAGUE_MEMBER,
    "PUT /api/drafts/{season_id}/queue": LEAGUE_MEMBER,
    # Player database (the same for every signed-in user)
    "GET /api/players/draft-pool": SIGNED_IN,
    "GET /api/players/player-list": SIGNED_IN,
    "GET /api/players/player-season-stats": SIGNED_IN,
    "GET /api/players/sync-status": SIGNED_IN,
    # Admin (ADMIN_SUPABASE_UIDS only; no test role is one)
    "GET /api/admin/feature-flags": ADMIN,
    "PUT /api/admin/feature-flags/{key}": ADMIN,
    "PUT /api/admin/games/{game_id}/result": ADMIN,
    "PUT /api/admin/playoff-field": ADMIN,
    "POST /api/admin/refresh/live": ADMIN,
    "POST /api/admin/update/all": ADMIN,
    "POST /api/admin/update/box_scores": ADMIN,
    "POST /api/admin/update/eliminate_teams": ADMIN,
    "POST /api/admin/update/nfl_players": ADMIN,
    "POST /api/admin/update/nfl_players_and_stats": ADMIN,
    "POST /api/admin/update/nfl_teams": ADMIN,
}

# Probes send no body, which is enough when the guard is a dependency (it answers
# before validation). A route that checks the caller inside the handler needs a
# body that passes validation first, or the probe sees 422 instead of 403.
BODIES: dict[str, dict[str, object]] = {
    "PATCH /api/seasons/{season_id}/messages/{message_id}": {"body": "edited"},
    "PATCH /api/teams/{team_id}": {"name": "Renamed"},
    "POST /api/teams/{team_id}/lineup": {"round": 1, "playerId": 1, "slotIndex": None},
    "PUT /api/push/chat-mute/{league_id}": {"muted": True},
}
