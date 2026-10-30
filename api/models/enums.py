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
        elif cleaned == "FB":
            cleaned = "RB"
        try:
            return cls(cleaned)
        except ValueError:
            return None


# Raw `pos` values Tank01 may store for the six draftable positions (see from_str).
DRAFTABLE_POSITION_VALUES = (*(p.value for p in PlayerPosition), "DEF", "D/ST", "PK")


class DraftStatus(StrEnum):
    UNSCHEDULED = "unscheduled"
    SCHEDULED = "scheduled"
    LOBBY = "lobby"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"


class DraftType(StrEnum):
    SNAKE = "snake"
    LINEAR = "linear"
    THIRD_ROUND_REVERSAL = "third_round_reversal"


class PickTimeoutAction(StrEnum):
    QUEUE_THEN_BEST = "queue_then_best_available"
    BEST_AVAILABLE = "best_available"


class LeagueRole(StrEnum):
    COMMISSIONER = "commissioner"
    MEMBER = "member"


class Tiebreaker(StrEnum):
    MOST_PLAYERS_ALIVE = "most_players_alive"
    HIGHEST_SINGLE_ROUND = "highest_single_round"
    LATEST_ROUND_SCORE = "latest_round_score"


class ActivityKind(StrEnum):
    LINEUP_MOVE = "lineup_move"
    COMMISSIONER_OVERRIDE = "commissioner_override"
    STAT_CORRECTION = "stat_correction"
    SETTINGS_CHANGE = "settings_change"


class PlayerRoundStatus(StrEnum):
    ALIVE = "alive"
    ELIMINATED = "eliminated"
    BYE = "bye"
