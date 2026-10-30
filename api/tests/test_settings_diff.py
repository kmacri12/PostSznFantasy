from decimal import Decimal

from api.services.settings_changes import diff_settings


def test_only_fields_whose_value_changed_are_reported() -> None:
    changes = diff_settings(
        {"scoring_passing_td": Decimal("4.00"), "scoring_rushing_td": Decimal("6.00")},
        {"scoring_passing_td": 6.0, "scoring_rushing_td": 6},
    )
    assert [(c.field, c.before, c.after) for c in changes] == [
        ("scoringPassingTd", 4, 6)
    ]


def test_numbers_are_plain_and_other_types_pass_through() -> None:
    changes = diff_settings(
        {"scoring_passing_yard": Decimal("0.04"), "tiebreaker": "a", "flag": True},
        {"scoring_passing_yard": 0.05, "tiebreaker": "b", "flag": False},
    )
    assert {c.field: (c.before, c.after) for c in changes} == {
        "scoringPassingYard": (0.04, 0.05),
        "tiebreaker": ("a", "b"),
        "flag": (True, False),
    }


def test_a_field_missing_from_the_new_values_is_not_a_change() -> None:
    assert diff_settings({"a": 1, "b": 2}, {"a": 1}) == []
