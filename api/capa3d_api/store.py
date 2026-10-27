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


def _quote(row: sqlite3.Row) -> dict[str, Any]:
    r = dict(row)
    r["params"] = json.loads(r["params"])
    r["result"] = json.loads(r["result"]) if r["result"] else None
    return r
