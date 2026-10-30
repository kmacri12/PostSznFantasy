import pytest

from api.core.config import Settings
from api.scripts.seed_e2e import _database_name


def settings_for(database: str) -> Settings:
    return Settings(
        _env_file=None,
        pg_uri=f"postgresql://u:p@localhost:5433/{database}",
        supabase_url="https://test.supabase.co",
    )


@pytest.mark.parametrize("database", ["postszn", "postgres", "postszn_prod"])
def test_the_seeder_refuses_to_wipe_a_real_database(
    monkeypatch: pytest.MonkeyPatch, database: str
) -> None:
    monkeypatch.setattr(
        "api.scripts.seed_e2e.get_settings", lambda: settings_for(database)
    )
    with pytest.raises(SystemExit, match="Refusing to wipe"):
        _database_name()


@pytest.mark.parametrize(
    "database", ["postszn_e2e", "postszn_e2e_live", "postszn_test"]
)
def test_the_seeder_accepts_throwaway_databases(
    monkeypatch: pytest.MonkeyPatch, database: str
) -> None:
    monkeypatch.setattr(
        "api.scripts.seed_e2e.get_settings", lambda: settings_for(database)
    )
    assert _database_name() == database
