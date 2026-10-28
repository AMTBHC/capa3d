import struct
import time
import zlib

import pytest

from capa3d_api.openscad import scad_string
from capa3d_api.shop import clean_name, slugify

from .builders import binary_stl, cube
from .conftest import needs_openscad
from .test_orders import ADMIN, CUSTOMER, make_client


def png() -> bytes:
    """PNG válido de 1×1."""

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
        + chunk(b"IEND", b"")
    )


@pytest.fixture
def client(tmp_path):
    with make_client(tmp_path) as c:
        yield c


def wait_price(c, pid: str) -> int:
    for _ in range(100):
        p = c.get(f"/api/catalog/products/{pid}").json()
        if p.get("price_from"):
            return p["price_from"]
        time.sleep(0.1)
    raise AssertionError("sin precio")


def new_product(c, **kw) -> dict:
    body = {"collection_id": "hogar", "name": "Soporte para celular", "subsection": "Soportes", "published": True, **kw}
    r = c.post("/api/admin/catalog/products", json=body, headers=ADMIN)
    assert r.status_code == 201, r.text
    return r.json()


def test_textos():
    assert slugify("Llavero con tu nombre!") == "llavero-con-tu-nombre"
    assert slugify("Macetas & decoración") == "macetas-decoracion"
    assert clean_name("  Ana \n María\t") == "Ana María"
    assert scad_string('Di "hola" \\ fin') == '"Di \\"hola\\" \\\\ fin"'


def test_colecciones_iniciales(client):
    data = client.get("/api/admin/catalog", headers=ADMIN).json()
    ids = [c["id"] for c in data["collections"]]
    assert ids[:3] == ["mas-pedido", "virales", "flexibles"] and "llaveros" in ids
    llaveros = next(c for c in data["collections"] if c["id"] == "llaveros")
    assert llaveros["products"][0]["kind"] == "name_keychain"


def test_producto_con_modelo(client):
    p = new_product(client)
    assert p["id"] == "soporte-para-celular" and p["ready"] is False
    # Sin modelo no aparece en la tienda.
    assert client.get("/api/catalog/products/soporte-para-celular").status_code == 404
    up = client.post(
        f"/api/admin/catalog/products/{p['id']}/model",
        files={"file": ("soporte.stl", binary_stl(cube(30)))},
        headers=ADMIN,
    )
    assert up.status_code == 200 and up.json()["ready"] is True
    price = wait_price(client, p["id"])
    pub = client.get(f"/api/catalog/products/{p['id']}").json()
    assert pub["collection"]["id"] == "hogar" and pub["file_id"] and price > 0
    cols = {c["id"]: c for c in client.get("/api/catalog/collections").json()}
    assert cols["hogar"]["count"] == 1 and cols["hogar"]["price_from"] == price
    detail = client.get("/api/catalog/collections/hogar").json()
    assert [x["id"] for x in detail["products"]] == [p["id"]]
    # El archivo del producto lleva su nombre: así se ve en pedidos y en el panel.
    assert client.get(f"/api/files/{pub['file_id']}").json()["name"] == "Soporte para celular.stl"


def test_producto_sin_publicar_no_se_ve(client):
    p = new_product(client, published=False)
    client.post(
        f"/api/admin/catalog/products/{p['id']}/model", files={"file": ("a.stl", binary_stl(cube(10)))}, headers=ADMIN
    )
    assert client.get(f"/api/catalog/products/{p['id']}").status_code == 404
    assert "hogar" not in {c["id"] for c in client.get("/api/catalog/collections").json()}


def test_fotos(client):
    p = new_product(client)
    r = client.post(f"/api/admin/catalog/products/{p['id']}/images", files={"file": ("foto.png", png())}, headers=ADMIN)
    assert r.status_code == 200
    [img] = r.json()["images"]
    got = client.get(f"/api/catalog/images/{img}")
    assert got.status_code == 200 and got.headers["content-type"] == "image/png" and got.content == png()
    bad = client.post(
        f"/api/admin/catalog/products/{p['id']}/images", files={"file": ("foto.png", b"<script>")}, headers=ADMIN
    )
    assert bad.status_code == 415
    assert client.get("/api/catalog/images/..%2F..%2Fcapa3d.db").status_code == 404
    left = client.delete(f"/api/admin/catalog/products/{p['id']}/images/{img}", headers=ADMIN).json()
    assert left["images"] == [] and client.get(f"/api/catalog/images/{img}").status_code == 404
    cover = client.post("/api/admin/catalog/collections/hogar/cover", files={"file": ("p.png", png())}, headers=ADMIN)
    assert cover.status_code == 200


def test_colecciones_en_el_panel(client):
    c = client.post(
        "/api/admin/catalog/collections", json={"name": "Para empresas", "emoji": "🏢"}, headers=ADMIN
    ).json()
    assert c["id"] == "para-empresas"
    again = client.post("/api/admin/catalog/collections", json={"name": "Para empresas"}, headers=ADMIN).json()
    assert again["id"] == "para-empresas-2"
    edited = client.put(
        "/api/admin/catalog/collections/para-empresas", json={"name": "Empresas", "published": False}, headers=ADMIN
    )
    assert edited.json()["name"] == "Empresas" and edited.json()["published"] is False
    new_product(client, collection_id="para-empresas")
    assert client.delete("/api/admin/catalog/collections/para-empresas", headers=ADMIN).status_code == 409
    assert client.delete("/api/admin/catalog/collections/para-empresas-2", headers=ADMIN).status_code == 204


def test_catalogo_requiere_clave(client):
    assert client.get("/api/admin/catalog").status_code == 401
    assert client.post("/api/admin/catalog/products", json={"collection_id": "hogar", "name": "X"}).status_code == 401


def test_pedir_un_producto_del_catalogo(client):
    p = new_product(client)
    client.post(
        f"/api/admin/catalog/products/{p['id']}/model", files={"file": ("s.stl", binary_stl(cube(30)))}, headers=ADMIN
    )
    pub = client.get(f"/api/catalog/products/{p['id']}").json()
    body = {"file_id": pub["file_id"], "material": "PETG", "quality": "estandar", "infill": 20, "scale": 150, "qty": 2}
    q = client.post("/api/quotes", json=body).json()
    while q["status"] == "pending":
        time.sleep(0.1)
        q = client.get(f"/api/quotes/{q['id']}").json()
    o = client.post("/api/orders", json={"quote_id": q["id"], "color": "Azul", "customer": CUSTOMER}).json()
    assert o["file_name"] == "Soporte para celular.stl" and o["params"]["qty"] == 2


@needs_openscad
def test_llavero_con_nombre(client):
    r = client.post("/api/catalog/products/llavero-con-tu-nombre/personalize", json={"text": "Ana"})
    assert r.status_code == 200, r.text
    fid = r.json()["file_id"]
    f = client.get(f"/api/files/{fid}").json()
    assert f["name"] == "Llavero Ana.stl"
    plate = f["plates"][0]
    assert plate["open_edges"] == 0 and 25 < plate["dx"] < 45 and plate["dz"] < 6
    # El mismo nombre reutiliza el modelo.
    assert (
        client.post("/api/catalog/products/llavero-con-tu-nombre/personalize", json={"text": " Ana "}).json()["file_id"]
        == fid
    )
    # Comillas y barras no rompen el modelo.
    tricky = client.post("/api/catalog/products/llavero-con-tu-nombre/personalize", json={"text": 'Jo"se\\'})
    assert tricky.status_code == 200
    assert (
        client.post("/api/catalog/products/llavero-con-tu-nombre/personalize", json={"text": "x" * 15}).status_code
        == 422
    )
    assert client.post("/api/catalog/products/soporte/personalize", json={"text": "Ana"}).status_code == 404
    assert wait_price(client, "llavero-con-tu-nombre") > 0
