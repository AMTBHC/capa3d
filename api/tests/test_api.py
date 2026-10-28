import time

import pytest

from .builders import bambu_project, binary_stl, cube
from .conftest import FIXTURES, needs_slicer


def upload(client, name: str, data: bytes):
    return client.post("/api/files", files={"file": (name, data, "application/octet-stream")})


def wait_quote(client, quote_id: str, timeout: float = 120) -> dict:
    end = time.time() + timeout
    while time.time() < end:
        q = client.get(f"/api/quotes/{quote_id}").json()
        if q["status"] != "pending":
            return q
        time.sleep(0.2)
    raise AssertionError("La cotización no terminó a tiempo")


def quote_body(file_id: str, **kw) -> dict:
    return {"file_id": file_id, "material": "PLA", "quality": "estandar", "infill": 20, **kw}


def test_catalogo(client):
    r = client.get("/api/catalog").json()
    assert r["currency"] == "COP"
    assert r["materials"]["PLA"]["price_per_gram"] == 120
    assert r["qualities"]["estandar"]["layer_height"] == 0.2


def test_rechaza_formatos(client):
    r = upload(client, "plano.dwg", b"x")
    assert r.status_code == 415


def test_rechaza_archivos_grandes(tmp_path):
    from fastapi.testclient import TestClient

    from capa3d_api.main import create_app
    from capa3d_api.settings import Settings

    app = create_app(Settings(data_dir=tmp_path, max_upload_mb=1, _env_file=None))
    with TestClient(app) as c:
        r = upload(c, "a.stl", b"\0" * (2 * 1024 * 1024))
    assert r.status_code == 413
    assert not any((tmp_path / "files").iterdir())


def test_archivo_ilegible(client):
    r = upload(client, "a.stl", b"hola")
    assert r.status_code == 422


def test_sube_3mf_con_camas(client):
    r = upload(client, "proyecto.3mf", bambu_project())
    assert r.status_code == 201
    f = r.json()
    assert [p["name"] for p in f["plates"]] == ["Cama 1", "Tapas"]
    assert f["plates"][1]["sliced_grams"] == 12.5
    assert f["info"]["plates_from"] == "file"
    mesh = client.get(f"/api/files/{f['id']}/plates/2.stl")
    assert mesh.status_code == 200 and len(mesh.content) == 84 + 12 * 50


def test_cotiza_con_estimado_sin_slicer(client_no_slicer):
    f = upload(client_no_slicer, "cubo.stl", binary_stl(cube(20))).json()
    q = client_no_slicer.post("/api/quotes", json=quote_body(f["id"], qty=2)).json()
    q = wait_quote(client_no_slicer, q["id"])
    assert q["status"] == "done"
    assert q["method"] == "estimate"
    assert q["price"]["total"] == q["price"]["unit_price"] * 2
    assert q["plates"][0]["note"] == "Laminado no disponible"


def test_reutiliza_cotizaciones_iguales(client_no_slicer):
    f = upload(client_no_slicer, "cubo.stl", binary_stl(cube(20))).json()
    a = client_no_slicer.post("/api/quotes", json=quote_body(f["id"], color="Rojo")).json()
    b = client_no_slicer.post("/api/quotes", json=quote_body(f["id"], color="Azul")).json()
    c = client_no_slicer.post("/api/quotes", json=quote_body(f["id"], infill=50)).json()
    assert a["id"] == b["id"] != c["id"]


def test_valida_la_cotizacion(client_no_slicer):
    f = upload(client_no_slicer, "cubo.stl", binary_stl(cube(20))).json()
    assert client_no_slicer.post("/api/quotes", json=quote_body(f["id"], material="ORO")).status_code == 422
    assert client_no_slicer.post("/api/quotes", json=quote_body("noexiste")).status_code == 404
    assert client_no_slicer.post("/api/quotes", json=quote_body(f["id"], infill=150)).status_code == 422


def test_falla_si_no_cabe(client_no_slicer):
    f = upload(client_no_slicer, "cubo.stl", binary_stl(cube(100))).json()
    q = client_no_slicer.post("/api/quotes", json=quote_body(f["id"], scale=400)).json()
    q = wait_quote(client_no_slicer, q["id"])
    assert q["status"] == "failed"
    assert "no cabe" in q["error"]


@needs_slicer
def test_lamina_con_prusaslicer(client):
    f = upload(client, "cubo.stl", binary_stl(cube(20))).json()
    q = wait_quote(client, client.post("/api/quotes", json=quote_body(f["id"], supports=False)).json()["id"])
    assert q["status"] == "done", q
    assert q["method"] == "slicer"
    # Un cubo de 8 cm³ al 20 % de relleno pesa unos pocos gramos.
    assert 2 < q["plates"][0]["grams"] < 10
    full = wait_quote(
        client, client.post("/api/quotes", json=quote_body(f["id"], infill=100, supports=False)).json()["id"]
    )
    assert full["plates"][0]["grams"] > q["plates"][0]["grams"]


@needs_slicer
def test_lamina_proyecto_con_escala(client):
    f = upload(client, "proyecto.3mf", bambu_project()).json()
    q = wait_quote(client, client.post("/api/quotes", json=quote_body(f["id"], scale=200)).json()["id"])
    assert q["status"] == "done", q
    assert [p["method"] for p in q["plates"]] == ["slicer", "slicer"]
    assert len(q["plates"]) == 2


@needs_slicer
def test_step(client):
    r = upload(client, "caja.step", (FIXTURES / "caja.step").read_bytes())
    assert r.status_code == 201, r.text
    p = r.json()["plates"][0]
    # Caja de 40 × 30 × 20 mm con un agujero de Ø16 mm.
    assert (p["dx"], p["dy"], p["dz"]) == pytest.approx((40, 30, 20), abs=0.01)
    assert p["volume_cm3"] == pytest.approx(24 - 3.1416 * 0.64 * 2, rel=0.02)
    q = wait_quote(client, client.post("/api/quotes", json=quote_body(r.json()["id"])).json()["id"])
    assert q["status"] == "done" and q["method"] == "slicer"


@needs_slicer
def test_step_con_carpeta_de_datos_relativa(tmp_path, monkeypatch):
    """Con CAPA3D_DATA_DIR=./data (como en .env.example) PrusaSlicer debe encontrar el archivo."""
    from fastapi.testclient import TestClient

    from capa3d_api.main import create_app
    from capa3d_api.settings import Settings

    monkeypatch.chdir(tmp_path)
    with TestClient(create_app(Settings(data_dir="./data", _env_file=None))) as c:
        r = upload(c, "caja.step", (FIXTURES / "caja.step").read_bytes())
    assert r.status_code == 201, r.text
