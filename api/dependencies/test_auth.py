"""Auth stub for end-to-end tests: `Bearer e2e-user:<uid>` stands in for a Supabase JWT.

It exists so Playwright can sign in without a real identity provider. Three guards keep
it out of production: it needs the explicit TEST_AUTH_STUB opt-in, Settings refuses to
start with it outside TEST_AUTH_ENVIRONMENTS, and this module re-checks the environment
on every token so a bypassed validator still cannot authenticate anyone.
"""

from api.core.config import TEST_AUTH_ENVIRONMENTS, get_settings

STUB_TOKEN_PREFIX = "e2e-user:"


def stub_user_id(token: str) -> str | None:
    """The user a stub token names, or None if the stub is off or the token is not one."""
    settings = get_settings()
    if (
        not settings.test_auth_stub
        or settings.environment not in TEST_AUTH_ENVIRONMENTS
    ):
        return None
    if not token.startswith(STUB_TOKEN_PREFIX):
        return None
    return token.removeprefix(STUB_TOKEN_PREFIX) or None
