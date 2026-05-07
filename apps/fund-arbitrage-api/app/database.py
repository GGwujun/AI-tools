from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import AUTO_CREATE_SCHEMA, DATABASE_ADMIN_URL, DATABASE_URL, PG_DATABASE


Base = declarative_base()

engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
    expire_on_commit=False,
)


def ensure_database_exists() -> None:
    url = make_url(DATABASE_URL)
    if not url.drivername.startswith("postgresql"):
        return

    admin_engine = create_engine(
        DATABASE_ADMIN_URL,
        future=True,
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                {"database_name": PG_DATABASE},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{PG_DATABASE}"'))
    finally:
        admin_engine.dispose()


def init_database() -> None:
    ensure_database_exists()
    import app.db_models  # noqa: F401

    if AUTO_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)
        _apply_compat_migrations()


def _apply_compat_migrations() -> None:
    url = make_url(DATABASE_URL)
    if not url.drivername.startswith("postgresql"):
        return

    statements = [
        """
        ALTER TABLE fund_snapshots
        ADD COLUMN IF NOT EXISTS market_change_pct DOUBLE PRECISION
        """
    ]

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
