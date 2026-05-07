from __future__ import annotations

import os
from pathlib import Path


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_env_file()


def _get_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _get_csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = _get_int("API_PORT", 8000)
DEBUG = _get_bool("DEBUG", False)
AUTH_CODE_EXPIRE_MINUTES = _get_int("AUTH_CODE_EXPIRE_MINUTES", 10)
AUTH_SESSION_EXPIRE_DAYS = _get_int("AUTH_SESSION_EXPIRE_DAYS", 30)

CORS_ORIGINS = _get_csv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:4173,http://localhost:5173,"
    "http://127.0.0.1:3000,http://127.0.0.1:4173,http://127.0.0.1:5173",
)

PG_HOST = os.getenv("PGHOST", "127.0.0.1")
PG_PORT = _get_int("PGPORT", 5432)
PG_USER = os.getenv("PGUSER", "postgres")
PG_PASSWORD = os.getenv("PGPASSWORD", "postgres")
PG_DATABASE = os.getenv("PGDATABASE", "fund_assistant_h5")
PG_ADMIN_DATABASE = os.getenv("PGADMIN_DATABASE", "postgres")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DATABASE}",
)
DATABASE_ADMIN_URL = os.getenv(
    "DATABASE_ADMIN_URL",
    f"postgresql+psycopg://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_ADMIN_DATABASE}",
)
AUTO_CREATE_SCHEMA = _get_bool("AUTO_CREATE_SCHEMA", True)

REDIS_URL = os.getenv("REDIS_URL", "").strip()
CACHE_ENABLED = _get_bool("CACHE_ENABLED", True)
OPPORTUNITY_CACHE_TTL_SECONDS = _get_int("OPPORTUNITY_CACHE_TTL_SECONDS", 30)
DETAIL_CACHE_TTL_SECONDS = _get_int("DETAIL_CACHE_TTL_SECONDS", 30)
VALUATION_CACHE_TTL_SECONDS = _get_int("VALUATION_CACHE_TTL_SECONDS", 30)

FUND_SYNC_INTERVAL_SECONDS = _get_int("FUND_SYNC_INTERVAL_SECONDS", 900)
OPEN_MARKET_SYNC_INTERVAL_SECONDS = _get_int("OPEN_MARKET_SYNC_INTERVAL_SECONDS", 180)
CLOSED_MARKET_SYNC_INTERVAL_SECONDS = _get_int("CLOSED_MARKET_SYNC_INTERVAL_SECONDS", FUND_SYNC_INTERVAL_SECONDS)
MARKET_OPEN_BURST_SYNC_INTERVAL_SECONDS = _get_int("MARKET_OPEN_BURST_SYNC_INTERVAL_SECONDS", 120)
MARKET_CLOSE_BURST_SYNC_INTERVAL_SECONDS = _get_int("MARKET_CLOSE_BURST_SYNC_INTERVAL_SECONDS", 120)
DETAIL_HISTORY_DAYS = _get_int("DETAIL_HISTORY_DAYS", 20)
DETAIL_STALE_SECONDS = _get_int("DETAIL_STALE_SECONDS", 900)
SYNC_ON_STARTUP = _get_bool("SYNC_ON_STARTUP", True)
EMBEDDED_SYNC_ENABLED = _get_bool("EMBEDDED_SYNC_ENABLED", False)

NO_GAP_KEYWORDS = [
    "纳斯达克",
    "标普",
    "港股",
    "恒生",
    "中概",
    "海外",
    "QDII",
    "美股",
    "欧洲",
    "日本",
    "德国",
    "法国",
    "美国",
    "道琼斯",
]
