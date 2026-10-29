import argparse
import asyncio
import logging
import sys
import time

from api.core.config import get_settings
from api.db.session import close_db, get_session_factory
from api.services.ingestion.box_scores_ingest import ingest_box_scores
from api.services.ingestion.players_ingest import ingest_nfl_players
from api.services.ingestion.season_stats_ingest import ingest_season_stats
from api.services.ingestion.teams_ingest import ingest_nfl_teams

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed_nfl_data")


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed NFL data from RapidAPI into local database."
    )
    parser.add_argument(
        "--season",
        type=str,
        default=str(get_settings().season_year),
        help="Season year to seed (default: from settings)",
    )
    parser.add_argument(
        "--teams-only",
        action="store_true",
        help="Only fetch and upsert NFL teams",
    )
    parser.add_argument(
        "--players-only",
        action="store_true",
        help="Only fetch and upsert NFL players",
    )
    parser.add_argument(
        "--with-stats",
        action="store_true",
        default=True,
        help="Include regular season stats ingestion",
    )
    parser.add_argument(
        "--with-box-scores",
        action="store_true",
        help="Fetch playoff box scores as well",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force run without prompt",
    )

    args = parser.parse_args()

    print(
        f"\n🏈 [PostSzn Ingestion CLI] Starting NFL data seed for season {args.season}..."
    )
    start_time = time.monotonic()

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            teams_count = 0
            players_count = 0
            stats_count = 0
            games_count = 0

            if args.teams_only:
                print("⏳ Syncing NFL teams...")
                teams_count = await ingest_nfl_teams(session)
                await session.commit()
                print(f"✅ Teams synced: {teams_count}")
            elif args.players_only:
                print("⏳ Syncing NFL players...")
                players_count = await ingest_nfl_players(session)
                await session.commit()
                print(f"✅ Players synced: {players_count}")
            else:
                print("⏳ [1/4] Syncing NFL teams...")
                teams_count = await ingest_nfl_teams(session)
                await session.commit()
                print(f"   ✓ {teams_count} teams synced.")

                print("⏳ [2/4] Syncing NFL players...")
                players_count = await ingest_nfl_players(session)
                await session.commit()
                print(f"   ✓ {players_count} players synced.")

                if args.with_stats:
                    print(f"⏳ [3/4] Syncing season stats for {args.season}...")
                    stats_count = await ingest_season_stats(session, season=args.season)
                    await session.commit()
                    print(f"   ✓ {stats_count} player season stats synced.")

                if args.with_box_scores:
                    print("⏳ [4/4] Syncing playoff box scores...")
                    games_count = await ingest_box_scores(
                        session, season=args.season, season_type="post"
                    )
                    await session.commit()
                    print(f"   ✓ {games_count} games & box scores synced.")

            total_elapsed = time.monotonic() - start_time
            print(f"\n🎉 Ingestion finished in {total_elapsed:.2f}s!")
            print(f"   • Teams:   {teams_count}")
            print(f"   • Players: {players_count}")
            print(f"   • Stats:   {stats_count}")
            print(f"   • Games:   {games_count}\n")

        except Exception as e:
            await session.rollback()
            logger.exception("Ingestion failed: %s", e)
            print(f"\n❌ Error during ingestion: {e}", file=sys.stderr)
            sys.exit(1)
        finally:
            await close_db()


if __name__ == "__main__":
    asyncio.run(main())
