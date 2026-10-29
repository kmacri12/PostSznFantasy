import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

# Add project root (containing `api`) to sys.path
project_root = str(Path(__file__).resolve().parents[2])
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy import Connection, pool, text  # noqa: E402
from sqlalchemy.ext.asyncio import async_engine_from_config  # noqa: E402

from alembic import context  # noqa: E402
from api.core.config import get_settings  # noqa: E402
from api.db.models import Base  # noqa: E402

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def get_db_url() -> str:
    """Async DB URL; migrations run on the same asyncpg driver as the app."""
    return get_settings().async_database_url


def run_migrations_offline() -> None:
    """Emit migration SQL to stdout without connecting to the database."""
    context.configure(
        url=get_db_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_db_url()
    connectable = async_engine_from_config(
        configuration, prefix="sqlalchemy.", poolclass=pool.NullPool
    )

    async with connectable.begin() as connection:
        # Schemas must exist before the first migration's DDL runs.
        await connection.execute(text("CREATE SCHEMA IF NOT EXISTS nfl"))
        await connection.execute(text("CREATE SCHEMA IF NOT EXISTS fantasy"))
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
