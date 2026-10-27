import tomllib
from pathlib import Path

from pydantic import BaseModel, Field


class Pricing(BaseModel):
    machine_rate_per_hour: float
    base_fee: float
    round_to: int = 100
    setup_hours_per_plate: float = 0.2
    quote_valid_days: int = 7


class Printer(BaseModel):
    bed: tuple[float, float, float]
    profile: str = "profiles/generico.ini"


class Calibration(BaseModel):
    """Factores que acercan el laminado de la API al del slicer del taller."""

    time_factor: float = Field(default=1.0, gt=0)
    weight_factor: float = Field(default=1.0, gt=0)


class Material(BaseModel):
    price_per_gram: float
    density: float = Field(gt=0)
    temperature: int
    bed_temperature: int
    max_volumetric_speed: float | None = Field(default=None, gt=0)
    min_layer_time: float | None = Field(default=None, ge=0)


class Quality(BaseModel):
    layer_height: float = Field(gt=0)
    flow: float = Field(gt=0)


class Catalog(BaseModel):
    currency: str = "COP"
    pricing: Pricing
    printer: Printer
    calibration: Calibration = Calibration()
    materials: dict[str, Material]
    qualities: dict[str, Quality]
    # Carpeta del catálogo, para resolver la ruta del perfil.
    base_dir: Path = Path(".")

    @property
    def profile_path(self) -> Path:
        return (self.base_dir / self.printer.profile).resolve()


def load_catalog(path: Path) -> Catalog:
    with path.open("rb") as f:
        data = tomllib.load(f)
    return Catalog(**data, base_dir=path.parent)
