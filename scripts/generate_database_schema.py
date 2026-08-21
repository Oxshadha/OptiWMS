#!/usr/bin/env python3
"""Regenerate database_schema.md from a live database.

The committed schema document was produced by hand from information_schema and
then drifted: it described 50 tables while the database had 88, and everything
the forecasting and planning work added was missing. A document that cannot be
regenerated is a document that goes stale without anyone noticing.

Run against a database that Flyway has already migrated:

    python3 scripts/generate_database_schema.py \
        --db-url postgresql://optiwms:optiwms@localhost:5434/optiwms

Flyway's own bookkeeping table is excluded: it describes the migration tool,
not the warehouse domain.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:  # pragma: no cover - dependency guidance
    sys.exit("psycopg2 is required: pip install psycopg2-binary")

EXCLUDED = {"flyway_schema_history"}
RULE = "=" * 80

COLUMNS_SQL = """
SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default,
       c.character_maximum_length, c.numeric_precision, c.numeric_scale
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position
"""

# Primary keys and foreign keys, resolved through the constraint catalogue so a
# composite key reports every column rather than an arbitrary one.
KEYS_SQL = """
SELECT tc.constraint_type, tc.table_name, kcu.column_name,
       ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
"""


def render_type(data_type: str, char_len, num_precision, num_scale) -> str:
    """Render a column type the way the original document did: short and readable."""
    t = data_type.upper()
    aliases = {
        "CHARACTER VARYING": "VARCHAR",
        "TIMESTAMP WITHOUT TIME ZONE": "TIMESTAMP",
        "TIMESTAMP WITH TIME ZONE": "TIMESTAMPTZ",
        "DOUBLE PRECISION": "DOUBLE",
        "USER-DEFINED": "USER-DEFINED",
    }
    t = aliases.get(t, t)
    if t == "VARCHAR" and char_len:
        return f"VARCHAR({char_len})"
    if t == "NUMERIC" and num_precision:
        return f"NUMERIC({num_precision},{num_scale or 0})"
    return t


def shorten_default(default: str | None) -> str | None:
    """Strip the cast noise Postgres adds, so defaults read as they were written."""
    if not default:
        return None
    d = default.split("::")[0].strip()
    return d.strip("'") if d.startswith("'") and d.endswith("'") else d


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-url", default="postgresql://optiwms:optiwms@localhost:5434/optiwms")
    ap.add_argument("--out", default="database_schema.md")
    args = ap.parse_args()

    conn = psycopg2.connect(args.db_url)
    cur = conn.cursor()

    cur.execute(COLUMNS_SQL)
    columns: dict[str, list] = {}
    for row in cur.fetchall():
        if row[0] in EXCLUDED:
            continue
        columns.setdefault(row[0], []).append(row[1:])

    cur.execute(KEYS_SQL)
    pks: dict[str, set[str]] = {}
    fks: dict[str, dict[str, tuple[str, str]]] = {}
    for ctype, table, column, ref_table, ref_column in cur.fetchall():
        if table in EXCLUDED:
            continue
        if ctype == "PRIMARY KEY":
            pks.setdefault(table, set()).add(column)
        else:
            fks.setdefault(table, {})[column] = (ref_table, ref_column)
    conn.close()

    tables = sorted(columns)
    out = [RULE, "DATABASE SCHEMA - OptiWMS", f"Total Tables: {len(tables)}", RULE, "", "---", ""]

    for table in tables:
        out.append(f"## TABLE: {table}")
        out.append("")
        for name, dtype, nullable, default, clen, nprec, nscale in columns[table]:
            parts = [name, render_type(dtype, clen, nprec, nscale),
                     "NULL" if nullable == "YES" else "NOT NULL"]
            if name in pks.get(table, set()):
                parts.append("[PK]")
            if name in fks.get(table, {}):
                ref_t, ref_c = fks[table][name]
                parts.append(f"[FK -> {ref_t}({ref_c})]")
            shown = shorten_default(default)
            if shown:
                parts.append(f"[DEFAULT: {shown}]")
            out.append(" ".join(parts))
        out += ["", "---", ""]

    out += [RULE, "FOREIGN KEY RELATIONSHIPS", RULE, ""]
    for table in tables:
        if table not in fks:
            continue
        out.append(f"{table}:")
        for column in sorted(fks[table]):
            ref_t, ref_c = fks[table][column]
            out.append(f"{column} -> {ref_t}({ref_c})")
        out.append("")
    out.append(RULE)

    Path(args.out).write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{args.out}: {len(tables)} tables, "
          f"{sum(len(v) for v in columns.values())} columns, "
          f"{sum(len(v) for v in fks.values())} foreign keys")


if __name__ == "__main__":
    main()
