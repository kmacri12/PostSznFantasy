from enum import StrEnum


class PlayerPosition(StrEnum):
    QB = "QB"
    RB = "RB"
    WR = "WR"
    TE = "TE"
    K = "K"
    DST = "DST"

    @classmethod
    def from_str(cls, value: str | None) -> "PlayerPosition | None":
        """Safely parse a string into a PlayerPosition, returning None if invalid."""
        if not value:
            return None
        cleaned = value.strip().upper()
        # Handle common abbreviations/variants
        if cleaned in ("DEF", "D/ST"):
            cleaned = "DST"
        elif cleaned == "PK":
            cleaned = "K"
        try:
            return cls(cleaned)
        except ValueError:
            return None
