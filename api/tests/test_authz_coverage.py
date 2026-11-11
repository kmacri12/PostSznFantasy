"""Every route must declare who may call it (see authz_expectations.py)."""

import re

from api.main import app
from api.tests.authz_expectations import EXPECTED

METHODS = {"get", "put", "post", "delete", "patch", "head"}


def routes() -> set[str]:
    return {
        f"{method.upper()} {path}"
        for path, operations in app.openapi()["paths"].items()
        for method in operations
        if method in METHODS
    }


def test_every_route_declares_an_expectation() -> None:
    missing = sorted(routes() - EXPECTED.keys())
    assert not missing, (
        "These routes have no access expectation. Add them to EXPECTED in "
        f"api/tests/authz_expectations.py with the policy that fits: {missing}"
    )


def test_no_expectation_for_a_route_that_is_gone() -> None:
    stale = sorted(EXPECTED.keys() - routes())
    assert not stale, f"Remove these from EXPECTED, the routes no longer exist: {stale}"


def test_expectation_keys_are_well_formed() -> None:
    bad = [key for key in EXPECTED if not re.fullmatch(r"[A-Z]+ /api\S*", key)]
    assert not bad, bad
