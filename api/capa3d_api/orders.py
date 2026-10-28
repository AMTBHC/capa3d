"""
Pedidos: el cliente pide sin pagar, el taller revisa y confirma el precio, el cliente paga
con Wompi (o el taller marca el pago a mano) y el pedido avanza hasta la entrega.
"""

import re
import secrets
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .catalog import Catalog
from .service import QuoteService
from .settings import Settings
from .store import Store
from .wompi import Transaction, Wompi, WompiError, is_local_url

Status = Literal["received", "confirmed", "paid", "printing", "shipped", "delivered", "cancelled"]

STATUS_LABEL: dict[str, str] = {
    "received": "Recibido",
    "confirmed": "Por pagar",
    "paid": "Pagado",
    "printing": "Imprimiendo",
    "shipped": "Enviado",
    "delivered": "Entregado",
    "cancelled": "Cancelado",
}

# Lo que el cliente ve en cada estado.
STATUS_TEXT: dict[str, str] = {
    "received": "Recibimos tu pedido. Estamos revisando tu archivo para confirmarte el precio final.",
    "confirmed": "Revisamos tu archivo y confirmamos el precio. Ya puedes pagar para que empecemos a imprimir.",
    "paid": "Recibimos tu pago. Tu pedido entra a la cola de impresión.",
    "printing": "Tu pieza se está imprimiendo.",
    "shipped": "Tu pedido va en camino.",
    "delivered": "Tu pedido fue entregado. ¡Gracias por tu compra!",
    "cancelled": "Este pedido fue cancelado.",
}

FLOW = ["received", "confirmed", "paid", "printing", "shipped", "delivered"]

# Cada cuánto se puede consultar en Wompi el pago pendiente de un pedido.
REFRESH_EVERY_S = 10

# Acción del panel → (estados desde los que se puede, estado al que lleva).
ACTIONS: dict[str, tuple[set[str], str]] = {
    "confirm": ({"received", "confirmed"}, "confirmed"),
    "mark_paid": ({"confirmed"}, "paid"),
    "start_printing": ({"paid"}, "printing"),
    "ship": ({"printing", "paid"}, "shipped"),
    "deliver": ({"shipped"}, "delivered"),
    "cancel": ({"received", "confirmed", "paid", "printing"}, "cancelled"),
}


class OrderError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


class Customer(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=7, max_length=20)
    email: str = Field(max_length=120)
    address: str = Field(min_length=5, max_length=200)
    city: str = Field(min_length=2, max_length=60)
    department: str = Field(min_length=2, max_length=60)
    notes: str = Field(default="", max_length=500)

    @field_validator("name", "address", "city", "department", "notes")
    @classmethod
    def strip(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("phone")
    @classmethod
    def phone_digits(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if not 7 <= len(digits) <= 15:
            raise ValueError("Celular inválido")
        return digits

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
            raise ValueError("Correo inválido")
        return v


class OrderCreate(BaseModel):
    quote_id: str = Field(max_length=20)
    color: str = Field(max_length=40)
    customer: Customer


Plan = Literal["full", "deposit"]


class Checkout(BaseModel):
    plan: Plan = "full"


class Lookup(BaseModel):
    email: str = Field(max_length=120)
    phone: str = Field(max_length=20)


class OrderAction(BaseModel):
    action: Literal["confirm", "mark_paid", "start_printing", "ship", "deliver", "cancel"]
    # Para "mark_paid": si se recibió el total o solo el abono.
    plan: Plan = "full"
    print_price: int | None = Field(default=None, ge=0)
    shipping: int | None = Field(default=None, ge=0)
    carrier: str | None = Field(default=None, max_length=60)
    tracking: str | None = Field(default=None, max_length=80)
    note: str | None = Field(default=None, max_length=500)


class OrderService:
    def __init__(self, settings: Settings, catalog: Catalog, store: Store, quotes: QuoteService, wompi: Wompi):
        self.settings = settings
        self.catalog = catalog
        self.store = store
        self.quotes = quotes
        self.wompi = wompi
        self._checked: dict[str, float] = {}
        self._lock = threading.Lock()

    # Cliente

    def create(self, req: OrderCreate) -> dict:
        q = self.store.get_quote(req.quote_id) if req.quote_id.isalnum() else None
        if q is None:
            raise OrderError("Cotización no encontrada", 404)
        if q["status"] != "done" or not (q["result"] or {}).get("price"):
            raise OrderError("La cotización todavía no tiene precio", 409)
        if q["valid_until"] < datetime.now(UTC).isoformat(timespec="seconds"):
            raise OrderError("La cotización venció; vuelve a cotizar", 409)

        order_id = "P" + secrets.token_hex(3).upper()
        self.store.add_order({
            "id": order_id,
            "token": secrets.token_urlsafe(18),
            "quote_id": q["id"],
            "status": "received",
            "customer": req.customer.model_dump(),
            "color": req.color,
            "print_price": int(q["result"]["price"]["total"]),
            "shipping": self.catalog.shipping.cost_for(req.customer.city),
        })  # fmt: skip
        self.store.add_event(order_id, "received")
        self.store.mark_requested(q["id"], req.color)
        return self.store.get_order(order_id)

    def get_for_customer(self, order_id: str, token: str) -> dict:
        o = self.store.get_order(order_id) if order_id.isalnum() else None
        if o is None or not secrets.compare_digest(o["token"], token or ""):
            raise OrderError("Pedido no encontrado", 404)
        return o

    def deposit_amount(self, total: int) -> int:
        """Abono redondeado hacia arriba a $100; 0 si el abono está desactivado."""
        pct = self.catalog.payments.deposit_percent
        return -(-total * pct // 10000) * 100 if pct else 0

    def checkout(self, order_id: str, token: str, plan: str = "full") -> tuple[str, bool]:
        """
        URL de pago de Wompi por el total o por el abono, y si Wompi devolverá al cliente al sitio.
        Con el sitio en una dirección local no se envía la de regreso: Wompi la rechaza (403).
        """
        o = self.get_for_customer(order_id, token)
        if o["status"] != "confirmed":
            raise OrderError("Este pedido no está pendiente de pago", 409)
        if not self.wompi.enabled:
            raise OrderError("El pago en línea no está disponible; escríbenos por WhatsApp", 503)
        total = o["print_price"] + o["shipping"]
        amount = total
        if plan == "deposit":
            amount = self.deposit_amount(total)
            if not amount:
                raise OrderError("El abono no está disponible; paga el total", 409)
        reference = f"{o['id']}-{len(self.store.payments(o['id'])) + 1}"
        self.store.add_payment(reference, o["id"], amount)
        self.store.update_order(o["id"], plan=plan)
        redirect = f"{self.settings.site_url.rstrip('/')}/pedido/{o['id']}?t={o['token']}"
        returns = not is_local_url(redirect)
        return self.wompi.checkout_url(reference, amount * 100, redirect if returns else "", o["customer"]), returns

    def refresh_payment(self, o: dict) -> dict:
        """
        Si el pedido espera pago y hay llave privada, consulta en Wompi el último intento.
        Así el pago se confirma aunque no lleguen eventos ni el cliente vuelva al sitio.
        """
        if o["status"] != "confirmed" or not self.wompi.private_key:
            return o
        pays = self.store.payments(o["id"])
        if not pays or pays[-1]["status"] != "PENDING":
            return o
        with self._lock:
            if time.monotonic() - self._checked.get(o["id"], 0) < REFRESH_EVERY_S:
                return o
            self._checked[o["id"]] = time.monotonic()
        try:
            tx = self.wompi.find_by_reference(pays[-1]["reference"])
        except WompiError:
            return o
        if tx:
            self.apply_transaction(tx)
        return self.store.get_order(o["id"])

    def payment_return(self, order_id: str, token: str, transaction_id: str) -> dict:
        """El cliente volvió de Wompi: se consulta la transacción para no depender del webhook."""
        o = self.get_for_customer(order_id, token)
        try:
            tx = self.wompi.fetch_transaction(transaction_id)
        except WompiError as e:
            raise OrderError(str(e), 502) from e
        if not tx.reference.startswith(f"{o['id']}-"):
            raise OrderError("La transacción no corresponde a este pedido", 409)
        self.apply_transaction(tx)
        return self.store.get_order(o["id"])

    def apply_transaction(self, tx: Transaction) -> None:
        """Registra el resultado de un pago de Wompi; si fue aprobado, el pedido queda pagado."""
        pay = self.store.get_payment(tx.reference)
        if pay is None:
            return
        if tx.amount_in_cents != pay["amount"] * 100:
            self.store.update_payment(tx.reference, "AMOUNT_MISMATCH", tx.id)
            return
        self.store.update_payment(tx.reference, tx.status, tx.id)
        o = self.store.get_order(pay["order_id"])
        if tx.status == "APPROVED" and o and o["status"] == "confirmed":
            self._paid(o, pay["amount"], f"Wompi {tx.id}")

    def _paid(self, o: dict, amount: int, how: str) -> None:
        total = o["print_price"] + o["shipping"]
        balance = max(0, total - amount)
        plan = "deposit" if balance else "full"
        self.store.update_order(o["id"], status="paid", paid_amount=amount, plan=plan)
        note = (
            f"Abono {_cop(amount)} · saldo {_cop(balance)} contra entrega" if balance else f"Pago total {_cop(amount)}"
        )
        self.store.add_event(o["id"], "paid", f"{note} · {how}")

    def lookup(self, req: Lookup) -> list[dict]:
        """Pedidos del cliente por correo y celular, para quien perdió el enlace."""
        digits = "".join(c for c in req.phone if c.isdigit())
        if len(digits) < 7 or "@" not in req.email:
            raise OrderError("Escribe el correo y el celular con que hiciste el pedido", 422)
        found = self.store.orders_by_contact(req.email.strip().lower(), digits[-10:])
        return [
            {
                "id": o["id"],
                "token": o["token"],
                "status": o["status"],
                "status_label": STATUS_LABEL[o["status"]],
                "created_at": o["created_at"],
                "total": o["print_price"] + o["shipping"],
                "file_name": self.store.get_file(self.store.get_quote(o["quote_id"])["file_id"])["name"],
            }
            for o in found
        ]

    def public(self, o: dict) -> dict:
        """Lo que ve el cliente en la página de su pedido."""
        q = self.store.get_quote(o["quote_id"])
        file = self.store.get_file(q["file_id"])
        pays = self.store.payments(o["id"])
        last = pays[-1] if pays else None
        c = o["customer"]
        total = o["print_price"] + o["shipping"]
        paid = o.get("paid_amount") or 0
        balance = max(0, total - paid)
        text = STATUS_TEXT[o["status"]]
        if o["status"] in ("paid", "printing", "shipped") and paid and balance:
            text += (
                f" Pagaste un abono de {_cop(paid)}; los {_cop(balance)} restantes los pagas en efectivo al recibir."
            )
        return {
            "id": o["id"],
            "status": o["status"],
            "status_label": STATUS_LABEL[o["status"]],
            "status_text": text,
            "flow": [{"status": s, "label": STATUS_LABEL[s]} for s in FLOW],
            "events": [{**e, "label": STATUS_LABEL.get(e["status"], e["status"])} for e in self.store.events(o["id"])],
            "created_at": o["created_at"],
            "quote_id": o["quote_id"],
            "file_name": file["name"],
            "plates": len(file["summary"]["plates"]),
            "params": q["params"],
            "color": o["color"],
            "customer": {k: c[k] for k in ("name", "city", "department", "address")},
            "print_price": o["print_price"],
            "shipping": o["shipping"],
            "total": total,
            "paid_amount": paid,
            "balance": balance,
            "plan": o.get("plan"),
            "deposit_amount": self.deposit_amount(total),
            "deposit_percent": self.catalog.payments.deposit_percent,
            "currency": self.catalog.currency,
            "carrier": o["carrier"],
            "tracking": o["tracking"],
            "can_pay": o["status"] == "confirmed" and self.wompi.enabled,
            "payment_status": last["status"] if last else None,
        }

    # Panel

    def admin_view(self, o: dict) -> dict:
        return {
            **self.public(o),
            "token": o["token"],
            "customer": o["customer"],
            "payments": self.store.payments(o["id"]),
            "order_url": f"{self.settings.site_url.rstrip('/')}/pedido/{o['id']}?t={o['token']}",
        }

    def act(self, order_id: str, a: OrderAction) -> dict:
        o = self.store.get_order(order_id) if order_id.isalnum() else None
        if o is None:
            raise OrderError("Pedido no encontrado", 404)
        allowed, to = ACTIONS[a.action]
        if o["status"] not in allowed:
            raise OrderError(f"No se puede pasar de “{STATUS_LABEL[o['status']]}” a “{STATUS_LABEL[to]}”", 409)
        fields: dict = {"status": to}
        if a.action == "confirm":
            if a.print_price is not None:
                fields["print_price"] = a.print_price
            if a.shipping is not None:
                fields["shipping"] = a.shipping
        if a.action == "mark_paid":
            total = o["print_price"] + o["shipping"]
            amount = self.deposit_amount(total) if a.plan == "deposit" else total
            if not amount:
                raise OrderError("El abono no está disponible", 409)
            self._paid(o, amount, a.note or "registrado a mano")
            return self.store.get_order(o["id"])
        if a.action == "deliver":
            balance = o["print_price"] + o["shipping"] - (o.get("paid_amount") or 0)
            if balance > 0:
                fields["paid_amount"] = o["print_price"] + o["shipping"]
                a.note = " · ".join(x for x in (f"Cobrado contra entrega {_cop(balance)}", a.note) if x)
        if a.action == "ship":
            if not (a.carrier and a.tracking):
                raise OrderError("Indica la transportadora y el número de guía", 422)
            fields |= {"carrier": a.carrier.strip(), "tracking": a.tracking.strip()}
        self.store.update_order(o["id"], **fields)
        self.store.add_event(o["id"], to, a.note)
        return self.store.get_order(o["id"])

    def order_zip(self, order_id: str, dest: Path) -> str:
        o = self.store.get_order(order_id) if order_id.isalnum() else None
        if o is None:
            raise OrderError("Pedido no encontrado", 404)
        c = o["customer"]
        header = [
            f"Pedido {o['id']}  ·  estado: {STATUS_LABEL[o['status']]}",
            f"Cliente: {c['name']}  ·  celular: {c['phone']}  ·  correo: {c['email']}",
            f"Envío: {c['address']}, {c['city']} ({c['department']})",
            *([f"Notas del cliente: {c['notes']}"] if c.get("notes") else []),
            f"Color: {o['color']}",
            f"Precio impresión: ${o['print_price']:,}  ·  envío: ${o['shipping']:,}  ·  total: "
            f"${o['print_price'] + o['shipping']:,}".replace(",", "."),
            *([f"Guía: {o['carrier']} {o['tracking']}"] if o.get("tracking") else []),
            "",
            "-" * 60,
            "",
        ]
        name = self.quotes.order_zip(o["quote_id"], dest, header="\n".join(header))
        return f"{o['id']}-{name.split('-', 1)[1]}"


def _cop(x: int) -> str:
    return "$" + f"{int(x):,}".replace(",", ".")
