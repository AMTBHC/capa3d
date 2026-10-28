import json

import pytest

from .test_orders import ADMIN, WOMPI, act, make_client, new_order, wompi_event


def test_abono_por_wompi_y_saldo_contra_entrega(tmp_path):
    with make_client(tmp_path, **WOMPI) as c:
        o = new_order(c)
        act(c, o["id"], "confirm", print_price=30100, shipping=9000)  # total $39.100
        url = f"/api/orders/{o['id']}?t={o['token']}"
        v = c.get(url).json()
        assert v["deposit_percent"] == 50 and v["deposit_amount"] == 19600  # mitad redondeada hacia arriba a $100
        r = c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}", json={"plan": "deposit"}).json()
        assert "amount-in-cents=1960000" in r["url"]
        c.post("/api/payments/wompi", json=wompi_event(f"{o['id']}-1", 1960000))
        v = c.get(url).json()
        assert v["status"] == "paid" and v["plan"] == "deposit"
        assert v["paid_amount"] == 19600 and v["balance"] == 19500
        assert "$19.500 restantes" in v["status_text"]
        act(c, o["id"], "start_printing")
        act(c, o["id"], "ship", carrier="Servientrega", tracking="1")
        done = act(c, o["id"], "deliver").json()
        assert done["paid_amount"] == 39100 and done["balance"] == 0
        assert "Cobrado contra entrega $19.500" in done["events"][-1]["note"]


def test_pago_total_por_wompi(tmp_path):
    with make_client(tmp_path, **WOMPI) as c:
        o = new_order(c)
        act(c, o["id"], "confirm", print_price=21000, shipping=9000)
        c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}", json={"plan": "full"})
        c.post("/api/payments/wompi", json=wompi_event(f"{o['id']}-1", 3000000))
        v = c.get(f"/api/orders/{o['id']}?t={o['token']}").json()
        assert v["plan"] == "full" and v["balance"] == 0 and "restantes" not in v["status_text"]


def test_abono_manual(client):
    o = new_order(client)
    act(client, o["id"], "confirm", print_price=20000, shipping=0)
    v = act(client, o["id"], "mark_paid", plan="deposit").json()
    assert v["status"] == "paid" and v["paid_amount"] == 10000 and v["balance"] == 10000


def test_abono_desactivado(tmp_path, monkeypatch):
    with make_client(tmp_path, **WOMPI) as c:
        c.app.state.service.catalog.payments.deposit_percent = 0
        o = new_order(c)
        act(c, o["id"], "confirm")
        assert c.get(f"/api/orders/{o['id']}?t={o['token']}").json()["deposit_amount"] == 0
        r = c.post(f"/api/orders/{o['id']}/checkout?t={o['token']}", json={"plan": "deposit"})
        assert r.status_code == 409


def test_buscar_pedidos_por_correo_y_celular(client):
    a = new_order(client)
    b = new_order(client)
    new_order(client, email="otra@correo.co")
    found = client.post("/api/orders/lookup", json={"email": " ANA@correo.co ", "phone": "+57 300 123 4567"}).json()
    assert {x["id"] for x in found} == {a["id"], b["id"]}
    assert all(x["token"] and x["file_name"] == "pieza.stl" for x in found)
    assert client.post("/api/orders/lookup", json={"email": "ana@correo.co", "phone": "3009999999"}).json() == []
    assert client.post("/api/orders/lookup", json={"email": "x", "phone": "1"}).status_code == 422


def test_busqueda_limitada(client):
    for _ in range(10):
        client.post("/api/orders/lookup", json={"email": "a@b.co", "phone": "3001112233"})
    assert client.post("/api/orders/lookup", json={"email": "a@b.co", "phone": "3001112233"}).status_code == 429


def read_events(client, url: str, headers=None, count: int = 1) -> list[tuple[str, dict]]:
    events, event = [], None
    with client.stream("GET", url, headers=headers or {}) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        for line in r.iter_lines():
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                events.append((event, json.loads(line[6:])))
                if len(events) >= count:
                    break
    return events


@pytest.fixture
def client(tmp_path):
    with make_client(tmp_path, stream_max_seconds=3) as c:
        yield c


def test_pedido_en_vivo(client):
    o = new_order(client)
    [(event, data)] = read_events(client, f"/api/orders/{o['id']}/stream?t={o['token']}")
    assert event == "order" and data["id"] == o["id"] and data["status"] == "received"
    assert client.get(f"/api/orders/{o['id']}/stream?t=mal").status_code == 404


def test_panel_en_vivo(client):
    new_order(client)
    [(event, data)] = read_events(client, "/api/admin/stream", ADMIN)
    assert event == "orders" and data["count"] == 1 and data["by_status"] == {"received": 1}
    assert client.get("/api/admin/stream").status_code == 401


def test_cada_cambio_sube_la_version(client):
    o = new_order(client)
    store = client.app.state.service.store
    v0 = store.order_version(o["id"])
    act(client, o["id"], "confirm")
    assert store.order_version(o["id"]) > v0
