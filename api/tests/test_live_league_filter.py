"""Every league query must go through the live-leagues filter (#231).

Deleting a league only sets `deleted_at`, so a query that reads leagues, their
seasons or their members without the filter would show a deleted league. New direct
reads fail here until they use `api.services.live_leagues` or are listed (with the
reason) as addressed by an id that a guard already checked.
"""

import re
from pathlib import Path

API = Path(__file__).resolve().parents[1]

DIRECT_READS = re.compile(
    r"select\((League|LeagueMember|LeagueMemberRow|Season)\b"
    r"|select\(Season\.|\.join\(Season\b|db\.get\((League|Season)\b"
)

# File -> why a direct read is safe. Entries must shrink, not grow.
GUARDED_BY_CALLER = {
    "dependencies/league.py": "the membership guards apply the filter themselves",
    "routers/leagues.py": "league routes sit behind LeagueMember / user-leagues join",
    "routers/seasons.py": "season routes sit behind SeasonMember",
    "routers/invites.py": "reads the league of an invite that find_invite kept live",
    "services/seasons.py": "start_season runs behind LeagueCommissioner",
    "services/league_members.py": "member changes run behind LeagueCommissioner",
    "services/invites.py": "joins run for an invite that find_invite kept live",
    "services/draft_flow.py": "draft routes sit behind DraftMember",
    "services/standings.py": "per-season recomputes follow a guarded season route",
    "services/standings_view.py": "standings route sits behind SeasonMember",
    "services/season_recap.py": "recap route sits behind SeasonMember",
    "services/activity.py": "feeds sit behind SeasonMember / TeamMember",
    "services/feed.py": "the Feed routes sit behind SeasonMember",
    "services/stat_corrections.py": "filtered through live_season_ids",
    "services/push.py": "filtered through live_season_ids",
    "services/lineup_reminders.py": "filtered through live_season_ids",
    "services/live_leagues.py": "the filter itself",
}


def test_league_reads_use_the_live_filter() -> None:
    offenders = []
    for path in sorted(API.rglob("*.py")):
        relative = path.relative_to(API).as_posix()
        if relative.startswith(("tests/", "alembic/", "scripts/")):
            continue
        if DIRECT_READS.search(path.read_text()) and relative not in GUARDED_BY_CALLER:
            offenders.append(relative)
    assert not offenders, (
        f"{offenders} read leagues or seasons directly; use "
        "api.services.live_leagues or add the file to GUARDED_BY_CALLER with a reason"
    )


def test_every_unguarded_entry_exists_and_uses_the_filter_where_it_loops() -> None:
    for relative in GUARDED_BY_CALLER:
        assert (API / relative).exists(), relative
    for relative in ("services/standings.py", "services/draft_clock.py"):
        assert "live_" in (API / relative).read_text(), relative
