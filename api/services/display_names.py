import unicodedata
from collections import Counter
from collections.abc import Sequence

MAX_NAME_LENGTH = 20


def clean_display_name(value: str) -> str:
    """The name as stored: trimmed, 1 to 20 characters (code points, like the SPA),
    no control characters (they render as blanks in lists, chat and push text)."""
    name = value.strip()
    if not 1 <= len(name) <= MAX_NAME_LENGTH:
        raise ValueError(f"Your name must be 1 to {MAX_NAME_LENGTH} characters.")
    if any(unicodedata.category(char).startswith("C") for char in name):
        raise ValueError("Your name can't contain control characters.")
    return name


def disambiguate(names: Sequence[str]) -> list[str]:
    """Names as listed within one league: only a colliding name gets a number, and the
    first holder keeps it plain, so most lists show no suffix at all."""
    totals = Counter(name.casefold() for name in names)
    seen: Counter[str] = Counter()
    listed = []
    for name in names:
        key = name.casefold()
        seen[key] += 1
        listed.append(
            name if totals[key] == 1 or seen[key] == 1 else f"{name} ({seen[key]})"
        )
    return listed


def placeholder_name(supabase_uid: str) -> str:
    """The stand-in until a member picks a name; never derived from their email."""
    return f"user_{supabase_uid[:8]}"
