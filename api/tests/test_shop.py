import json
import struct
import time
import zlib

import pytest

from capa3d_api import shop as shop_module
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
    body = {"collection_id": "redes", "name": "Soporte para celular", "subsection": "Soportes", "published": True, **kw}
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
    assert ids == ["mas-pedido", "virales", "redes", "llaveros", "personajes"]
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
    assert pub["collection"]["id"] == "redes" and pub["file_id"] and price > 0
    cols = {c["id"]: c for c in client.get("/api/catalog/collections").json()}
    assert cols["redes"]["count"] == 1 and cols["redes"]["price_from"] == price
    detail = client.get("/api/catalog/collections/redes").json()
    assert [x["id"] for x in detail["products"]] == [p["id"]]
    # El archivo del producto lleva su nombre: así se ve en pedidos y en el panel.
    assert client.get(f"/api/files/{pub['file_id']}").json()["name"] == "Soporte para celular.stl"


def test_producto_sin_publicar_no_se_ve(client):
    p = new_product(client, published=False)
    client.post(
        f"/api/admin/catalog/products/{p['id']}/model", files={"file": ("a.stl", binary_stl(cube(10)))}, headers=ADMIN
    )
    assert client.get(f"/api/catalog/products/{p['id']}").status_code == 404
    assert "redes" not in {c["id"] for c in client.get("/api/catalog/collections").json()}


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
    cover = client.post("/api/admin/catalog/collections/redes/cover", files={"file": ("p.png", png())}, headers=ADMIN)
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
    assert client.post("/api/admin/catalog/products", json={"collection_id": "redes", "name": "X"}).status_code == 401


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


def fake_drive(tmp_path, monkeypatch, files: dict[str, bytes]):
    """Descargas de Drive servidas desde archivos locales: id → contenido."""
    calls = []

    def download(url, dest, limit_mb):
        calls.append(url)
        key = next(k for k in files if k in url)
        dest.write_bytes(files[key])
        return dest

    monkeypatch.setattr(shop_module, "download", download)
    return calls


def test_importa_catalogo_y_baja_el_modelo_al_abrirlo(tmp_path, monkeypatch):
    calls = fake_drive(
        tmp_path, monkeypatch, {"MODELO": binary_stl(cube(20)), "PIEZA": binary_stl(cube(15)), "FOTO": png()}
    )
    manifest = tmp_path / "import.json"
    manifest.write_text(json.dumps({"products": [
        {"key": "a", "collection": "virales", "subsection": "Juguetes", "name": "Cubo viral", "price": 4500,
         "model": {"drive": "MODELO", "name": "cubo.stl"}, "image": {"drive": "FOTO"}},
        {"key": "b", "collection": "redes", "name": "Cubo en piezas",
         "parts": [{"drive": "PIEZA", "name": "a.stl"}, {"drive": "PIEZA", "name": "b.stl"}]},
        {"key": "c", "collection": "personajes", "name": "Personaje", "brand": True,
         "model": {"drive": "MODELO", "name": "p.stl"}},
    ]}))  # fmt: skip
    data = tmp_path / "data"
    with make_client(data, catalog_import=manifest) as c:
        p = c.get("/api/catalog/products/cubo-viral").json()
        # Visible de una vez, con el precio de referencia y la foto original mientras se descarga.
        assert p["file_id"] is None and p["price_from"] == 4500 and p["images"]
        # La galería muestra los productos con foto, no los borradores.
        assert [x["id"] for x in c.get("/api/catalog/featured").json()] == ["cubo-viral"]
        assert {x["id"] for x in c.get("/api/catalog/products").json()} >= {"cubo-viral", "cubo-en-piezas"}
        assert c.get("/api/catalog/products/personaje").status_code == 404  # marcas: borrador
        file_id = c.post("/api/catalog/products/cubo-viral/prepare").json()["file_id"]
        assert c.get(f"/api/files/{file_id}").json()["format"] == "stl"
        assert c.post("/api/catalog/products/cubo-viral/prepare").json()["file_id"] == file_id
        assert sum("MODELO" in u for u in calls) == 1
        # Varias piezas: se arman en un 3MF.
        parts = c.post("/api/catalog/products/cubo-en-piezas/prepare").json()["file_id"]
        f = c.get(f"/api/files/{parts}").json()
        assert f["format"] == "3mf" and len(f["plates"][0]["objects"]) == 2
    # Al reiniciar no se duplica, aunque el producto se haya borrado.
    with make_client(data, catalog_import=manifest) as c:
        c.delete("/api/admin/catalog/products/cubo-en-piezas", headers=ADMIN)
    with make_client(data, catalog_import=manifest) as c:
        names = [
            p["name"]
            for col in c.get("/api/admin/catalog", headers=ADMIN).json()["collections"]
            for p in col["products"]
        ]
        assert sorted(names) == ["Cubo viral", "Llavero con tu nombre", "Personaje"]


def test_fotos_importadas_se_guardan(tmp_path, monkeypatch):
    fake_drive(tmp_path, monkeypatch, {"MODELO": binary_stl(cube(20)), "FOTO": png()})
    manifest = tmp_path / "import.json"
    manifest.write_text(json.dumps({"products": [{"key": "a", "collection": "virales", "name": "Cubo",
        "model": {"drive": "MODELO", "name": "c.stl"}, "image": {"drive": "FOTO"}}]}))  # fmt: skip
    with make_client(tmp_path / "data", catalog_import=manifest) as c:
        c.app.state.shop.localize_images()
        img = c.get("/api/catalog/products/cubo").json()["images"][0]
        assert img.endswith(".png") and c.get(f"/api/catalog/images/{img}").content == png()


def test_quita_colecciones_viejas_vacias(tmp_path):
    from capa3d_api.store import Store

    store = Store(tmp_path / "capa3d.db")
    store.save_collection(
        {"id": "virales", "name": "Virales de redes", "description": "", "emoji": "", "sort": 0, "published": True}
    )
    store.save_collection(
        {"id": "hogar", "name": "Para la casa", "description": "", "emoji": "", "sort": 1, "published": True}
    )
    store.save_collection(
        {"id": "vehiculos", "name": "Vehículos", "description": "", "emoji": "", "sort": 2, "published": True}
    )
    carro = {"id": "x", "collection_id": "vehiculos", "name": "Carro", "kind": "model", "subsection": "",
             "description": "", "default_color": "", "sort": 0, "badges": [], "images": [], "sizes": [],
             "published": False}  # fmt: skip
    store.save_product(carro)
    with make_client(tmp_path) as c:
        cols = {x["id"]: x for x in c.get("/api/admin/catalog", headers=ADMIN).json()["collections"]}
        assert "hogar" not in cols and "vehiculos" in cols and cols["virales"]["name"] == "Novedades virales"
