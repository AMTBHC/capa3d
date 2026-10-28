"""Precio de una cotización. La fórmula del estimado es la misma de la web (web/src/lib/pricing.ts)."""

import math
from dataclasses import dataclass

from .catalog import Catalog

# Espesor de pared equivalente (cm), desperdicio y sobrecosto de tiempo del estimado.
SHELL_CM = 0.12
WASTE = 1.1
TIME_OVERHEAD = 1.25


@dataclass
class PlateUsage:
    grams: float
    # Horas de impresión sin preparación.
    print_hours: float
    # Cambios de filamento y gramos purgados, ya incluidos en grams y print_hours.
    color_changes: int = 0
    purge_grams: float = 0.0


@dataclass
class Price:
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


def estimate_usage(volume_cm3: float, area_cm2: float, density: float, flow: float, infill: float) -> PlateUsage:
    """Gramos y horas sin slicer: paredes + relleno proporcional."""
    shell = min(volume_cm3, area_cm2 * SHELL_CM)
    extruded = shell + max(0.0, volume_cm3 - shell) * infill / 100
    return PlateUsage(grams=extruded * WASTE * density, print_hours=extruded * 1000 / flow / 3600 * TIME_OVERHEAD)


def price(plates: list[PlateUsage], material: str, qty: int, catalog: Catalog) -> Price:
    """Cada cama suma material, tiempo y su preparación; el cargo base va una vez por copia."""
    p = catalog.pricing
    grams = sum(x.grams for x in plates)
    hours = sum(x.print_hours + p.setup_hours_per_plate for x in plates)
    ppg = catalog.materials[material].price_per_gram
    material_cost = grams * ppg
    machine_cost = hours * p.machine_rate_per_hour
    # Redondeo hacia arriba en .5, igual que Math.round en la web.
    unit = math.floor((p.base_fee + material_cost + machine_cost) / p.round_to + 0.5) * p.round_to
    qty = max(1, int(qty))
    return Price(
        grams=grams,
        hours=hours,
        price_per_gram=ppg,
        material_cost=material_cost,
        machine_cost=machine_cost,
        base_fee=p.base_fee,
        unit_price=int(unit),
        qty=qty,
        total=int(unit) * qty,
        color_changes=sum(x.color_changes for x in plates),
        purge_grams=sum(x.purge_grams for x in plates),
    )
