import shutil
import time

import pytest
from fastapi.testclient import TestClient

from capa3d_api import calibrate
from capa3d_api.main import create_app
from capa3d_api.settings import API_ROOT, Settings, get_settings

from .builders import bambu_project, binary_stl, cube
from .conftest import needs_slicer


@pytest.fixture
def config_copy(tmp_path, monkeypatch):
    """Copia de config/ para que --guardar no toque el catálogo real."""
    dst = tmp_path / "config"
    shutil.copytree(API_ROOT / "config", dst)
    monkeypatch.setenv("CAPA3D_CATALOG_PATH", str(dst / "catalog.toml"))
    get_settings.cache_clear()
    yield dst
    get_settings.cache_clear()


@needs_slicer
def test_calibra_con_datos_de_bambu_y_guarda(config_copy, tmp_path, capsys):
    f = tmp_path / "proyecto.3mf"
    f.write_bytes(bambu_project())
    assert calibrate.main([str(f), "--guardar"]) == 0
    out = capsys.readouterr().out
    # Solo la cama 2 del proyecto trae tiempo y gramos de Bambu Studio.
    assert "Tapas" in out and "Cama 1" not in out
    text = (config_copy / "catalog.toml").read_text()
    assert "time_factor = 1.0\n" not in text
    assert "weight_factor = 1.0\n" not in text


@needs_slicer
def test_calibra_con_datos_manuales(config_copy, tmp_path, capsys):
    f = tmp_path / "cubo.stl"
    f.write_bytes(binary_stl(cube(20)))
    assert calibrate.main([str(f), "--tiempo", "30m", "--gramos", "5"]) == 0
    assert "time_factor" in capsys.readouterr().out


def test_sin_datos_de_referencia(config_copy, tmp_path):
    f = tmp_path / "cubo.stl"
    f.write_bytes(binary_stl(cube(20)))
    if shutil.which("prusa-slicer") is None:
        pytest.skip("PrusaSlicer no está instalado")
    assert calibrate.main([str(f)]) == 1


@needs_slicer
def test_la_cotizacion_aplica_los_factores(config_copy, tmp_path):
    def grams(weight_factor: float) -> float:
        path = config_copy / "catalog.toml"
        text = path.read_text()
        path.write_text(text.replace("weight_factor = 1.0", f"weight_factor = {weight_factor}"))
        data = tmp_path / f"data{weight_factor}"
        with TestClient(create_app(Settings(data_dir=data, catalog_path=path, _env_file=None))) as c:
            f = c.post("/api/files", files={"file": ("c.stl", binary_stl(cube(20)))}).json()
            body = {"file_id": f["id"], "material": "PLA", "quality": "estandar", "infill": 20, "supports": False}
            q = c.post("/api/quotes", json=body).json()
            while q["status"] == "pending":
                time.sleep(0.2)
                q = c.get(f"/api/quotes/{q['id']}").json()
        path.write_text(text)
        assert q["status"] == "done", q
        return q["plates"][0]["grams"]

    assert grams(2.0) == pytest.approx(grams(1.0) * 2, rel=1e-6)
