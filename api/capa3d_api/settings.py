from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Configuración del servidor, desde variables de entorno con prefijo CAPA3D_ o un archivo .env."""

    model_config = SettingsConfigDict(env_prefix="CAPA3D_", env_file=".env", extra="ignore")

    data_dir: Path = API_ROOT / "data"
    catalog_path: Path = API_ROOT / "config" / "catalog.toml"
    slicer_path: str = ""
    # Ejecutable de OpenSCAD para los llaveros con nombre (vacío = buscarlo solo).
    openscad_path: str = ""
    # Productos que se importan al arrancar (vacío = ninguno).
    catalog_import: Path | None = API_ROOT / "config" / "catalog_import.json"
    # Desactiva el laminado y cotiza solo con el estimado (útil sin PrusaSlicer).
    slicer_enabled: bool = True
    slice_timeout_s: int = 600
    slicer_workers: int = 2
    # Camas de un mismo archivo que se laminan a la vez.
    plate_workers: int = 3
    max_upload_mb: int = 100
    # Límite al descomprimir un 3MF, contra archivos zip maliciosos.
    max_unzipped_mb: int = 1024
    # Dirección pública del sitio web: para los enlaces de pedido y el regreso desde Wompi.
    site_url: str = "http://localhost:3000"
    # Wompi (comercios.wompi.co → Desarrolladores). Sin llaves, los pagos se marcan a mano en el panel.
    # Llaves de prueba (pub_test_…) usan el sandbox de Wompi; las de producción (pub_prod_…), pagos reales.
    wompi_public_key: str = ""
    wompi_integrity_secret: str = ""
    wompi_events_secret: str = ""
    # Opcional: con la llave privada la API consulta los pagos por referencia, sin depender
    # del regreso del cliente ni de los eventos (útil en tu computador).
    wompi_private_key: str = ""
    # Duración máxima de una conexión en vivo; el navegador se reconecta solo al cerrarse.
    stream_max_seconds: int = 1800
    # Clave del panel de administración (/admin en la web). Vacía = panel desactivado.
    admin_token: str = ""
    # Lista separada por comas: "https://capa3d.co,https://www.capa3d.co".
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("data_dir", "catalog_path")
    @classmethod
    def absolute(cls, v: Path) -> Path:
        # PrusaSlicer corre en otra carpeta: las rutas relativas del .env dejarían de apuntar al archivo.
        return v.expanduser().resolve()

    @field_validator("catalog_import", mode="before")
    @classmethod
    def optional_path(cls, v: object) -> object:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return Path(v).expanduser().resolve()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, v: object) -> object:
        if isinstance(v, str) and not v.startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
