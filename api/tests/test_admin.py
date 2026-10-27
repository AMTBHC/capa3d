import io
import sqlite3
import time
import zipfile
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

from capa3d_api.main import create_app
from capa3d_api.settings import Settings
from capa3d_api.store import Store

from .builders import bambu_project, binary_stl, cube
from .conftest import needs_slicer

TOKEN = "clave-de-prueba"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def admin_client(tmp_path):
    settings = Settings(data_dir=tmp_path, admin_token=TOKEN, slicer_enabled=False, _env_file=None)
    with TestClient(create_app(settings)) as c:
        yield c


def quote(client, data: bytes, name: str, **kw) -> dict:
    f = client.post("/api/files", files={"file": (name, data)}).json()
    body = {"file_id": f["id"], "material": "PETG", "quality": "estandar", "infill": 20, **kw}
    q = client.post("/api/quotes", json=body).json()
    while q["status"] == "pending":
        time.sleep(0.1)
        q = client.get(f"/api/quotes/{q['id']}").json()
    return q


def test_panel_requiere_clave(admin_client):
    assert admin_client.get("/api/admin/quotes").status_code == 401
    assert admin_client.get("/api/admin/quotes", headers={"Authorization": "Bearer otra"}).status_code == 401
    assert admin_client.get("/api/admin/quotes", headers=AUTH).status_code == 200


def test_panel_desactivado_sin_clave(client):
    assert client.get("/api/admin/quotes", headers=AUTH).status_code == 503


def test_lista_y_pedidos(admin_client):
    a = quote(admin_client, binary_stl(cube(20)), "cubo.stl")
    b = quote(admin_client, bambu_project(), "proyecto.3mf", qty=2)
    r = admin_client.post(f"/api/quotes/{b['id']}/request", json={"color": "Azul"})
    assert r.status_code == 204
    assert admin_client.post("/api/quotes/QNOEXISTE/request", json={}).status_code == 404

    rows = admin_client.get("/api/admin/quotes", headers=AUTH).json()
    assert [x["id"] for x in rows] == [b["id"], a["id"]]
    assert rows[0]["file_name"] == "proyecto.3mf"
    assert rows[0]["plates"] == 2 and rows[0]["pieces"] == 3
    assert rows[0]["color"] == "Azul" and rows[0]["requested_at"]
    assert rows[0]["total"] == b["price"]["total"]
    assert rows[1]["requested_at"] is None

    only = admin_client.get("/api/admin/quotes?requested=true", headers=AUTH).json()
    assert [x["id"] for x in only] == [b["id"]]


def test_descarga_zip(admin_client):
    q = quote(admin_client, binary_stl(cube(20)), "soporte motor.stl")
    admin_client.post(f"/api/quotes/{q['id']}/request", json={"color": "Negro"})
    r = admin_client.get(f"/api/admin/quotes/{q['id']}/download", headers=AUTH)
    assert r.status_code == 200
    assert f"{q['id']}-soporte motor.zip" in unquote(r.headers["content-disposition"])
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert "soporte motor.stl" in z.namelist()
    resumen = z.read("resumen.txt").decode()
    assert q["id"] in resumen and "Negro" in resumen and "TOTAL" in resumen
    assert admin_client.get("/api/admin/quotes/QNOEXISTE/download", headers=AUTH).status_code == 404


@needs_slicer
def test_zip_incluye_gcode(tmp_path):
    settings = Settings(data_dir=tmp_path, admin_token=TOKEN, _env_file=None)
    with TestClient(create_app(settings)) as c:
        q = quote(c, binary_stl(cube(20)), "cubo.stl", supports=False)
        z = zipfile.ZipFile(io.BytesIO(c.get(f"/api/admin/quotes/{q['id']}/download", headers=AUTH).content))
    assert "gcode/cubo-cama-1.gcode" in z.namelist()


def test_migra_base_de_datos_anterior(tmp_path):
    db = tmp_path / "capa3d.db"
    old = sqlite3.connect(db)
    old.executescript(
        "CREATE TABLE quotes (id TEXT PRIMARY KEY, file_id TEXT NOT NULL, params TEXT NOT NULL,"
        " params_key TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL,"
        " valid_until TEXT NOT NULL);"
    )
    old.close()
    Store(db)
    cols = {r[1] for r in sqlite3.connect(db).execute("PRAGMA table_info(quotes)")}
    assert {"requested_at", "requested_color"} <= cols
