import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from capa3d_api.catalog import load_catalog
from capa3d_api.main import create_app
from capa3d_api.settings import Settings

FIXTURES = Path(__file__).parent / "fixtures"
HAS_SLICER = bool(shutil.which("prusa-slicer"))

needs_slicer = pytest.mark.skipif(not HAS_SLICER, reason="PrusaSlicer no está instalado")
needs_openscad = pytest.mark.skipif(not shutil.which("openscad"), reason="OpenSCAD no está instalado")


@pytest.fixture
def catalog():
    return load_catalog(Settings().catalog_path)


def _client(tmp_path: Path, **kw) -> TestClient:
    kw.setdefault("catalog_import", None)
    settings = Settings(data_dir=tmp_path, cors_origins=["http://test"], _env_file=None, **kw)
    return TestClient(create_app(settings))


@pytest.fixture
def client(tmp_path):
    with _client(tmp_path) as c:
        yield c


@pytest.fixture
def client_no_slicer(tmp_path):
    with _client(tmp_path, slicer_enabled=False) as c:
        yield c
