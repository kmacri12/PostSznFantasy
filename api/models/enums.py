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


class FreeAgencyWindow(StrEnum):
    BETWEEN_ROUNDS = "between_rounds"
    ANYTIME = "anytime"


class FreeAgencyClaimOrder(StrEnum):
    FIRST_COME = "first_come"
    WAIVER_PRIORITY = "waiver_priority"


class RosterLock(StrEnum):
    ROUND_START = "round_start"
    GAME_START = "game_start"


class Tiebreaker(StrEnum):
    MOST_PLAYERS_ALIVE = "most_players_alive"
    HIGHEST_SINGLE_ROUND = "highest_single_round"
    LATEST_ROUND_SCORE = "latest_round_score"


class ByeWeekHandling(StrEnum):
    ALIVE_NO_SCORE = "alive_no_score"
    EXCLUDE_FROM_WILD_CARD = "exclude_from_wild_card"
