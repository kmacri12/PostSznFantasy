import argparse
import asyncio
import json
import logging
from pathlib import Path

from api.core.logging import setup_logging
from api.utils.rapidapi.rapidapi import close_rapidapi_client, get_rapidapi_client

logger = logging.getLogger("export_replay")


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Save a finished postseason's games list and box scores for replay."
    )
    parser.add_argument("--season", default="2025")
    parser.add_argument("--out", type=Path, default=Path("replay-2025.json"))
    args = parser.parse_args()
    setup_logging()

    client = get_rapidapi_client()
    try:
        games = await client.get_nfl_games_list(args.season, "post", "all")
        boxes = {
            g["gameID"]: await client.get_nfl_box_score(g["gameID"]) for g in games
        }
    finally:
        await close_rapidapi_client()
    args.out.write_text(json.dumps({"games": games, "boxes": boxes}))
    logger.info(
        "Saved %d games to %s (%s requests remaining)",
        len(games),
        args.out,
        client.requests_remaining,
    )


if __name__ == "__main__":
    asyncio.run(main())
