import tomllib
import unicodedata
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


class Shipping(BaseModel):
    """Costo de envío a domicilio en COP. Se confirma o ajusta al revisar el pedido."""

    cost: int = Field(default=15000, ge=0)
    # Ciudades con otra tarifa (por ejemplo la ciudad del taller).
    cities: dict[str, int] = {}

    def cost_for(self, city: str) -> int:
        key = normalize_city(city)
        for name, cost in self.cities.items():
            if normalize_city(name) == key:
                return cost
        return self.cost


def normalize_city(city: str) -> str:
    """'  Bogotá D.C. ' → 'bogota d.c.'"""
    s = unicodedata.normalize("NFKD", city.strip().lower())
    return " ".join("".join(c for c in s if not unicodedata.combining(c)).split())


class Payments(BaseModel):
    """Opciones de pago. Con deposit_percent > 0 el cliente puede abonar y pagar el resto al recibir."""

    deposit_percent: int = Field(default=50, ge=0, lt=100)


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


class Multicolor(BaseModel):
    """Lo que cuesta cada cambio de filamento en piezas de varios colores (AMS)."""

    # Purga por cambio (mm³) si el archivo no trae la suya.
    purge_mm3: float = Field(default=350, ge=0)
    # Tiempo de cada cambio: cortar, retraer, cargar y purgar.
    change_seconds: float = Field(default=40, ge=0)
    # Colores que carga la impresora a la vez.
    max_colors: int = Field(default=4, ge=1)


class Catalog(BaseModel):
    currency: str = "COP"
    pricing: Pricing
    printer: Printer
    calibration: Calibration = Calibration()
    shipping: Shipping = Shipping()
    payments: Payments = Payments()
    multicolor: Multicolor = Multicolor()
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
