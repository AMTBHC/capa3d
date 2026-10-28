import hashlib
import io
import time
import zipfile
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from capa3d_api.catalog import Shipping
from capa3d_api.main import create_app
from capa3d_api.settings import Settings
from capa3d_api.wompi import Transaction, Wompi

from .builders import binary_stl, cube

ADMIN = {"Authorization": "Bearer clave"}
WOMPI = {
    "wompi_public_key": "pub_test_abc",
    "wompi_integrity_secret": "test_integrity_xyz",
    "wompi_events_secret": "test_events_123",
}
CUSTOMER = {
    "name": "Ana Pérez",
    "phone": "+57 300 123 4567",
    "email": "Ana@Correo.co",
    "address": "Calle 10 # 20-30, apto 401",
    "city": "Medellín",
    "department": "Antioquia",
    "notes": "Llamar antes de entregar",
}


def make_client(tmp_path, **kw) -> TestClient:
    settings = Settings(
        data_dir=tmp_path, admin_token="clave", slicer_enabled=False, site_url="https://capa3d.co", _env_file=None, **kw
    )
    return TestClient(create_app(settings))


def done_quote(c: TestClient) -> dict:
    f = c.post("/api/files", files={"file": ("pieza.stl", binary_stl(cube(20)))}).json()
    q = c.post("/api/quotes", json={"file_id": f["id"], "material": "PLA", "quality": "estandar", "infill": 20}).json()
    while q["status"] == "pending":
        time.sleep(0.1)
        q = c.get(f"/api/quotes/{q['id']}").json()
    return q


def new_order(c: TestClient, **customer) -> dict:
    q = done_quote(c)
    r = c.post("/api/orders", json={"quote_id": q["id"], "color": "Rojo", "customer": {**CUSTOMER, **customer}})
    assert r.status_code == 201, r.text
    return r.json()


def act(c: TestClient, order_id: str, action: str, **kw):
    return c.post(f"/api/admin/orders/{order_id}/action", json={"action": action, **kw}, headers=ADMIN)


@pytest.fixture
def client(tmp_path):
    with make_client(tmp_path) as c:
        yield c


@pytest.fixture
def paying_client(tmp_path):
    with make_client(tmp_path, **WOMPI) as c:
        yield c


def test_tarifa_de_envio_por_ciudad():
    s = Shipping(cost=15000, cities={"Medellín": 8000})
    assert s.cost_for("  medellin ") == 8000
    assert s.cost_for("MEDELLÍN") == 8000
    assert s.cost_for("Cali") == 15000


def test_crear_pedido(client):
    o = new_order(client)
    assert o["status"] == "received" and o["status_label"] == "Recibido"
    assert o["id"].startswith("P") and o["token"]
    assert o["print_price"] > 0 and o["shipping"] == 15000
    assert o["total"] == o["print_price"] + o["shipping"]
    assert o["color"] == "Rojo" and o["file_name"] == "pieza.stl"
    assert [e["status"] for e in o["events"]] == ["received"]
    # Datos privados del cliente no se exponen en la vista pública.
    assert "phone" not in o["customer"] and "email" not in o["customer"]
    # La cotización queda marcada como pedida.
    rows = client.get("/api/admin/quotes?requested=true", headers=ADMIN).json()
    assert rows[0]["id"] == o["quote_id"] and rows[0]["color"] == "Rojo"


def test_valida_datos_del_cliente(client):
    q = done_quote(client)
    for bad in ({"email": "sin-arroba"}, {"phone": "12"}, {"name": ""}, {"address": "x"}):
        r = client.post("/api/orders", json={"quote_id": q["id"], "color": "Rojo", "customer": {**CUSTOMER, **bad}})
        assert r.status_code == 422, bad
    r = client.post("/api/orders", json={"quote_id": "QNOEXISTE", "color": "Rojo", "customer": CUSTOMER})
    assert r.status_code == 404


def test_pedido_requiere_token(client):
    o = new_order(client)
    assert client.get(f"/api/orders/{o['id']}").status_code == 404
    assert client.get(f"/api/orders/{o['id']}?t=otro").status_code == 404
    assert client.get(f"/api/orders/{o['id']}?t={o['token']}").json()["id"] == o["id"]


def test_flujo_completo_en_el_panel(client):
    o = new_order(client)
    assert act(client, o["id"], "mark_paid").status_code == 409  # primero hay que confirmar
    r = act(client, o["id"], "confirm", print_price=21000, shipping=9000, note="Ajusté soportes")
    assert r.status_code == 200
    v = r.json()
    assert v["status"] == "confirmed" and v["total"] == 30000
    assert v["order_url"] == f"https://capa3d.co/pedido/{o['id']}?t={o['token']}"
    assert v["customer"]["phone"] == "573001234567"
    # Sin llaves de Wompi no hay pago en línea; se marca a mano.
    assert v["can_pay"] is False
    assert client.post(f"/api/orders/{o['id']}/checkout?t={o['token']}").status_code == 503
    assert act(client, o["id"], "mark_paid").json()["status"] == "paid"
    assert act(client, o["id"], "start_printing").json()["status"] == "printing"
    assert act(client, o["id"], "ship").status_code == 422  # falta la guía
    shipped = act(client, o["id"], "ship", carrier="Servientrega", tracking="123456").json()
    assert shipped["tracking"] == "123456"
    assert act(client, o["id"], "deliver").json()["status"] == "delivered"
    assert act(client, o["id"], "cancel").status_code == 409
    public = client.get(f"/api/orders/{o['id']}?t={o['token']}").json()
    assert [e["status"] for e in public["events"]] == [
        "received",
        "confirmed",
        "paid",
        "printing",
        "shipped",
        "delivered",
    ]
    assert public["carrier"] == "Servientrega"

    listed = client.get("/api/admin/orders?status=delivered", headers=ADMIN).json()
    assert [x["id"] for x in listed] == [o["id"]]
    assert client.get("/api/admin/orders?status=received", headers=ADMIN).json() == []


def test_zip_del_pedido_incluye_cliente(client):
    o = new_order(client)
    r = client.get(f"/api/admin/orders/{o['id']}/download", headers=ADMIN)
    z = zipfile.ZipFile(io.BytesIO(r.content))
    resumen = z.read("resumen.txt").decode()
    assert f"Pedido {o['id']}" in resumen and "Ana Pérez" in resumen and "Calle 10" in resumen
    assert "pieza.stl" in z.namelist()


def test_panel_de_pedidos_requiere_clave(client):
    o = new_order(client)
    assert client.get("/api/admin/orders").status_code == 401
    assert client.post(f"/api/admin/orders/{o['id']}/action", json={"action": "confirm"}).status_code == 401


def test_enlace_de_pago_wompi(paying_client):
    c = paying_client
    o = new_order(c)
    act(c, o["id"], "confirm", print_price=21000, shipping=9000)
    assert c.get(f"/api/orders/{o['id']}?t={o['token']}").json()["can_pay"] is True
    url = c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}").json()["url"]
    q = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
    assert url.startswith("https://checkout.wompi.co/p/")
    assert q["public-key"] == "pub_test_abc" and q["currency"] == "COP"
    assert q["amount-in-cents"] == "3000000"
    assert q["reference"] == f"{o['id']}-1"
    expected = hashlib.sha256(f"{o['id']}-13000000COPtest_integrity_xyz".encode()).hexdigest()
    assert q["signature:integrity"] == expected
    assert q["redirect-url"] == f"https://capa3d.co/pedido/{o['id']}?t={o['token']}"
    assert q["customer-data:email"] == "ana@correo.co"
    # Cada intento de pago tiene su propia referencia.
    url2 = c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}").json()["url"]
    assert parse_qs(urlparse(url2).query)["reference"] == [f"{o['id']}-2"]


def wompi_event(reference: str, amount: int, status: str = "APPROVED", secret: str = WOMPI["wompi_events_secret"]):
    tx = {"id": "1234-1610641025-49201", "status": status, "reference": reference, "amount_in_cents": amount}
    props = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    ts = 1610641025
    checksum = hashlib.sha256(f"{tx['id']}{status}{amount}{ts}{secret}".encode()).hexdigest()
    return {
        "event": "transaction.updated",
        "data": {"transaction": tx},
        "environment": "test",
        "signature": {"properties": props, "checksum": checksum},
        "timestamp": ts,
    }


def test_webhook_aprueba_el_pago(paying_client):
    c = paying_client
    o = new_order(c)
    act(c, o["id"], "confirm", print_price=21000, shipping=9000)
    c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}")
    assert c.post("/api/payments/wompi", json=wompi_event(f"{o['id']}-1", 3000000, secret="otro")).status_code == 401
    assert c.post("/api/payments/wompi", json=wompi_event(f"{o['id']}-1", 100)).status_code == 200
    assert c.get(f"/api/orders/{o['id']}?t={o['token']}").json()["status"] == "confirmed"  # monto alterado
    assert c.post("/api/payments/wompi", json=wompi_event(f"{o['id']}-1", 3000000)).status_code == 200
    v = c.get(f"/api/orders/{o['id']}?t={o['token']}").json()
    assert v["status"] == "paid" and v["payment_status"] == "APPROVED"


def test_regreso_desde_wompi(paying_client, monkeypatch):
    c = paying_client
    o = new_order(c)
    act(c, o["id"], "confirm")
    c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}")
    total = c.get(f"/api/orders/{o['id']}?t={o['token']}").json()["total"]

    def fake(self, tx_id):
        return Transaction(tx_id, "APPROVED", f"{o['id']}-1", total * 100)

    monkeypatch.setattr(Wompi, "fetch_transaction", fake)
    r = c.post(f"/api/orders/{o['id']}/payment-return?t={o['token']}", json={"transaction_id": "123-abc"})
    assert r.status_code == 200 and r.json()["status"] == "paid"


def test_regreso_con_transaccion_de_otro_pedido(paying_client, monkeypatch):
    c = paying_client
    o = new_order(c)
    act(c, o["id"], "confirm")
    monkeypatch.setattr(Wompi, "fetch_transaction", lambda self, i: Transaction(i, "APPROVED", "POTRO-1", 1))
    r = c.post(f"/api/orders/{o['id']}/payment-return?t={o['token']}", json={"transaction_id": "123"})
    assert r.status_code == 409


def test_wompi_sandbox_o_produccion():
    assert Wompi("pub_test_x", "s", "e").api_url == "https://sandbox.wompi.co/v1"
    assert Wompi("pub_prod_x", "s", "e").api_url == "https://production.wompi.co/v1"
    assert not Wompi("", "", "").enabled


@pytest.mark.parametrize(
    ("url", "local"),
    [
        ("http://localhost:3000/pedido/P1", True),
        ("http://127.0.0.1:3000/x", True),
        ("http://192.168.1.20:3000/x", True),
        ("http://capa3d.local/x", True),
        ("https://capa3d.co/pedido/P1", False),
        ("https://capa3d.vercel.app/x", False),
    ],
)
def test_direcciones_locales(url, local):
    from capa3d_api.wompi import is_local_url

    assert is_local_url(url) is local


def test_sitio_local_no_envia_direccion_de_regreso(tmp_path):
    """El firewall de Wompi responde 403 si redirect-url apunta a localhost."""
    settings = Settings(
        data_dir=tmp_path, admin_token="clave", slicer_enabled=False, site_url="http://localhost:3000",
        _env_file=None, **WOMPI,
    )  # fmt: skip
    with TestClient(create_app(settings)) as c:
        o = new_order(c)
        act(c, o["id"], "confirm")
        r = c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}").json()
    assert r["returns"] is False
    assert "redirect-url" not in parse_qs(urlparse(r["url"]).query)


def test_sitio_publico_si_envia_direccion_de_regreso(paying_client):
    c = paying_client
    o = new_order(c)
    act(c, o["id"], "confirm")
    r = c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}").json()
    assert r["returns"] is True and "redirect-url" in parse_qs(urlparse(r["url"]).query)


def test_llave_privada_confirma_el_pago_al_consultar(tmp_path, monkeypatch):
    calls = []

    def fake_find(self, reference):
        calls.append(reference)
        return Transaction("tx-1", "APPROVED", reference, total * 100)

    monkeypatch.setattr(Wompi, "find_by_reference", fake_find)
    with make_client(tmp_path, **WOMPI, wompi_private_key="prv_test_abc") as c:
        o = new_order(c)
        url = f"/api/orders/{o['id']}?t={o['token']}"
        assert c.get(url).json()["status"] == "received"
        assert calls == []  # sin pago iniciado no se consulta
        act(c, o["id"], "confirm")
        total = c.get(url).json()["total"]
        c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}")
        v = c.get(url).json()
    assert v["status"] == "paid" and v["payment_status"] == "APPROVED"
    assert calls == [f"{o['id']}-1"]


def test_sin_llave_privada_no_consulta(paying_client, monkeypatch):
    monkeypatch.setattr(Wompi, "find_by_reference", lambda self, ref: pytest.fail("no debe consultar"))
    c = paying_client
    o = new_order(c)
    act(c, o["id"], "confirm")
    c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}")
    assert c.get(f"/api/orders/{o['id']}?t={o['token']}").json()["status"] == "confirmed"
