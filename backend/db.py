"""Safe SQLite persistence and synchronized FTS5 search."""
import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from .models import DocUpdateItem


SCHEMA = """
CREATE TABLE IF NOT EXISTS doc_updates (
    entry_id TEXT PRIMARY KEY,
    ecosystem TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL,
    plain_summary TEXT NOT NULL,
    affected_code TEXT NOT NULL,
    source_url TEXT NOT NULL,
    discovered_at TIMESTAMP NOT NULL,
    execution_engine TEXT NOT NULL,
    scraped_at TIMESTAMP NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS doc_updates_fts USING fts5(
    entry_id UNINDEXED,
    ecosystem,
    title,
    plain_summary,
    affected_code,
    content='doc_updates',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS doc_updates_ai AFTER INSERT ON doc_updates BEGIN
    INSERT INTO doc_updates_fts(rowid, entry_id, ecosystem, title, plain_summary, affected_code)
    VALUES (new.rowid, new.entry_id, new.ecosystem, new.title, new.plain_summary, new.affected_code);
END;

CREATE TRIGGER IF NOT EXISTS doc_updates_ad AFTER DELETE ON doc_updates BEGIN
    INSERT INTO doc_updates_fts(doc_updates_fts, rowid, entry_id, ecosystem, title, plain_summary, affected_code)
    VALUES ('delete', old.rowid, old.entry_id, old.ecosystem, old.title, old.plain_summary, old.affected_code);
END;

CREATE TRIGGER IF NOT EXISTS doc_updates_au AFTER UPDATE ON doc_updates BEGIN
    INSERT INTO doc_updates_fts(doc_updates_fts, rowid, entry_id, ecosystem, title, plain_summary, affected_code)
    VALUES ('delete', old.rowid, old.entry_id, old.ecosystem, old.title, old.plain_summary, old.affected_code);
    INSERT INTO doc_updates_fts(rowid, entry_id, ecosystem, title, plain_summary, affected_code)
    VALUES (new.rowid, new.entry_id, new.ecosystem, new.title, new.plain_summary, new.affected_code);
END;
"""


class Database:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self.initialize()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def initialize(self) -> None:
        with self.connection() as conn:
            conn.executescript(SCHEMA)

    def upsert_updates(self, items: list[DocUpdateItem]) -> int:
        if not items:
            return 0
        with self.connection() as conn:
            for item in items:
                conn.execute(
                    """INSERT INTO doc_updates (
                        entry_id, ecosystem, title, category, urgency,
                        plain_summary, affected_code, source_url, discovered_at,
                        execution_engine, scraped_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(entry_id) DO UPDATE SET
                        ecosystem=excluded.ecosystem,
                        title=excluded.title,
                        category=excluded.category,
                        urgency=excluded.urgency,
                        plain_summary=excluded.plain_summary,
                        affected_code=excluded.affected_code,
                        source_url=excluded.source_url,
                        discovered_at=excluded.discovered_at,
                        execution_engine=excluded.execution_engine,
                        scraped_at=excluded.scraped_at""",
                    (
                        item.entry_id,
                        item.ecosystem,
                        item.title,
                        item.category,
                        item.urgency,
                        item.plain_summary,
                        json.dumps(item.affected_code),
                        str(item.source_url),
                        item.discovered_at.isoformat(),
                        item.execution_engine,
                        item.scraped_at.isoformat(),
                    ),
                )
            return len(items)

    def _row(self, row: sqlite3.Row) -> dict:
        result = dict(row)
        try:
            result["affected_code"] = json.loads(result["affected_code"])
        except (ValueError, TypeError):
            result["affected_code"] = []
        return result

    def latest(self, ecosystem: str | None = None, limit: int = 100) -> list[dict]:
        with self.connection() as conn:
            query = "SELECT * FROM doc_updates"
            args: list[object] = []
            if ecosystem and ecosystem.lower() != "all":
                query += " WHERE LOWER(ecosystem) = LOWER(?)"
                args.append(ecosystem)
            query += " ORDER BY discovered_at DESC LIMIT ?"
            args.append(limit)
            rows = conn.execute(query, args).fetchall()
            return [self._row(r) for r in rows]

    def search(self, query: str, ecosystem: str | None = None, limit: int = 50) -> list[dict]:
        clean_terms = re.findall(r"[A-Za-z0-9_]+", query)
        if not clean_terms:
            return self.latest(ecosystem=ecosystem, limit=limit)

        # Build FTS queries: try exact/AND terms first, then OR terms
        fts_and_query = " ".join(f'"{term}"*' for term in clean_terms)
        fts_or_query = " OR ".join(f'"{term}"*' for term in clean_terms)

        with self.connection() as conn:
            for fts_q in [fts_and_query, fts_or_query]:
                try:
                    sql = (
                        "SELECT d.* FROM doc_updates_fts f "
                        "JOIN doc_updates d ON d.rowid=f.rowid "
                        "WHERE doc_updates_fts MATCH ?"
                    )
                    args: list[object] = [fts_q]
                    if ecosystem and ecosystem.lower() != "all":
                        sql += " AND LOWER(d.ecosystem) = LOWER(?)"
                        args.append(ecosystem)
                    sql += " ORDER BY d.discovered_at DESC LIMIT ?"
                    args.append(limit)
                    rows = conn.execute(sql, args).fetchall()
                    if rows:
                        return [self._row(r) for r in rows]
                except sqlite3.OperationalError:
                    continue

            # Fallback to standard LIKE search
            sql = (
                "SELECT * FROM doc_updates WHERE "
                "(title LIKE ? OR plain_summary LIKE ? OR affected_code LIKE ?)"
            )
            like_term = f"%{clean_terms[0]}%"
            args = [like_term, like_term, like_term]
            if ecosystem and ecosystem.lower() != "all":
                sql += " AND LOWER(ecosystem) = LOWER(?)"
                args.append(ecosystem)
            sql += " ORDER BY discovered_at DESC LIMIT ?"
            args.append(limit)
            rows = conn.execute(sql, args).fetchall()
            return [self._row(r) for r in rows]

    def counts(self) -> dict:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT ecosystem, urgency, COUNT(*) as count FROM doc_updates GROUP BY ecosystem, urgency"
            ).fetchall()
        return {f"{r['ecosystem']}:{r['urgency']}": r["count"] for r in rows}

    def count(self) -> int:
        with self.connection() as conn:
            row = conn.execute("SELECT COUNT(*) FROM doc_updates").fetchone()
            return int(row[0]) if row else 0

    def clear(self) -> int:
        """Truncate doc_updates table and FTS search index."""
        with self.connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM doc_updates")
            cursor.execute("DELETE FROM doc_updates_fts")
            return cursor.rowcount
