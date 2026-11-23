"""Team names after their owner: the pure rules."""

from api.db.models.user import User
from api.services.display_names import placeholder_name
from api.services.team_names import is_default_name, suggested_name, unique_name


def user(name: str, uid: str = "abcdef123456") -> User:
    return User(supabase_uid=uid, username=name, email=None)


def test_only_team_n_counts_as_a_default_name() -> None:
    assert is_default_name("Team 3")
    assert not is_default_name("Team Kyle")
    assert not is_default_name("team 3x")
    assert not is_default_name(None)


def test_the_suggestion_is_team_and_the_first_word_of_the_display_name() -> None:
    assert suggested_name(user("Kyle Macri")) == "Team Kyle"
    assert suggested_name(user("Coach P")) == "Team Coach"
    assert suggested_name(user("  Pat  ")) == "Team Pat"


def test_no_suggestion_until_the_member_has_chosen_a_name() -> None:
    uid = "abcdef123456"
    assert suggested_name(user(placeholder_name(uid), uid)) is None
    assert suggested_name(user("   ")) is None


def test_a_taken_name_gets_the_next_number_ignoring_case() -> None:
    taken = {"team kyle", "team kyle 2"}
    assert unique_name("Team Kyle", set()) == "Team Kyle"
    assert unique_name("Team Kyle", taken) == "Team Kyle 3"
    assert unique_name("Team Sam", taken) == "Team Sam"


def test_the_draft_room_calls_an_unowned_default_team_open() -> None:
    from api.db.models.league import Team
    from api.services.team_names import draft_label

    assert draft_label(Team(id=3, name="Team 3", owner_id=None)) == "Open team 3"
    assert draft_label(Team(id=3, name="Team 3", owner_id=7)) == "Team 3"
    assert draft_label(Team(id=3, name="Team Kyle", owner_id=None)) == "Team Kyle"
