from __future__ import annotations

from pathlib import Path
import sys

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import PG_DATABASE, PG_HOST, PG_PASSWORD, PG_PORT, PG_USER  # noqa: E402


REVISION = "0001_baseline_current_state"


def main() -> int:
    conn = psycopg.connect(
        f"host={PG_HOST} port={PG_PORT} user={PG_USER} password={PG_PASSWORD} dbname={PG_DATABASE} sslmode=disable"
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS alembic_version (
            version_num VARCHAR(32) PRIMARY KEY
        )
        """
    )
    cur.execute("SELECT version_num FROM alembic_version")
    row = cur.fetchone()
    if row is None:
        cur.execute("INSERT INTO alembic_version (version_num) VALUES (%s)", (REVISION,))
        print(f"stamped {REVISION}")
    elif row[0] != REVISION:
        cur.execute("UPDATE alembic_version SET version_num = %s", (REVISION,))
        print(f"updated stamp to {REVISION}")
    else:
        print(f"already stamped {REVISION}")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
