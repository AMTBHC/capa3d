import json

import pytest
from fastapi.testclient import TestClient

from capa3d_api.designs import MAX_IMAGES, image_kind
from capa3d_api.main import DESIGN_MAX, create_app
from capa3d_api.settings import Settings

from .builders import binary_stl, cube

ADMIN = {"Authorization": "Bearer clave"}
JPG = b"\xff\xd8\xff\xe0" + b"0" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100
HEIC = b"\x00\x00\x00\x18ftypheic" + b"0" * 100

CONTACT = {"name": "Ana Ruiz", "phone": "300 123 4567", "email": "Ana@Correo.co", "city": "Cali", "department": "Valle"}
BRIEF = {"description": "Una figura de mi perro sentado, como la foto", "use": "regalo", "size_cm": 12, "qty": 2}


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        data_dir=tmp_path, admin_token="clave", slicer_enabled=False, site_url="https://cr3d.tech", _env_file=None
    )
    with TestClient(create_app(settings)) as c:
        yield c


def send(c, images=(("perro.jpg", JPG),), contact=None, brief=None):
    data = json.dumps({"contact": contact or CONTACT, "brief": brief or BRIEF})
    return c.post("/api/designs", data={"data": data}, files=[("files", img) for img in images])


def test_tipos_de_imagen():
    assert image_kind(JPG) == "jpg"
    assert image_kind(PNG) == "png"
    assert image_kind(HEIC) == "heic"
    assert image_kind(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "webp"
    assert image_kind(b"%PDF-1.7") == "pdf"
    assert image_kind(b"<html>") is None


def test_solicitud_y_seguimiento(client):
    r = send(client, [("perro.jpg", JPG), ("IMG_0001.HEIC", HEIC)])
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["id"].startswith("D") and d["status"] == "received"
    assert d["images"] == ["1.jpg", "2.heic"]
    assert d["brief"]["qty"] == 2 and d["contact"] == {"name": "Ana Ruiz", "city": "Cali"}

    got = client.get(f"/api/designs/{d['id']}?t={d['token']}").json()
    assert got["status_label"] == "Recibida" and got["order"] is None
    img = client.get(f"/api/designs/{d['id']}/images/1.jpg?t={d['token']}")
    assert img.status_code == 200 and img.content == JPG and img.headers["content-type"] == "image/jpeg"

    assert client.get(f"/api/designs/{d['id']}?t=otro").status_code == 404
    assert client.get(f"/api/designs/{d['id']}/images/1.jpg?t=otro").status_code == 404
    assert client.get(f"/api/designs/{d['id']}/images/..%2Fcapa3d.db?t={d['token']}").status_code == 404


def test_validaciones(client):
    assert send(client, [("nota.txt", b"hola")]).status_code == 415
    assert send(client, [(f"{i}.png", PNG) for i in range(MAX_IMAGES + 1)]).status_code == 422
    assert send(client, contact={**CONTACT, "email": "malo"}).status_code == 422
    assert send(client, brief={"description": "corto"}).status_code == 422
    assert client.post("/api/designs", data={"data": "{}"}).status_code == 422


def test_limite_por_ip(client):
    for _ in range(DESIGN_MAX):
        assert send(client).status_code == 201
    assert send(client).status_code == 429


def test_panel_estados_y_pedido(client):
    d = send(client).json()
    assert client.get("/api/admin/designs").status_code == 401
    rows = client.get("/api/admin/designs", headers=ADMIN).json()
    assert [x["id"] for x in rows] == [d["id"]]
    assert rows[0]["contact"]["phone"] == "3001234567"
    assert rows[0]["design_url"] == f"https://cr3d.tech/diseno/{d['id']}?t={d['token']}"
    img = client.get(f"/api/admin/designs/{d['id']}/images/1.jpg", headers=ADMIN)
    assert img.content == JPG

    act = lambda **kw: client.post(f"/api/admin/designs/{d['id']}/action", json=kw, headers=ADMIN)  # noqa: E731
    assert act(action="designing").json()["status"] == "designing"
    assert act(action="note", note="Le mandé boceto").json()["note"] == "Le mandé boceto"
    assert act(action="reopen").status_code == 409
    assert act(action="proposal").json()["status_label"] == "Propuesta enviada"

    order = lambda body: client.post(  # noqa: E731
        f"/api/admin/designs/{d['id']}/order",
        data={"data": json.dumps(body)},
        files={"file": ("perro.stl", binary_stl(cube(20)))},
        headers=ADMIN,
    )
    # Sin dirección del cliente no se puede crear el pedido.
    assert order({"print_price": 80000}).status_code == 422
    assert order({"print_price": 0, "address": "Calle 1 # 2-3"}).status_code == 422
    r = order({"print_price": 80000, "shipping": 12000, "address": "Calle 1 # 2-3", "color": "Blanco"})
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["status"] == "ordered" and v["order"]["id"].startswith("P")
    assert [e["status"] for e in v["events"]] == ["received", "designing", "proposal", "ordered"]

    o = client.get(f"/api/orders/{v['order']['id']}?t={v['order']['token']}").json()
    assert o["status"] == "confirmed" and o["total"] == 92000 and o["params"]["qty"] == 2
    assert o["customer"]["address"] == "Calle 1 # 2-3"
    # El cliente ve el enlace a su pedido desde la página del diseño.
    pub = client.get(f"/api/designs/{d['id']}?t={d['token']}").json()
    assert pub["order"] == v["order"]
    assert order({"print_price": 80000, "address": "Calle 1 # 2-3"}).status_code == 409
    assert act(action="cancel").status_code == 409


def test_panel_en_vivo_cuenta_disenos(client):
    send(client)
    with client.stream("GET", "/api/admin/stream", headers=ADMIN) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                data = json.loads(line[5:])
                break
    assert data["designs"] == {"count": 1, "by_status": {"received": 1}}


def test_mensajes_legibles(client):
    assert send(client, contact={**CONTACT, "email": "malo"}).json()["detail"] == "Correo inválido"
    assert send(client, brief={"description": "corto"}).json()["detail"] == "Cuéntanos un poco más en la descripción"
    assert send(client, contact={**CONTACT, "city": ""}).json()["detail"] == "Revisa el campo ciudad"
