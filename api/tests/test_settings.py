from capa3d_api.settings import Settings


def test_origenes_cors_separados_por_coma(monkeypatch):
    monkeypatch.setenv("CAPA3D_CORS_ORIGINS", "https://capa3d.co, https://www.capa3d.co")
    assert Settings(_env_file=None).cors_origins == ["https://capa3d.co", "https://www.capa3d.co"]
