import pytest
from pydantic import ValidationError

from api.models.league_models import LeagueCreate, LeagueUpdate, TeamRename
from api.routers.auth import LoginPayload
from api.utils.text import clean_text

TEAM_UNITS = {"teamQb": False, "teamK": False}


def test_single_line_text_is_trimmed_and_collapsed() -> None:
    assert clean_text("  Big \n  Blue\t Team  ") == "Big Blue Team"
    assert clean_text("a\x00b\x07c") == "abc"
    assert clean_text("evil‮txt") == "eviltxt"
    assert clean_text("Café") == "Café"


def test_notes_keep_their_line_breaks_but_lose_other_control_characters() -> None:
    assert clean_text("  one\r\ntwo\x00\n\tthree  ", multiline=True) == (
        "one\ntwo\n\tthree"
    )


@pytest.mark.parametrize("blank", ["", "   ", "\n\t", "\x00\x00"])
def test_a_blank_name_is_rejected_after_cleaning(blank: str) -> None:
    with pytest.raises(ValidationError):
        TeamRename(name=blank)
    with pytest.raises(ValidationError):
        LeagueUpdate(name=blank)
    with pytest.raises(ValidationError):
        LeagueCreate.model_validate(
            {"leagueName": blank, "teamUnitSettings": TEAM_UNITS}
        )


def test_names_are_stored_clean_and_length_counts_the_cleaned_text() -> None:
    assert TeamRename(name="  Mine  ").name == "Mine"
    padded = " " * 30 + "x" * 40 + " " * 30
    assert TeamRename(name=padded).name == "x" * 40
    with pytest.raises(ValidationError):
        TeamRename(name="x" * 41)
    assert LeagueUpdate(notes="  hi\x00 ").notes == "hi"


def test_a_blank_display_name_counts_as_not_supplied() -> None:
    assert LoginPayload(username="   ").username is None
    assert LoginPayload(username=" Kyle ").username == "Kyle"


def test_default_team_names_skip_ones_already_renamed() -> None:
    from api.services.league_admin import _free_default_name

    assert _free_default_name(3, set()) == "Team 3"
    assert _free_default_name(3, {"team 3", "team 4"}) == "Team 5"
