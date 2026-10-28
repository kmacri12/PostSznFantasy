from typing import Any

from pydantic import BaseModel, Field


def safe_int(val: Any, default: int = 0) -> int:
    try:
        return int(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def safe_str(val: Any) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


class RapidApiTeamPayload(BaseModel):
    team_id: int = Field(alias="teamID")
    team_abv: str | None = Field(default=None, alias="teamAbv")
    team_city: str | None = Field(default=None, alias="teamCity")
    team_name: str | None = Field(default=None, alias="teamName")
    team_logo_url: str | None = Field(default=None, alias="teamLogoUrl")


class RapidApiPlayerPayload(BaseModel):
    player_id: int = Field(alias="playerID")
    name: str | None = Field(default=None, alias="longName")
    pos: str | None = Field(default=None)
    espn_headshot: str | None = Field(default=None, alias="espnHeadshot")
    jersey_num: str | None = Field(default=None, alias="jerseyNum")
    bday: str | None = Field(default=None, alias="bDay")
    height: str | None = Field(default=None)
    weight: str | None = Field(default=None)
    exp: str | None = Field(default=None)
    team_id: int | None = Field(default=None, alias="teamID")
