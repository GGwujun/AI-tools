from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import sys

from sqlalchemy import inspect

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import engine
from app.db_models import Base


def main() -> int:
    inspector = inspect(engine)

    db_tables = set(inspector.get_table_names(schema="public"))
    model_tables = set(Base.metadata.tables.keys())

    missing_tables = sorted(model_tables - db_tables)
    extra_tables = sorted(db_tables - model_tables)

    column_issues: dict[str, dict[str, list[str]]] = defaultdict(lambda: {"missing": [], "extra": []})
    for table_name in sorted(model_tables & db_tables):
        db_columns = {column["name"] for column in inspector.get_columns(table_name, schema="public")}
        model_columns = set(Base.metadata.tables[table_name].columns.keys())
        missing_columns = sorted(model_columns - db_columns)
        extra_columns = sorted(db_columns - model_columns)
        if missing_columns:
            column_issues[table_name]["missing"] = missing_columns
        if extra_columns:
            column_issues[table_name]["extra"] = extra_columns

    if not missing_tables and not extra_tables and not column_issues:
        print("Schema is in sync with db_models.py")
        return 0

    if missing_tables:
        print("[Missing tables]")
        for name in missing_tables:
            print(f"  - {name}")

    if extra_tables:
        print("[Extra tables]")
        for name in extra_tables:
            print(f"  - {name}")

    if column_issues:
        print("[Column differences]")
        for table_name, issues in column_issues.items():
            print(f"  [{table_name}]")
            for col in issues["missing"]:
                print(f"    missing: {col}")
            for col in issues["extra"]:
                print(f"    extra: {col}")

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
