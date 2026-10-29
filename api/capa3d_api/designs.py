"""
Diseños a medida: el cliente manda fotos o bocetos de referencia y una descripción; el taller
lo contacta, diseña el modelo y, cuando está listo, lo convierte en un pedido con precio que
el cliente paga como cualquier otro.
"""

import re
import secrets
import shutil
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

from .orders import Customer, OrderError
from .schemas import QuoteRequest
from .service import QuoteService, UploadError
from .settings import Settings
from .store import Store

MAX_IMAGES = 6
MAX_IMAGE_MB = 10
# Fotos del celular (también HEIC de iPhone), capturas y bocetos en PDF.
IMAGE_TYPES = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "pdf": "application/pdf",
}

STATUS_LABEL = {
    "received": "Recibida",
    "designing": "En diseño",
    "proposal": "Propuesta enviada",
    "ordered": "Lista para pagar",
    "cancelled": "Cancelada",
}
STATUS_TEXT = {
    "received": "Recibimos tu solicitud. Revisamos tus referencias y te contactamos por WhatsApp o correo.",
    "designing": "Estamos diseñando tu modelo. Te avisamos cuando tengamos una propuesta.",
    "proposal": "Te enviamos una propuesta por WhatsApp o correo. Cuéntanos si la apruebas o qué cambiarías.",
    "ordered": "Tu diseño está listo. Revisa el pedido con el precio final y págalo para que lo imprimamos.",
    "cancelled": "Esta solicitud se cerró. Si quieres retomarla, escríbenos.",
}
ACTIONS: dict[str, tuple[set[str], str]] = {
    "designing": ({"received", "proposal"}, "designing"),
    "proposal": ({"received", "designing"}, "proposal"),
    "cancel": ({"received", "designing", "proposal"}, "cancelled"),
    "reopen": ({"cancelled"}, "received"),
}

Use = Literal["decoracion", "regalo", "repuesto", "figura", "funcional", "otro"]


class DesignContact(BaseModel):
    """Datos para contactar al cliente; la dirección puede llegar después, al hacer el pedido."""

    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=7, max_length=20)
    email: str = Field(max_length=120)
    city: str = Field(min_length=2, max_length=60)
    department: str = Field(min_length=2, max_length=60)
    address: str = Field(default="", max_length=200)

    _phone = field_validator("phone")(Customer.phone_digits.__func__)  # type: ignore[attr-defined]
    _email = field_validator("email")(Customer.email_format.__func__)  # type: ignore[attr-defined]

    @field_validator("name", "city", "department", "address")
    @classmethod
    def strip(cls, v: str) -> str:
        return " ".join(v.split())


class DesignBrief(BaseModel):
    description: str = Field(min_length=10, max_length=2000)
    use: Use = "otro"
    # Medida aproximada de la pieza, en cm (lo más largo).
    size_cm: float | None = Field(default=None, gt=0, le=200)
    qty: int = Field(default=1, ge=1, le=500)
    material: str = Field(default="", max_length=20)
    color: str = Field(default="", max_length=60)
    deadline: str = Field(default="", max_length=10)
    budget: int | None = Field(default=None, ge=0, le=100_000_000)

    @field_validator("description")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()

    @field_validator("deadline")
    @classmethod
    def date_format(cls, v: str) -> str:
        if v and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("Fecha inválida")
        return v


class DesignCreate(BaseModel):
    contact: DesignContact
    brief: DesignBrief


class DesignAction(BaseModel):
    action: Literal["designing", "proposal", "cancel", "reopen", "note"]
    note: str | None = Field(default=None, max_length=1000)


class DesignOrder(BaseModel):
    """Lo que el taller define al convertir el diseño en pedido."""

    print_price: int = Field(gt=0)
    shipping: int = Field(default=0, ge=0)
    material: str = "PLA"
    quality: str = "estandar"
    infill: int = Field(default=20, ge=0, le=100)
    color: str = Field(default="", max_length=40)
    address: str = Field(default="", max_length=200)


FIELD_LABEL = {
    "name": "nombre",
    "phone": "celular",
    "email": "correo",
    "city": "ciudad",
    "department": "departamento",
    "address": "dirección",
    "description": "descripción",
    "size_cm": "medida",
    "qty": "cantidad",
    "deadline": "fecha",
    "budget": "presupuesto",
    "print_price": "precio",
    "shipping": "envío",
}


def form_error(e: ValidationError) -> str:
    """Un mensaje legible para el primer campo con problema."""
    err = e.errors()[0]
    field = next((FIELD_LABEL[x] for x in reversed(err["loc"]) if x in FIELD_LABEL), None)
    if err["type"] == "value_error":
        return str(err["ctx"]["error"])
    if field and err["type"] == "string_too_short" and field == "descripción":
        return "Cuéntanos un poco más en la descripción"
    return f"Revisa el campo {field}" if field else "Revisa los datos del formulario"


def image_kind(data: bytes) -> str | None:
    """Tipo de imagen por su contenido, sin fiarse de la extensión."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[4:8] == b"ftyp" and data[8:12] in (b"heic", b"heix", b"mif1", b"msf1", b"heim", b"heis", b"hevc"):
        return "heic"
    if data[:5] == b"%PDF-":
        return "pdf"
    return None


class DesignService:
    def __init__(self, settings: Settings, store: Store, quotes: QuoteService):
        self.settings = settings
        self.store = store
        self.quotes = quotes
        self.dir = settings.data_dir / "designs"

    def create(self, req: DesignCreate, images: list[tuple[str, bytes]]) -> dict:
        if not images:
            raise OrderError("Sube al menos una foto o boceto de referencia", 422)
        if len(images) > MAX_IMAGES:
            raise OrderError(f"Puedes subir hasta {MAX_IMAGES} imágenes", 422)
        kinds = []
        for name, data in images:
            if len(data) > MAX_IMAGE_MB * 1024 * 1024:
                raise OrderError(f"“{name}” supera {MAX_IMAGE_MB} MB", 413)
            kind = image_kind(data)
            if kind is None:
                raise OrderError(f"“{name}” no es una imagen JPG, PNG, WEBP, HEIC ni un PDF", 415)
            kinds.append(kind)

        design_id = "D" + secrets.token_hex(3).upper()
        folder = self.dir / design_id
        folder.mkdir(parents=True)
        files = []
        for i, ((_, data), kind) in enumerate(zip(images, kinds, strict=True), start=1):
            fname = f"{i}.{kind}"
            (folder / fname).write_bytes(data)
            files.append(fname)
        self.store.add_design({
            "id": design_id,
            "token": secrets.token_urlsafe(18),
            "status": "received",
            "contact": req.contact.model_dump(),
            "brief": req.brief.model_dump(),
            "images": files,
        })  # fmt: skip
        return self.store.get_design(design_id)

    def get_for_customer(self, design_id: str, token: str) -> dict:
        d = self.store.get_design(design_id) if design_id.isalnum() else None
        if d is None or not secrets.compare_digest(d["token"], token or ""):
            raise OrderError("Solicitud no encontrada", 404)
        return d

    def image_path(self, d: dict, name: str) -> Path:
        if name not in d["images"]:
            raise OrderError("Imagen no encontrada", 404)
        return self.dir / d["id"] / name

    def public(self, d: dict) -> dict:
        order = self.store.get_order(d["order_id"]) if d["order_id"] else None
        return {
            "id": d["id"],
            "status": d["status"],
            "status_label": STATUS_LABEL[d["status"]],
            "status_text": STATUS_TEXT[d["status"]],
            "created_at": d["created_at"],
            "brief": d["brief"],
            "images": d["images"],
            "contact": {k: d["contact"][k] for k in ("name", "city")},
            "order": {"id": order["id"], "token": order["token"]} if order else None,
        }

    def admin_view(self, d: dict) -> dict:
        site = self.settings.site_url.rstrip("/")
        return {
            **self.public(d),
            "token": d["token"],
            "contact": d["contact"],
            "note": d["note"],
            "events": self.store.design_events(d["id"]),
            "design_url": f"{site}/diseno/{d['id']}?t={d['token']}",
        }

    def act(self, design_id: str, a: DesignAction) -> dict:
        d = self.get(design_id)
        if a.action == "note":
            self.store.update_design(d["id"], note=a.note or "")
            return self.store.get_design(d["id"])
        allowed, to = ACTIONS[a.action]
        if d["status"] not in allowed:
            raise OrderError(f"No se puede pasar de “{STATUS_LABEL[d['status']]}” a “{STATUS_LABEL[to]}”", 409)
        self.store.update_design(d["id"], status=to)
        self.store.add_design_event(d["id"], to, a.note)
        return self.store.get_design(d["id"])

    def to_order(self, design_id: str, data: DesignOrder, filename: str, stream) -> dict:
        """Sube el modelo terminado y crea el pedido, ya confirmado con el precio del taller."""
        d = self.get(design_id)
        if d["status"] in ("ordered", "cancelled"):
            raise OrderError("Esta solicitud ya no admite pedidos", 409)
        c = d["contact"]
        address = data.address.strip() or c.get("address", "")
        try:
            customer = Customer(**{**c, "address": address, "notes": f"Diseño a medida {d['id']}"})
        except ValueError as e:
            raise OrderError("Falta la dirección de envío del cliente", 422) from e
        try:
            f = self.quotes.save_upload(filename, stream)
            q = self.quotes.create_quote(
                QuoteRequest(
                    file_id=f["id"], material=data.material, quality=data.quality, infill=data.infill,
                    qty=d["brief"]["qty"], color=data.color or None,
                )
            )  # fmt: skip
        except UploadError as e:
            raise OrderError(str(e), e.status) from e

        order_id = "P" + secrets.token_hex(3).upper()
        self.store.add_order({
            "id": order_id,
            "token": secrets.token_urlsafe(18),
            "quote_id": q["id"],
            "status": "confirmed",
            "customer": customer.model_dump(),
            "color": data.color or d["brief"]["color"] or None,
            "print_price": data.print_price,
            "shipping": data.shipping,
        })  # fmt: skip
        self.store.add_event(order_id, "received", f"Diseño a medida {d['id']}")
        self.store.add_event(order_id, "confirmed", "Precio del diseño y la impresión")
        self.store.update_design(d["id"], status="ordered", order_id=order_id)
        self.store.add_design_event(d["id"], "ordered", f"Pedido {order_id}")
        return self.store.get_design(d["id"])

    def delete_files(self, design_id: str) -> None:
        shutil.rmtree(self.dir / design_id, ignore_errors=True)

    def get(self, design_id: str) -> dict:
        d = self.store.get_design(design_id) if design_id.isalnum() else None
        if d is None:
            raise OrderError("Solicitud no encontrada", 404)
        return d
