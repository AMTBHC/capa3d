"""
Wompi: enlace de pago (Web Checkout), verificación de transacciones y eventos.
Documentación: https://docs.wompi.co
"""

import hashlib
import hmac
import ipaddress
import json
import urllib.request
from dataclasses import dataclass
from urllib.parse import urlencode, urlparse

CHECKOUT_URL = "https://checkout.wompi.co/p/"


class WompiError(RuntimeError):
    pass


@dataclass
class Transaction:
    id: str
    status: str  # APPROVED, DECLINED, VOIDED, ERROR o PENDING
    reference: str
    amount_in_cents: int


def is_local_url(url: str) -> bool:
    """
    True si la dirección no es alcanzable desde internet (localhost, 127.x, red privada).
    El firewall de Wompi rechaza con 403 los enlaces de pago que regresan a esas direcciones.
    """
    host = (urlparse(url).hostname or "").lower()
    if host in ("", "localhost") or host.endswith((".localhost", ".local")):
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_unspecified or ip.is_link_local


@dataclass
class Wompi:
    public_key: str
    integrity_secret: str
    events_secret: str
    private_key: str = ""

    @property
    def enabled(self) -> bool:
        return bool(self.public_key and self.integrity_secret)

    @property
    def sandbox(self) -> bool:
        return self.public_key.startswith("pub_test_")

    @property
    def api_url(self) -> str:
        return "https://sandbox.wompi.co/v1" if self.sandbox else "https://production.wompi.co/v1"

    def integrity(self, reference: str, amount_in_cents: int, currency: str = "COP") -> str:
        """Firma de integridad: SHA256(referencia + monto en centavos + moneda + secreto)."""
        raw = f"{reference}{amount_in_cents}{currency}{self.integrity_secret}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def checkout_url(self, reference: str, amount_in_cents: int, redirect_url: str, customer: dict) -> str:
        """Enlace de Web Checkout. Sin redirect_url, Wompi muestra su propia página al terminar."""
        params = {
            "public-key": self.public_key,
            "currency": "COP",
            "amount-in-cents": amount_in_cents,
            "reference": reference,
            "signature:integrity": self.integrity(reference, amount_in_cents),
            "redirect-url": redirect_url,
            "customer-data:email": customer.get("email", ""),
            "customer-data:full-name": customer.get("name", ""),
            "customer-data:phone-number": "".join(c for c in customer.get("phone", "") if c.isdigit())[-10:],
            "customer-data:phone-number-prefix": "+57",
            "shipping-address:address-line-1": customer.get("address", ""),
            "shipping-address:city": customer.get("city", ""),
            "shipping-address:region": customer.get("department", ""),
            "shipping-address:country": "CO",
            "shipping-address:phone-number": "".join(c for c in customer.get("phone", "") if c.isdigit())[-10:],
        }
        return CHECKOUT_URL + "?" + urlencode({k: v for k, v in params.items() if v != ""})

    def fetch_transaction(self, transaction_id: str) -> Transaction:
        """Consulta una transacción en Wompi (no requiere llave privada)."""
        if not transaction_id.replace("-", "").isalnum():
            raise WompiError("Id de transacción inválido")
        try:
            with urllib.request.urlopen(f"{self.api_url}/transactions/{transaction_id}", timeout=15) as r:
                data = json.load(r)["data"]
        except Exception as e:  # red, 404, JSON inesperado
            raise WompiError(f"No se pudo consultar Wompi: {e}") from e
        return _transaction(data)

    def find_by_reference(self, reference: str) -> Transaction | None:
        """La transacción más reciente con esta referencia (requiere la llave privada)."""
        if not self.private_key:
            raise WompiError("Falta la llave privada de Wompi")
        req = urllib.request.Request(
            f"{self.api_url}/transactions?{urlencode({'reference': reference})}",
            headers={"Authorization": f"Bearer {self.private_key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.load(r)["data"]
        except Exception as e:
            raise WompiError(f"No se pudo consultar Wompi: {e}") from e
        found = [t for t in (data if isinstance(data, list) else [data]) if str(t.get("reference")) == reference]
        return _transaction(found[0]) if found else None

    def parse_event(self, body: dict) -> Transaction | None:
        """
        Valida la firma de un evento de Wompi y devuelve la transacción, o None si el
        evento no es de una transacción. La firma es SHA256 de los valores de
        signature.properties, el timestamp y el secreto de eventos.
        """
        if not self.events_secret:
            raise WompiError("Falta el secreto de eventos de Wompi")
        try:
            sig = body["signature"]
            values = "".join(str(_lookup(body["data"], prop)) for prop in sig["properties"])
            expected = hashlib.sha256(f"{values}{body['timestamp']}{self.events_secret}".encode()).hexdigest()
        except (KeyError, TypeError) as e:
            raise WompiError("Evento de Wompi mal formado") from e
        if not hmac.compare_digest(expected, str(sig.get("checksum", "")).lower()):
            raise WompiError("Firma de Wompi inválida")
        if body.get("event") != "transaction.updated":
            return None
        return _transaction(body["data"]["transaction"])


def _lookup(data: dict, path: str):
    for key in path.split("."):
        data = data[key]
    return data


def _transaction(t: dict) -> Transaction:
    return Transaction(
        id=str(t["id"]),
        status=str(t["status"]),
        reference=str(t["reference"]),
        amount_in_cents=int(t["amount_in_cents"]),
    )
