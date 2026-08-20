"""The guard on the ad-hoc SQL path.

The DATA path prefers nine reviewed, parameterised tools. Free-form generated SQL
is the fallback when none matches, and it runs on the application-owner connection
-- so this guard is what stands between a generated string and a write.

Cases marked "regression" come from the version of this guard on a colleague's
branch, which wrote the catalogue check as \\b(PG_|INFORMATION_SCHEMA)\\b. That never
matches pg_catalog, because \\b requires a non-word character and the next one is a
letter, so the guard blocked nothing it was written for.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent import MAX_ADHOC_ROWS, enforce_row_limit, is_safe_query  # noqa: E402


@pytest.mark.parametrize("sql", [
    "SELECT material_code FROM materials",
    "SELECT * FROM materials;",
    "WITH recent AS (SELECT 1 AS n) SELECT * FROM recent",
    "SELECT created_at, update_flag, insert_ts FROM audit_log",
])
def test_read_only_queries_are_allowed(sql):
    """Word boundaries must not trip on column names containing a keyword."""
    assert is_safe_query(sql)


@pytest.mark.parametrize("sql", [
    "DROP TABLE inventory",
    "DELETE FROM inventory",
    "UPDATE materials SET unit_cost = 0",
    "INSERT INTO materials VALUES (1)",
    "TRUNCATE inventory",
    "ALTER TABLE materials ADD COLUMN x INT",
    "GRANT ALL ON materials TO PUBLIC",
    "COPY materials TO '/tmp/leak.csv'",
])
def test_writes_are_refused(sql):
    assert not is_safe_query(sql)


@pytest.mark.parametrize("sql", [
    "SELECT * FROM PG_CATALOG.PG_TABLES",     # regression
    "SELECT * FROM pg_user",                  # regression
    "SELECT usename, passwd FROM pg_shadow",  # regression
    "SELECT * FROM information_schema.tables",
    "SELECT current_setting('data_directory')",
])
def test_system_catalogue_is_refused(sql):
    """Catalogue reads expose schema, roles and settings the assistant has no
    business surfacing, even though they are technically SELECTs."""
    assert not is_safe_query(sql)


@pytest.mark.parametrize("sql", [
    "SELECT 1; DROP TABLE inventory",
    "SELECT * FROM materials WHERE id = 1; SELECT * FROM users",
    "WITH c AS (DELETE FROM inventory RETURNING *) SELECT * FROM c",
])
def test_statement_chaining_and_writable_ctes_are_refused(sql):
    """A leading SELECT is not sufficient: the damage can follow a semicolon, or
    hide inside a data-modifying CTE."""
    assert not is_safe_query(sql)


def test_denial_of_service_function_is_refused():
    assert not is_safe_query("SELECT pg_sleep(30)")


def test_unbounded_queries_are_capped():
    assert enforce_row_limit("SELECT * FROM materials") == (
        f"SELECT * FROM materials LIMIT {MAX_ADHOC_ROWS}")


@pytest.mark.parametrize("sql", [
    "SELECT * FROM materials LIMIT 5",
    "SELECT * FROM materials limit 250",
])
def test_an_existing_limit_is_respected(sql):
    assert enforce_row_limit(sql) == sql


def test_the_cap_survives_a_trailing_semicolon():
    assert enforce_row_limit("SELECT * FROM materials;").endswith(f"LIMIT {MAX_ADHOC_ROWS}")
    assert ";" not in enforce_row_limit("SELECT * FROM materials;")
