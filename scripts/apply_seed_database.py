"""Apply recreate_and_seed_database.sql to the configured project database (SQLite or PostgreSQL).

Usage:
    ./.venv/bin/python scripts/apply_seed_database.py
    ./.venv/bin/python scripts/apply_seed_database.py --sql recreate_and_seed_database.sql
    ./.venv/bin/python scripts/apply_seed_database.py --db-url "postgresql://user:pass@host:5432/db"
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from src.config import get_settings  # noqa: E402
from src.integrations.auth_repository import SQLAuthRepository  # noqa: E402
from src.integrations.copilot_sessions import SQLCopilotSessionsRepository  # noqa: E402
from src.integrations.practice_persistence import SQLCheckpointRepository, normalize_database_url  # noqa: E402
from src.integrations.practice_records import SQLPracticeRecordsRepository  # noqa: E402
from src.integrations.sales_copilot_repository import SQLSalesCopilotRepository  # noqa: E402
from src.integrations.voice_usage import SQLVoiceUsageRepository  # noqa: E402


def clean_sql_for_sqlite(sql_text: str) -> str:
    """Strip or adapt PostgreSQL-specific directives for SQLite compatibility."""
    lines = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        # Skip pgvector extension
        if stripped.startswith("CREATE EXTENSION"):
            continue
        # SQLite DROP TABLE does not take CASCADE
        if stripped.startswith("DROP TABLE IF EXISTS") and "CASCADE" in stripped:
            line = stripped.replace("CASCADE;", ";").replace("CASCADE", "")
        line = line.replace("NOW()", "CURRENT_TIMESTAMP")
        lines.append(line)
    return "\n".join(lines)


def apply_to_sqlite(db_path: Path, sql_text: str) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Check if existing file is corrupted (e.g. text file saved as .db)
    if db_path.exists():
        is_corrupt = False
        try:
            with open(db_path, "rb") as f:
                header = f.read(16)
                if header != b"SQLite format 3\x00":
                    is_corrupt = True
        except Exception:
            is_corrupt = True

        if is_corrupt:
            backup_path = db_path.with_suffix(".db.corrupted_bak")
            print(f"[Notice] Existing {db_path} is not a valid SQLite database. Backing up to {backup_path.name}...")
            if backup_path.exists():
                backup_path.unlink()
            db_path.rename(backup_path)
        else:
            db_path.unlink()

    print(f"Connecting to SQLite database: {db_path}")
    conn = sqlite3.connect(str(db_path))
    try:
        cleaned_sql = clean_sql_for_sqlite(sql_text)
        print("Executing DDL and seed statements...")
        conn.executescript(cleaned_sql)
        conn.commit()
    finally:
        conn.close()

    # Synchronize all app repository schemas (creates any additional tables like manager_todos, voice_usage)
    db_url = f"sqlite:///{db_path.resolve()}"
    print("Ensuring application repository schemas are fully synchronized...")
    SQLAuthRepository(db_url)._ensure_schema()
    SQLSalesCopilotRepository(db_url).ensure_schema()
    SQLCopilotSessionsRepository(db_url)._ensure_schema()
    SQLPracticeRecordsRepository(db_url)._ensure_schema()
    SQLCheckpointRepository(db_url)._ensure_schema()
    SQLVoiceUsageRepository(db_url)._ensure_schema()

    # Verify tables and row counts
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall() if not r[0].startswith("sqlite_")]
    print(f"\n Successfully populated SQLite database! Total tables: {len(tables)}")
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table};")
        count = cur.fetchone()[0]
        if count > 0:
            print(f"  - {table}: {count:,} rows")
    conn.close()


def apply_to_postgres(database_url: str, sql_text: str) -> None:
    import psycopg

    # Mask password for display
    masked_url = database_url
    if "@" in database_url:
        prefix, host_part = database_url.split("@", 1)
        scheme, creds = prefix.split("://", 1)
        user = creds.split(":", 1)[0] if ":" in creds else creds
        masked_url = f"{scheme}://{user}:****@{host_part}"

    print(f"Connecting to PostgreSQL database: {masked_url}")
    # Remove SQLAlchemy prefix if present
    conn_url = database_url.replace("postgresql+psycopg://", "postgresql://")

    with psycopg.connect(conn_url) as conn:
        with conn.cursor() as cur:
            print("Executing DDL and seed statements...")
            cur.execute(sql_text)
        conn.commit()

    # Synchronize all app repository schemas
    norm_url = normalize_database_url(database_url)
    print("Ensuring application repository schemas are fully synchronized...")
    SQLAuthRepository(norm_url)._ensure_schema()
    SQLSalesCopilotRepository(norm_url).ensure_schema()
    SQLCopilotSessionsRepository(norm_url)._ensure_schema()
    SQLPracticeRecordsRepository(norm_url)._ensure_schema()
    SQLCheckpointRepository(norm_url)._ensure_schema()
    SQLVoiceUsageRepository(norm_url)._ensure_schema()

    with psycopg.connect(conn_url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = [r[0] for r in cur.fetchall()]
            print(f"\n Successfully populated PostgreSQL database! Total tables: {len(tables)}")
            for table in tables:
                cur.execute(f"SELECT COUNT(*) FROM {table};")
                count = cur.fetchone()[0]
                if count > 0:
                    print(f"  - {table}: {count:,} rows")


def main() -> None:
    parser = argparse.ArgumentParser(description="Recreate and seed project database.")
    parser.add_argument(
        "--sql",
        default="recreate_and_seed_database.sql",
        help="Path to SQL seed file (default: recreate_and_seed_database.sql)",
    )
    parser.add_argument(
        "--db-url",
        default=None,
        help="Target database URL (defaults to DATABASE_URL in settings/.env)",
    )
    args = parser.parse_args()

    sql_path = Path(args.sql)
    if not sql_path.exists():
        print(f"Error: SQL file not found at {sql_path.resolve()}", file=sys.stderr)
        sys.exit(1)

    with open(sql_path, encoding="utf-8") as f:
        sql_text = f.read()

    settings = get_settings()
    import os
    db_url = args.db_url or os.environ.get("DATABASE_URL_UNPOOLED") or settings.database_url

    print("==================================================")
    print("     VINFAST AI COPILOT - DATABASE SEED RUNNER     ")
    print("==================================================")
    print(f"Source SQL: {sql_path.resolve()} ({sql_path.stat().st_size:,} bytes)")

    if db_url.startswith("sqlite"):
        # Extract file path: sqlite:///./data/app.db or sqlite:///data/app.db
        prefix = "sqlite:///"
        rel_path = db_url[len(prefix):] if db_url.startswith(prefix) else db_url.replace("sqlite://", "")
        db_path = (ROOT_DIR / rel_path).resolve() if not Path(rel_path).is_absolute() else Path(rel_path)
        apply_to_sqlite(db_path, sql_text)
    elif db_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
        apply_to_postgres(db_url, sql_text)
    else:
        print(f"Unsupported database scheme in URL: {db_url}", file=sys.stderr)
        sys.exit(1)

    print("\nDatabase initialization & seed complete!")
    print("==================================================")


if __name__ == "__main__":
    main()
