"""
Catálogo: colecciones y productos listos para imprimir. Cada producto apunta a un modelo
subido (un archivo como los de los clientes), así que se cotiza y se pide con el mismo flujo.
Los llaveros con nombre se generan con OpenSCAD a partir del texto del cliente.
"""

import hashlib
import logging
import re
import secrets
import shutil
import threading
import unicodedata
from pathlib import Path
from typing import BinaryIO, Literal

from pydantic import BaseModel, Field

from .importer import DownloadError, combine_parts, download, drive_thumbnail, load_manifest, source_url
from .openscad import OpenScad, OpenScadError
from .schemas import QuoteRequest
from .service import QuoteService, UploadError
from .settings import API_ROOT
from .store import Store

log = logging.getLogger(__name__)

IMAGE_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
MAX_IMAGE_MB = 8
KEYCHAIN_TEMPLATE = API_ROOT / "config" / "templates" / "llavero_nombre.scad"
# Nombre de ejemplo para calcular el precio "desde" de los llaveros con nombre.
KEYCHAIN_SAMPLE = "Ana"
NAME_MAX = 14

Badge = Literal["viral", "mas_pedido", "nuevo"]

KEYCHAIN_SIZES = [
    {"label": "Pequeño", "scale": 80},
    {"label": "Normal", "scale": 100},
    {"label": "Grande", "scale": 130},
]

DEFAULT_SIZES = [{"label": "S", "scale": 75}, {"label": "M", "scale": 100}, {"label": "L", "scale": 150}]

# Colecciones de la tienda; las que falten se crean al arrancar.
SEED = [
    ("mas-pedido", "Lo más pedido", "🔥", "Lo que más nos piden: fidgets, juguetes sensoriales, utilidades y regalos."),
    ("virales", "Novedades virales", "✨", "Lo último que se volvió viral, listo para imprimir."),
    ("redes", "Virales de redes sociales", "📱", "Los proyectos que se ven en TikTok, Instagram y YouTube."),
    ("llaveros", "Llaveros", "🔑", "Animalitos articulados, personajes flexibles y llaveros con tu nombre."),
    ("personajes", "Personajes y figuras", "🦸", "Figuras para armar, articuladas y multipartes."),
]
# Colecciones de la primera versión que se quitan si siguen vacías.
RETIRED = {"flexibles", "hogar", "decoracion", "vehiculos", "regalos"}
RENAMED = {"virales": "Virales de redes"}
# Más piezas que esto no se arman en un 3MF: mejor que el taller lo cotice.
MAX_PARTS = 30


class CollectionIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: str = Field(default="", max_length=300)
    emoji: str = Field(default="", max_length=8)
    sort: int = 0
    published: bool = True


class Size(BaseModel):
    label: str = Field(min_length=1, max_length=12)
    scale: float = Field(ge=10, le=400)


class ProductIn(BaseModel):
    collection_id: str = Field(max_length=60)
    name: str = Field(min_length=2, max_length=80)
    subsection: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=1000)
    badges: list[Badge] = []
    sizes: list[Size] = Field(default_factory=lambda: [Size(**s) for s in DEFAULT_SIZES], min_length=1, max_length=6)
    default_color: str = Field(default="", max_length=40)
    sort: int = 0
    published: bool = False


class Personalize(BaseModel):
    text: str = Field(min_length=1, max_length=NAME_MAX)


class ShopError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:50] or "item"


def clean_name(text: str) -> str:
    """Texto del llavero: sin saltos ni caracteres de control, espacios simples."""
    text = "".join(c for c in text if unicodedata.category(c)[0] != "C")
    return " ".join(text.split())[:NAME_MAX]


class Shop:
    def __init__(self, store: Store, quotes: QuoteService, openscad: OpenScad):
        self.store = store
        self.quotes = quotes
        self.openscad = openscad
        self.images_dir = quotes.settings.data_dir / "catalog" / "images"
        self.names_dir = quotes.settings.data_dir / "catalog" / "names"
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.names_dir.mkdir(parents=True, exist_ok=True)
        self.downloads_dir = quotes.settings.data_dir / "catalog" / "downloads"
        self._pricing: set[str] = set()
        self._locks: dict[str, threading.Lock] = {}
        self._locks_guard = threading.Lock()

    def seed(self) -> None:
        fresh = not self.store.collections()
        existing = {c["id"]: c for c in self.store.collections()}
        for i, (cid, name, emoji, desc) in enumerate(SEED):
            c = existing.get(cid)
            if not c or c["name"] == RENAMED.get(cid):
                self.store.save_collection({
                    "id": cid, "name": name, "emoji": emoji, "description": desc, "sort": i, "published": True,
                    "cover": c["cover"] if c else None,
                })  # fmt: skip
        for cid in RETIRED & existing.keys():
            if not self.store.products(cid):
                self.store.delete_collection(cid)
        if not fresh:
            return
        self.store.save_product({
            "id": "llavero-con-tu-nombre",
            "collection_id": "llaveros",
            "kind": "name_keychain",
            "name": "Llavero con tu nombre",
            "subsection": "Personalizados",
            "description": "Escribe el nombre que quieras y lo imprimimos en relieve, con argolla para tus llaves.",
            "badges": ["mas_pedido"],
            "images": [],
            "sizes": KEYCHAIN_SIZES,
            "default_color": "Naranja",
            "file_id": None,
            "price_quote_id": None,
            "sort": 0,
            "published": True,
        })  # fmt: skip

    def import_catalog(self, path: Path | None) -> int:
        """Crea los productos del catálogo inicial que no se hayan importado antes."""
        done = self.store.imported_keys()
        n = 0
        for i, item in enumerate(load_manifest(path)["products"]):
            if item["key"] in done or not self.store.get_collection(item["collection"]):
                continue
            pid = self._unique(slugify(item["name"]), self.store.get_product)
            self.store.save_product({
                "id": pid, "collection_id": item["collection"], "kind": "model", "name": item["name"],
                "subsection": item.get("subsection", ""), "description": item.get("description", ""),
                "badges": item.get("badges", []), "images": [], "sizes": item.get("sizes") or DEFAULT_SIZES,
                "default_color": "", "file_id": None, "price_quote_id": None, "sort": 10 + i,
                "published": not item.get("brand"), "price_hint": item.get("price"),
                "source": {k: item[k] for k in ("model", "parts", "image") if item.get(k)},
            })  # fmt: skip
            self.store.mark_imported(item["key"])
            n += 1
        return n

    def localize_images(self) -> None:
        """Baja las fotos de los productos importados para no depender de Drive ni de otros sitios."""
        for p in self.store.products():
            src = (p["source"] or {}).get("image")
            if p["images"] or not src:
                continue
            tmp = self.images_dir / f"{p['id']}.part"
            try:
                data = download(source_url(src), tmp, MAX_IMAGE_MB).read_bytes()
            except DownloadError as e:
                log.warning("No se pudo bajar la foto de %s: %s", p["id"], e)
                continue
            finally:
                tmp.unlink(missing_ok=True)
            ext = "png" if data[:4] == b"\x89PNG" else "webp" if data[:4] == b"RIFF" else "jpg"
            if not _looks_like_image(data):
                continue
            name = f"{secrets.token_hex(12)}.{ext}"
            (self.images_dir / name).write_bytes(data)
            current = self.store.get_product(p["id"])
            if current and not current["images"]:
                self.store.save_product({**current, "images": [name]})

    def prepare(self, pid: str) -> str:
        """Modelo listo para ver y cotizar; si el producto es importado, lo baja la primera vez."""
        p = self.store.get_product(pid)
        if not p or not self.visible(p) or p["kind"] != "model":
            raise ShopError("Producto no encontrado", 404)
        if p["file_id"]:
            return p["file_id"]
        with self._lock(pid):
            p = self.store.get_product(pid)
            if p["file_id"]:
                return p["file_id"]
            src = p["source"] or {}
            folder = self.downloads_dir / pid
            folder.mkdir(parents=True, exist_ok=True)
            limit = self.quotes.settings.max_upload_mb
            try:
                if src.get("model"):
                    ext = src["model"]["name"].rsplit(".", 1)[-1].lower()
                    path = download(source_url(src["model"]), folder / f"modelo.{ext}", limit)
                else:
                    parts = [download(source_url(x), folder / f"{i}.stl", limit) for i, x in enumerate(src["parts"])]
                    path = combine_parts(parts, folder / "modelo.3mf", self.quotes.catalog.printer.bed)
                with path.open("rb") as f:
                    file_id = self.quotes.save_upload(f"{p['name']}{path.suffix}", f)["id"]
            except (DownloadError, UploadError, ValueError) as e:
                log.warning("No se pudo preparar %s: %s", pid, e)
                raise ShopError("No pudimos preparar este modelo. Escríbenos por WhatsApp y lo cotizamos.", 502) from e
            finally:
                shutil.rmtree(folder, ignore_errors=True)
            self.store.save_product({**self.store.get_product(pid), "file_id": file_id})
            self.refresh_price(pid)
            return file_id

    def _lock(self, pid: str) -> threading.Lock:
        with self._locks_guard:
            return self._locks.setdefault(pid, threading.Lock())

    # Lectura pública

    def _price_from(self, p: dict) -> int | None:
        has_model = p["file_id"] or p["kind"] == "name_keychain"
        if not p.get("price_quote_id") and p["id"] not in self._pricing and has_model and self.ready(p):
            # Sin precio todavía (por ejemplo el llavero recién creado): se calcula en segundo plano.
            self._pricing.add(p["id"])
            self.quotes.pool.submit(self.refresh_price, p["id"])
        q = self.store.get_quote(p["price_quote_id"]) if p.get("price_quote_id") else None
        price = (q or {}).get("result", {}) if q else None
        return int(price["price"]["total"]) if price and price.get("price") else p.get("price_hint")

    def product_out(self, p: dict, admin: bool = False) -> dict:
        out = {
            "id": p["id"],
            "collection_id": p["collection_id"],
            "kind": p["kind"],
            "name": p["name"],
            "subsection": p["subsection"],
            "description": p["description"],
            "badges": p["badges"],
            "images": p["images"] or _preview(p),
            "sizes": p["sizes"],
            "default_color": p["default_color"],
            "file_id": p["file_id"],
            "price_from": self._price_from(p),
            "personalize": {"max_length": NAME_MAX} if p["kind"] == "name_keychain" else None,
        }
        if admin:
            out |= {"published": p["published"], "sort": p["sort"], "ready": self.ready(p)}
        return out

    def ready(self, p: dict) -> bool:
        """El producto tiene con qué imprimirse: un modelo, o OpenSCAD para el nombre."""
        if p["kind"] == "name_keychain":
            return self.openscad.available
        src = p["source"] or {}
        return bool(p["file_id"] or src.get("model") or 0 < len(src.get("parts", [])) <= MAX_PARTS)

    def visible(self, p: dict) -> bool:
        return p["published"] and self.ready(p)

    def collections_out(self) -> list[dict]:
        out = []
        for c in self.store.collections():
            if not c["published"]:
                continue
            products = [p for p in self.store.products(c["id"]) if self.visible(p)]
            if not products:
                continue
            prices = [x for x in (self._price_from(p) for p in products) if x]
            photos = [p["images"] or _preview(p) for p in products]
            cover = c["cover"] or next((x[0] for x in photos if x), None)
            out.append({**_collection(c, cover), "count": len(products), "price_from": min(prices) if prices else None})
        return out

    def collection_out(self, cid: str) -> dict:
        c = self.store.get_collection(cid)
        if not c or not c["published"]:
            raise ShopError("Colección no encontrada", 404)
        products = [self.product_out(p) for p in self.store.products(cid) if self.visible(p)]
        return {**_collection(c, c["cover"]), "products": products}

    def get_product(self, pid: str) -> dict:
        p = self.store.get_product(pid)
        if not p or not self.visible(p):
            raise ShopError("Producto no encontrado", 404)
        c = self.store.get_collection(p["collection_id"])
        return {**self.product_out(p), "collection": {"id": c["id"], "name": c["name"], "emoji": c["emoji"]}}

    def image_path(self, name: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{24}\.(jpg|jpeg|png|webp)", name):
            raise ShopError("Imagen no encontrada", 404)
        path = self.images_dir / name
        if not path.exists():
            raise ShopError("Imagen no encontrada", 404)
        return path

    # Llavero con nombre

    def personalize(self, pid: str, text: str) -> str:
        """Genera (o reutiliza) el modelo con el texto del cliente y devuelve su file_id."""
        p = self.store.get_product(pid)
        if not p or p["kind"] != "name_keychain" or not self.visible(p):
            raise ShopError("Producto no encontrado", 404)
        name = clean_name(text)
        if not name:
            raise ShopError("Escribe el nombre", 422)
        return self._keychain_file(name)

    def _keychain_file(self, name: str) -> str:
        file_name = f"Llavero {name}.stl"
        existing = self.store.file_by_name(file_name)
        if existing:
            return existing["id"]
        if not self.openscad.available:
            raise ShopError("Por ahora no podemos generar llaveros con nombre; escríbenos por WhatsApp", 503)
        out = self.names_dir / f"{hashlib.sha256(name.encode()).hexdigest()[:24]}.stl"
        try:
            self.openscad.render(KEYCHAIN_TEMPLATE, out, {"name": name})
        except OpenScadError as e:
            raise ShopError(f"No pudimos generar el llavero: {e}", 422) from e
        with out.open("rb") as f:
            return self.quotes.save_upload(file_name, f)["id"]

    # Panel

    def admin_out(self) -> list[dict]:
        products = self.store.products()
        return [
            {
                **_collection(c, c["cover"]),
                "published": c["published"],
                "sort": c["sort"],
                "products": [self.product_out(p, admin=True) for p in products if p["collection_id"] == c["id"]],
            }
            for c in self.store.collections()
        ]

    def save_collection(self, data: CollectionIn, cid: str | None = None) -> dict:
        current = self.store.get_collection(cid) if cid else None
        if cid and not current:
            raise ShopError("Colección no encontrada", 404)
        if not cid:
            cid = self._unique(slugify(data.name), self.store.get_collection)
        self.store.save_collection({**data.model_dump(), "id": cid, "cover": current["cover"] if current else None})
        return self.store.get_collection(cid)

    def delete_collection(self, cid: str) -> None:
        if self.store.products(cid):
            raise ShopError("Primero mueve o borra los productos de esta colección", 409)
        self.store.delete_collection(cid)

    def save_product(self, data: ProductIn, pid: str | None = None) -> dict:
        if not self.store.get_collection(data.collection_id):
            raise ShopError("Colección no encontrada", 404)
        current = self.store.get_product(pid) if pid else None
        if pid and not current:
            raise ShopError("Producto no encontrado", 404)
        if not pid:
            pid = self._unique(slugify(data.name), self.store.get_product)
        fields = data.model_dump()
        fields["sizes"] = [s.model_dump() for s in data.sizes]
        keep = current or {"kind": "model", "images": [], "file_id": None, "price_quote_id": None, "source": None}
        self.store.save_product({**keep, **fields, "id": pid})
        if not current or current["sizes"] != fields["sizes"]:
            self.refresh_price(pid)
        return self.product_out(self.store.get_product(pid), admin=True)

    def delete_product(self, pid: str) -> None:
        p = self.store.get_product(pid)
        if not p:
            raise ShopError("Producto no encontrado", 404)
        for img in p["images"]:
            (self.images_dir / img).unlink(missing_ok=True)
        self.store.delete_product(pid)

    def set_model(self, pid: str, filename: str, stream: BinaryIO) -> dict:
        p = self.store.get_product(pid)
        if not p or p["kind"] != "model":
            raise ShopError("Producto no encontrado", 404)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "stl"
        try:
            f = self.quotes.save_upload(f"{p['name']}.{ext}", stream)
        except UploadError as e:
            raise ShopError(str(e), e.status) from e
        self.store.save_product({**p, "file_id": f["id"]})
        self.refresh_price(pid)
        return self.product_out(self.store.get_product(pid), admin=True)

    def add_image(self, target: tuple[str, str], filename: str, data: bytes) -> str:
        """Guarda una foto de producto o la portada de una colección; devuelve su nombre."""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in IMAGE_TYPES or not _looks_like_image(data):
            raise ShopError("Sube una imagen JPG, PNG o WEBP", 415)
        if len(data) > MAX_IMAGE_MB * 1024 * 1024:
            raise ShopError(f"La imagen supera {MAX_IMAGE_MB} MB", 413)
        kind, id_ = target
        owner = self.store.get_product(id_) if kind == "product" else self.store.get_collection(id_)
        if not owner:
            raise ShopError("No encontrado", 404)
        name = f"{secrets.token_hex(12)}.{ext}"
        (self.images_dir / name).write_bytes(data)
        if kind == "product":
            self.store.save_product({**owner, "images": [*owner["images"], name]})
        else:
            if owner["cover"]:
                (self.images_dir / owner["cover"]).unlink(missing_ok=True)
            self.store.save_collection({**owner, "cover": name})
        return name

    def remove_image(self, pid: str, name: str) -> dict:
        p = self.store.get_product(pid)
        if not p or name not in p["images"]:
            raise ShopError("Imagen no encontrada", 404)
        (self.images_dir / name).unlink(missing_ok=True)
        self.store.save_product({**p, "images": [i for i in p["images"] if i != name]})
        return self.product_out(self.store.get_product(pid), admin=True)

    def refresh_price(self, pid: str) -> None:
        """Precio "desde": el tamaño más pequeño en PLA, calidad estándar y 20 % de relleno."""
        p = self.store.get_product(pid)
        if not p:
            return
        try:
            file_id = p["file_id"] if p["kind"] == "model" else self._keychain_file(KEYCHAIN_SAMPLE)
        except ShopError:
            file_id = None
        if not file_id:
            return
        smallest = min(s["scale"] for s in p["sizes"])
        q = self.quotes.create_quote(
            QuoteRequest(file_id=file_id, material="PLA", quality="estandar", infill=20, scale=smallest)
        )
        self.store.save_product({**self.store.get_product(pid), "price_quote_id": q["id"]})

    @staticmethod
    def _unique(base: str, exists) -> str:
        slug, n = base, 2
        while exists(slug):
            slug, n = f"{base}-{n}", n + 1
        return slug


def _collection(c: dict, cover: str | None) -> dict:
    return {"id": c["id"], "name": c["name"], "emoji": c["emoji"], "description": c["description"], "cover": cover}


def _preview(p: dict) -> list[str]:
    """Foto de un producto importado mientras se descarga: el enlace original."""
    src = (p["source"] or {}).get("image")
    if not src:
        return []
    return [drive_thumbnail(src["drive"]) if "drive" in src else src["url"]]


def _looks_like_image(data: bytes) -> bool:
    return (
        data[:3] == b"\xff\xd8\xff"
        or data[:8] == b"\x89PNG\r\n\x1a\n"
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )
