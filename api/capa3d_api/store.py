"""Persistencia en SQLite: archivos subidos y cotizaciones."""

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  size INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  params TEXT NOT NULL,
  params_key TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  valid_until TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_key ON quotes(file_id, params_key);
"""

# Columnas agregadas después de la primera versión: (tabla, columna, tipo).
MIGRATIONS = [
    ("quotes", "requested_at", "TEXT"),
    ("quotes", "requested_color", "TEXT"),
]


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._db.executescript(SCHEMA)
            for table, column, kind in MIGRATIONS:
                cols = {r["name"] for r in self._db.execute(f"PRAGMA table_info({table})")}
                if column not in cols:
                    self._db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")
            # Trabajos que quedaron a medias si el servidor se reinició.
            self._db.execute(
                "UPDATE quotes SET status='failed', error='El servidor se reinició' WHERE status='pending'"
            )
            self._db.commit()

    def _exec(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
            self._db.commit()
            return rows

    # Archivos

    def add_file(self, id: str, name: str, format: str, size: int, summary: dict[str, Any]) -> None:
        self._exec("INSERT INTO files VALUES (?,?,?,?,?,?)", (id, name, format, size, json.dumps(summary), now()))

    def get_file(self, id: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT * FROM files WHERE id=?", (id,))
        if not rows:
            return None
        r = dict(rows[0])
        r["summary"] = json.loads(r["summary"])
        return r

    # Cotizaciones

    def add_quote(self, id: str, file_id: str, params: dict, key: str, valid_until: str) -> None:
        self._exec(
            "INSERT INTO quotes (id,file_id,params,params_key,status,created_at,valid_until) VALUES (?,?,?,?,?,?,?)",
            (id, file_id, json.dumps(params), key, "pending", now(), valid_until),
        )

    def finish_quote(self, id: str, result: dict | None, error: str | None) -> None:
        status = "done" if result is not None else "failed"
        self._exec(
            "UPDATE quotes SET status=?, result=?, error=? WHERE id=?",
            (status, json.dumps(result) if result is not None else None, error, id),
        )

    def get_quote(self, id: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT * FROM quotes WHERE id=?", (id,))
        return _quote(rows[0]) if rows else None

    def find_quote(self, file_id: str, key: str) -> dict[str, Any] | None:
        """Cotización vigente con los mismos parámetros (pendiente o lista)."""
        rows = self._exec(
            "SELECT * FROM quotes WHERE file_id=? AND params_key=? AND status IN ('pending','done') AND valid_until>?"
            " ORDER BY created_at DESC LIMIT 1",
            (file_id, key, now()),
        )
        return _quote(rows[0]) if rows else None

    def mark_requested(self, id: str, color: str | None) -> bool:
        """El cliente tocó "Pedir por WhatsApp" con esta cotización."""
        with self._lock:
            cur = self._db.execute("UPDATE quotes SET requested_at=?, requested_color=? WHERE id=?", (now(), color, id))
            self._db.commit()
            return cur.rowcount > 0

    def list_quotes(self, limit: int, requested_only: bool) -> list[dict[str, Any]]:
        """Cotizaciones más recientes primero, con el nombre del archivo."""
        where = "WHERE q.requested_at IS NOT NULL" if requested_only else ""
        rows = self._exec(
            f"SELECT q.*, f.name AS file_name, f.format AS file_format, f.summary AS file_summary FROM quotes q "
            f"JOIN files f ON f.id = q.file_id {where} ORDER BY q.created_at DESC, q.rowid DESC LIMIT ?",
            (limit,),
        )
        out = []
        for row in rows:
            q = _quote(row)
            q["file_summary"] = json.loads(q["file_summary"])
            out.append(q)
        return out


def _quote(row: sqlite3.Row) -> dict[str, Any]:
    r = dict(row)
    r["params"] = json.loads(r["params"])
    r["result"] = json.loads(r["result"]) if r["result"] else None
    return r
