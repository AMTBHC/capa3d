from capa3d_api.settings import Settings


def test_origenes_cors_separados_por_coma(monkeypatch):
    monkeypatch.setenv("CAPA3D_CORS_ORIGINS", "https://capa3d.co, https://www.capa3d.co")
    assert Settings(_env_file=None).cors_origins == ["https://capa3d.co", "https://www.capa3d.co"]


def test_rutas_relativas_se_vuelven_absolutas(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("CAPA3D_DATA_DIR", "./data")
    s = Settings(_env_file=None)
    assert s.data_dir == tmp_path / "data"
    assert s.data_dir.is_absolute()


def test_importacion_vacia_desactiva(monkeypatch):
    monkeypatch.setenv("CAPA3D_CATALOG_IMPORT", "")
    assert Settings(_env_file=None).catalog_import is None
    monkeypatch.setenv("CAPA3D_CATALOG_IMPORT", "lista.json")
    assert Settings(_env_file=None).catalog_import.is_absolute()
