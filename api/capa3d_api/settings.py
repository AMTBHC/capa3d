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
    # Desactiva el laminado y cotiza solo con el estimado (útil sin PrusaSlicer).
    slicer_enabled: bool = True
    slice_timeout_s: int = 600
    slicer_workers: int = 2
    max_upload_mb: int = 100
    # Límite al descomprimir un 3MF, contra archivos zip maliciosos.
    max_unzipped_mb: int = 1024
    # Lista separada por comas: "https://capa3d.co,https://www.capa3d.co".
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, v: object) -> object:
        if isinstance(v, str) and not v.startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
