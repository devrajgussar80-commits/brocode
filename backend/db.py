"""Postgres data layer for BroCode.

The application was written against ``sqlite3`` and calls ``con.execute(sql, params)``
in 300+ places, reading rows both by column name and by position. Rewriting every
call site by hand across financial code would be far riskier than adapting the
handful of places where SQLite and Postgres actually differ, so this module keeps
that API and translates underneath:

* ``?`` placeholders become ``%s`` (string literals are left alone)
* ``INSERT OR IGNORE`` becomes ``ON CONFLICT DO NOTHING``
* ``PRAGMA`` statements are dropped
* ``lastrowid`` resolves through ``lastval()`` on the same session
* rows support ``row["col"]``, ``row[0]`` and ``dict(row)``

Boolean-ish columns stay INTEGER rather than becoming BOOLEAN so that existing
``bool(row["coming_soon"])`` reads and ``1``/``0`` writes keep working unchanged.
"""
from __future__ import annotations

import os
import re
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg import errors as pg_errors
from psycopg_pool import ConnectionPool

# Raised by SQLite on a UNIQUE violation; the app catches this by name.
IntegrityError = psycopg.IntegrityError
UniqueViolation = pg_errors.UniqueViolation

_PLACEHOLDER_RE = re.compile(r"'[^']*'|\?")
_INSERT_OR_IGNORE_RE = re.compile(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", re.IGNORECASE)
_INSERT_OR_REPLACE_RE = re.compile(r"\bINSERT\s+OR\s+REPLACE\s+INTO\b", re.IGNORECASE)
_PRAGMA_RE = re.compile(r"^\s*PRAGMA\b", re.IGNORECASE)
# SQLite transaction/maintenance verbs that psycopg handles itself. A connection
# from the pool is already inside a transaction (autocommit=False), and db()
# commits or rolls back around the whole unit of work, so these are dropped.
_NOOP_RE = re.compile(r"^\s*(BEGIN|COMMIT|END|ROLLBACK|VACUUM|ANALYZE|REINDEX)\b", re.IGNORECASE)
_HAS_CONFLICT_RE = re.compile(r"\bON\s+CONFLICT\b", re.IGNORECASE)


def resolve_database_url() -> str:
    """Prefer the environment; fall back to a local neondb.txt during development."""
    url = (os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL") or "").strip()
    if not url:
        drop = Path(__file__).resolve().parent.parent / "neondb.txt"
        if drop.exists():
            found = re.search(r"postgres(?:ql)?://\S+", drop.read_text(encoding="utf-8"))
            if found:
                url = found.group(0).strip().rstrip("'\"")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Point it at your Neon connection string "
            "(the -pooler host for the app, the direct host for migrations)."
        )
    # psycopg does not understand this libpq-style alias.
    return url.replace("postgres://", "postgresql://", 1)


def direct_url(url: str) -> str:
    """Neon's pooler cannot run DDL reliably; schema work uses the direct endpoint."""
    return url.replace("-pooler.", ".")


def translate(sql: str) -> str:
    """Rewrite a SQLite statement into its Postgres equivalent."""
    if _PRAGMA_RE.match(sql) or _NOOP_RE.match(sql):
        return ""
    sql = _INSERT_OR_IGNORE_RE.sub("INSERT INTO", sql)
    sql = _INSERT_OR_REPLACE_RE.sub("INSERT INTO", sql)
    # Only substitute placeholders outside quoted literals.
    sql = _PLACEHOLDER_RE.sub(lambda m: "%s" if m.group(0) == "?" else m.group(0), sql)
    return sql


def _needs_conflict_guard(original: str, translated: str) -> bool:
    return bool(_INSERT_OR_IGNORE_RE.search(original)) and not _HAS_CONFLICT_RE.search(translated)


class Row(dict):
    """Dict row that also answers positional access, so ``row[0]`` still works."""

    __slots__ = ()

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        if isinstance(key, slice):
            return list(self.values())[key]
        return super().__getitem__(key)

    def keys(self):  # noqa: D102 - dict passthrough, kept explicit for clarity
        return super().keys()


def _row_factory(cursor):
    names = [c.name for c in (cursor.description or [])]

    def make(values):
        return Row(zip(names, values))

    return make


class Result:
    """Mimics the subset of ``sqlite3.Cursor`` the application relies on."""

    def __init__(self, cursor, connection):
        self._cursor = cursor
        self._connection = connection
        self._rows = None
        if cursor.description is not None:
            self._rows = cursor.fetchall()

    def fetchone(self):
        if self._rows is None:
            return None
        return self._rows.pop(0) if self._rows else None

    def fetchall(self):
        if self._rows is None:
            return []
        rows, self._rows = self._rows, []
        return rows

    def __iter__(self):
        return iter(self.fetchall())

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        """Postgres has no lastrowid; lastval() is per-session and safe here
        because each request holds its own connection for the whole unit of work."""
        try:
            with self._connection.cursor() as cur:
                cur.execute("SELECT lastval()")
                found = cur.fetchone()
                return found[0] if found else None
        except psycopg.Error:
            return None


class Connection:
    """Thin ``sqlite3.Connection`` lookalike over a psycopg connection."""

    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        translated = translate(sql)
        if not translated.strip():
            return Result(_NullCursor(), self._raw)
        if _needs_conflict_guard(sql, translated):
            translated = translated.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
        cur = self._raw.cursor(row_factory=_row_factory)
        cur.execute(translated, tuple(params) if params else None)
        return Result(cur, self._raw)

    def executemany(self, sql, seq_of_params):
        translated = translate(sql)
        if _needs_conflict_guard(sql, translated):
            translated = translated.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
        cur = self._raw.cursor(row_factory=_row_factory)
        cur.executemany(translated, [tuple(p) for p in seq_of_params])
        return Result(cur, self._raw)

    def executescript(self, script):
        for statement in split_statements(script):
            self.execute(statement)
        return self

    def commit(self):
        self._raw.commit()

    def rollback(self):
        self._raw.rollback()

    def close(self):
        pass  # lifecycle belongs to the pool

    @property
    def raw(self):
        return self._raw


class _NullCursor:
    description = None
    rowcount = -1

    def fetchall(self):
        return []


def split_statements(script: str):
    """Split a multi-statement script on semicolons outside quoted literals."""
    statements, buf, quote = [], [], None
    for ch in script:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
            buf.append(ch)
            continue
        if ch == ";":
            chunk = "".join(buf).strip()
            if chunk:
                statements.append(chunk)
            buf = []
            continue
        buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            resolve_database_url(),
            min_size=1,
            max_size=int(os.getenv("DB_POOL_MAX", "8")),
            timeout=30,
            kwargs={"autocommit": False},
            open=True,
        )
    return _pool


@contextmanager
def db():
    """Matches the previous sqlite ``db()`` helper: commit on success, rollback on error."""
    with pool().connection() as raw:
        con = Connection(raw)
        try:
            yield con
            raw.commit()
        except Exception:
            raw.rollback()
            raise


@contextmanager
def ddl_connection():
    """A direct (non-pooled) connection for schema work."""
    url = direct_url(resolve_database_url())
    with psycopg.connect(url, autocommit=True, connect_timeout=30) as raw:
        yield Connection(raw)


def add_column(con: Connection, table: str, definition: str):
    """Postgres can do this natively, unlike the SQLite PRAGMA dance it replaces."""
    name = definition.split()[0]
    rest = definition[len(name):].strip()
    # NOT NULL with a DEFAULT is fine; NOT NULL without one fails on a non-empty table.
    con.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {rest}')
