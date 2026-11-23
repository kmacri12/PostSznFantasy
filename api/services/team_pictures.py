"""The picture a team gets when its owner has not uploaded one: a colour and an icon.

Chosen once when the team is created and stored, so it never changes. Every team of a season
gets its own colour (random, no repeats up to `COLORS` teams) so teams stay apart at a glance
without a name or picture; the icon is random. The SPA draws them (`components/team/teamPicture.ts`
holds the same palette sizes).
"""

import random
from collections.abc import Iterable

COLORS = 12
ICONS = 12


def assign(taken_colors: Iterable[int], count: int) -> list[tuple[int, int]]:
    """`(color, icon)` for `count` new teams, avoiding the colours already taken in the season."""
    taken = set(taken_colors)
    free = [color for color in range(COLORS) if color not in taken]
    random.shuffle(free)
    colors: list[int] = []
    for _ in range(count):
        if not free:  # more teams than colours: start a fresh round of the palette
            free = list(range(COLORS))
            random.shuffle(free)
        colors.append(free.pop())
    return [(color, random.randrange(ICONS)) for color in colors]
