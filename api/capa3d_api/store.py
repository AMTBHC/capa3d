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
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  status TEXT NOT NULL,
  customer TEXT NOT NULL,
  color TEXT,
  print_price INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  carrier TEXT,
  tracking TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '',
  cover TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id),
  kind TEXT NOT NULL DEFAULT 'model',
  name TEXT NOT NULL,
  subsection TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  badges TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  sizes TEXT NOT NULL DEFAULT '[]',
  default_color TEXT NOT NULL DEFAULT '',
  file_id TEXT,
  price_quote_id TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_imports (
  key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  reference TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
"""

# Columnas agregadas después de la primera versión: (tabla, columna, tipo).
MIGRATIONS = [
    ("quotes", "requested_at", "TEXT"),
    ("quotes", "requested_color", "TEXT"),
    # Pago total ("full") o abono con saldo contra entrega ("deposit").
    ("orders", "plan", "TEXT"),
    ("orders", "paid_amount", "INTEGER NOT NULL DEFAULT 0"),
    # Sube con cada cambio del pedido o de sus pagos: la actualización en vivo lo vigila.
    ("orders", "version", "INTEGER NOT NULL DEFAULT 0"),
    # Productos importados: de dónde bajar el modelo y la foto, y su precio de referencia.
    ("products", "source", "TEXT"),
    ("products", "price_hint", "INTEGER"),
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

    def update_file_summary(self, id: str, summary: dict[str, Any]) -> None:
        self._exec("UPDATE files SET summary=? WHERE id=?", (json.dumps(summary), id))

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

    # Pedidos

    def add_order(self, order: dict[str, Any]) -> None:
        o = {**order, "customer": json.dumps(order["customer"]), "created_at": now(), "updated_at": now()}
        cols = ", ".join(o)
        self._exec(f"INSERT INTO orders ({cols}) VALUES ({', '.join('?' * len(o))})", tuple(o.values()))

    def update_order(self, id: str, **fields: Any) -> None:
        fields["updated_at"] = now()
        sets = ", ".join(f"{k}=?" for k in fields)
        self._exec(f"UPDATE orders SET {sets}, version=version+1 WHERE id=?", (*fields.values(), id))

    def order_version(self, id: str) -> int | None:
        rows = self._exec("SELECT version FROM orders WHERE id=?", (id,))
        return rows[0]["version"] if rows else None

    def orders_version(self) -> tuple[int, int]:
        """(cantidad de pedidos, suma de versiones): cambia con cualquier pedido nuevo o modificado."""
        r = self._exec("SELECT COUNT(*) AS n, COALESCE(SUM(version), 0) AS v FROM orders")[0]
        return r["n"], r["v"]

    def count_by_status(self) -> dict[str, int]:
        return {r["status"]: r["n"] for r in self._exec("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")}

    def orders_by_contact(self, email: str, phone_tail: str) -> list[dict[str, Any]]:
        """Pedidos con este correo y un celular que termine en estos dígitos."""
        rows = self._exec(
            "SELECT * FROM orders WHERE lower(json_extract(customer, '$.email')) = ? "
            "AND substr(json_extract(customer, '$.phone'), -10) = ? ORDER BY created_at DESC LIMIT 50",
            (email, phone_tail),
        )
        return [_order(r) for r in rows]

    def get_order(self, id: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT * FROM orders WHERE id=?", (id,))
        return _order(rows[0]) if rows else None

    def list_orders(self, statuses: list[str] | None, limit: int) -> list[dict[str, Any]]:
        if statuses:
            marks = ", ".join("?" * len(statuses))
            rows = self._exec(
                f"SELECT * FROM orders WHERE status IN ({marks}) ORDER BY created_at DESC, rowid DESC LIMIT ?",
                (*statuses, limit),
            )
        else:
            rows = self._exec("SELECT * FROM orders ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,))
        return [_order(r) for r in rows]

    def add_event(self, order_id: str, status: str, note: str | None = None) -> None:
        self._exec(
            "INSERT INTO order_events (order_id, status, note, created_at) VALUES (?,?,?,?)",
            (order_id, status, note, now()),
        )

    def events(self, order_id: str) -> list[dict[str, Any]]:
        rows = self._exec("SELECT status, note, created_at FROM order_events WHERE order_id=? ORDER BY id", (order_id,))
        return [dict(r) for r in rows]

    # Pagos

    def add_payment(self, reference: str, order_id: str, amount: int) -> None:
        self._exec(
            "INSERT INTO payments VALUES (?,?,?,?,?,?,?)", (reference, order_id, amount, "PENDING", None, now(), now())
        )

    def get_payment(self, reference: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT * FROM payments WHERE reference=?", (reference,))
        return dict(rows[0]) if rows else None

    def update_payment(self, reference: str, status: str, transaction_id: str) -> None:
        self._exec(
            "UPDATE payments SET status=?, transaction_id=?, updated_at=? WHERE reference=?",
            (status, transaction_id, now(), reference),
        )
        # Un pago rechazado también debe llegar en vivo a la página del pedido.
        self._exec(
            "UPDATE orders SET version=version+1 WHERE id=(SELECT order_id FROM payments WHERE reference=?)",
            (reference,),
        )

    def payments(self, order_id: str) -> list[dict[str, Any]]:
        rows = self._exec("SELECT * FROM payments WHERE order_id=? ORDER BY created_at", (order_id,))
        return [dict(r) for r in rows]

    # Catálogo

    def collections(self) -> list[dict[str, Any]]:
        rows = self._exec("SELECT * FROM collections ORDER BY sort, created_at")
        return [{**dict(r), "published": bool(r["published"])} for r in rows]

    def get_collection(self, id: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT * FROM collections WHERE id=?", (id,))
        return {**dict(rows[0]), "published": bool(rows[0]["published"])} if rows else None

    def save_collection(self, c: dict[str, Any]) -> None:
        cols = ("id", "name", "description", "emoji", "cover", "sort", "published")
        vals = tuple(int(c[k]) if k == "published" else c.get(k) for k in cols)
        self._exec(
            f"INSERT INTO collections ({', '.join(cols)}, created_at) VALUES ({', '.join('?' * len(cols))}, ?) "
            f"ON CONFLICT(id) DO UPDATE SET {', '.join(f'{k}=excluded.{k}' for k in cols[1:])}",
            (*vals, now()),
        )

    def delete_collection(self, id: str) -> None:
        self._exec("DELETE FROM collections WHERE id=?", (id,))

    def products(self, collection_id: str | None = None) -> list[dict[str, Any]]:
        if collection_id:
            rows = self._exec(
                "SELECT * FROM products WHERE collection_id=? ORDER BY sort, created_at", (collection_id,)
            )
        else:
            rows = self._exec("SELECT * FROM products ORDER BY sort, created_at")
        return [_product(r) for r in rows]

    def get_product(self, id: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT * FROM products WHERE id=?", (id,))
        return _product(rows[0]) if rows else None

    def save_product(self, p: dict[str, Any]) -> None:
        cols = (
            "id", "collection_id", "kind", "name", "subsection", "description", "badges", "images", "sizes",
            "default_color", "file_id", "price_quote_id", "sort", "published", "source", "price_hint",
        )  # fmt: skip
        enc = {
            "badges": json.dumps, "images": json.dumps, "sizes": json.dumps, "published": int,
            "source": lambda x: json.dumps(x) if x else None,
        }  # fmt: skip
        vals = tuple(enc.get(k, lambda x: x)(p.get(k)) for k in cols)
        marks = ", ".join("?" * len(cols))
        updates = ", ".join(f"{k}=excluded.{k}" for k in cols[1:])
        self._exec(
            f"INSERT INTO products ({', '.join(cols)}, created_at, updated_at) VALUES ({marks}, ?, ?) "
            f"ON CONFLICT(id) DO UPDATE SET {updates}, updated_at=excluded.updated_at",
            (*vals, now(), now()),
        )

    def delete_product(self, id: str) -> None:
        self._exec("DELETE FROM products WHERE id=?", (id,))

    def imported_keys(self) -> set[str]:
        return {r["key"] for r in self._exec("SELECT key FROM catalog_imports")}

    def mark_imported(self, key: str) -> None:
        self._exec("INSERT OR IGNORE INTO catalog_imports VALUES (?, ?)", (key, now()))

    def file_by_name(self, name: str) -> dict[str, Any] | None:
        rows = self._exec("SELECT id FROM files WHERE name=? ORDER BY created_at DESC LIMIT 1", (name,))
        return self.get_file(rows[0]["id"]) if rows else None


def _product(row: sqlite3.Row) -> dict[str, Any]:
    r = dict(row)
    for k in ("badges", "images", "sizes"):
        r[k] = json.loads(r[k])
    r["source"] = json.loads(r["source"]) if r.get("source") else None
    r["published"] = bool(r["published"])
    return r


def _order(row: sqlite3.Row) -> dict[str, Any]:
    r = dict(row)
    r["customer"] = json.loads(r["customer"])
    return r


def _quote(row: sqlite3.Row) -> dict[str, Any]:
    r = dict(row)
    r["params"] = json.loads(r["params"])
    r["result"] = json.loads(r["result"]) if r["result"] else None
    return r
