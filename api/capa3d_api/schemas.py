from typing import Literal

from pydantic import BaseModel, Field

Unit = Literal["mm", "cm", "in"]
UNIT_MM: dict[str, float] = {"mm": 1.0, "cm": 10.0, "in": 25.4}


class PlateSummary(BaseModel):
    id: int
    name: str
    objects: list[str]
    triangles: int
    # Medidas del archivo en mm, sin escalar.
    dx: float
    dy: float
    dz: float
    volume_cm3: float
    area_cm2: float
    open_edges: int
    # Colores (filamentos) de la cama y altura en que se mezclan; ver mesh/colors.py.
    colors: int = 1
    color_mix_mm: float = 0.0
    sliced_seconds: float | None = None
    sliced_grams: float | None = None


class ProjectInfoOut(BaseModel):
    plates_from: str
    slicer: str | None = None
    printer: str | None = None
    layer_height: float | None = None
    infill: float | None = None
    filaments: list[dict[str, str]] = []


class FileOut(BaseModel):
    id: str
    name: str
    format: str
    size: int
    plates: list[PlateSummary]
    info: ProjectInfoOut


class QuoteRequest(BaseModel):
    file_id: str
    material: str
    quality: str
    infill: int = Field(ge=0, le=100)
    qty: int = Field(default=1, ge=1, le=500)
    unit: Unit = "mm"
    scale: float = Field(default=100, ge=10, le=400)
    supports: bool = True
    color: str | None = Field(default=None, max_length=40)
    # En archivos de varios colores: imprimirlos así (con cambios de filamento) o en uno solo.
    multicolor: bool = True


class PlateQuote(BaseModel):
    id: int
    name: str
    method: Literal["slicer", "estimate"]
    grams: float
    hours: float
    # Por qué no se laminó esta cama, si se usó el estimado.
    note: str | None = None
    colors: int = 1
    color_changes: int = 0
    purge_grams: float = 0.0


class PriceOut(BaseModel):
    currency: str
    grams: float
    hours: float
    price_per_gram: float
    material_cost: float
    machine_cost: float
    base_fee: float
    unit_price: int
    qty: int
    total: int
    color_changes: int = 0
    purge_grams: float = 0.0


class QuoteOut(BaseModel):
    id: str
    file_id: str
    status: Literal["pending", "done", "failed"]
    params: QuoteRequest
    method: Literal["slicer", "estimate", "mixed"] | None = None
    plates: list[PlateQuote] = []
    price: PriceOut | None = None
    error: str | None = None
    created_at: str
    valid_until: str


class AdminQuote(BaseModel):
    id: str
    status: Literal["pending", "done", "failed"]
    created_at: str
    valid_until: str
    requested_at: str | None
    color: str | None
    file_name: str
    file_format: str
    plates: int
    pieces: int
    params: QuoteRequest
    method: Literal["slicer", "estimate", "mixed"] | None = None
    grams: float | None = None
    hours: float | None = None
    total: int | None = None
    currency: str | None = None
    error: str | None = None
