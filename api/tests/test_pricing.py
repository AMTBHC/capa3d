import pytest

from capa3d_api.pricing import PlateUsage, estimate_usage, price
from capa3d_api.slicer import parse_duration


def test_estimado_igual_a_la_web(catalog):
    # Pieza de ejemplo de la web: 40 cm³, 90 cm², PLA, calidad estándar, 20 % → $10.000
    u = estimate_usage(40, 90, 1.24, 8, 20)
    assert u.grams == pytest.approx(22.697, abs=1e-3)
    p = price([u], "PLA", 1, catalog)
    assert p.hours == pytest.approx(0.9222, abs=1e-3)
    assert p.unit_price == 10000


def test_varias_camas_cargo_base_una_vez(catalog):
    u = PlateUsage(grams=10, print_hours=1)
    one, two = price([u], "PLA", 1, catalog), price([u, u], "PLA", 3, catalog)
    assert two.grams == 20
    assert two.hours == pytest.approx(2 * one.hours)
    assert two.total == two.unit_price * 3
    expected = 5000 + 20 * 120 + two.hours * 2500
    assert two.unit_price == round(expected / 100) * 100


@pytest.mark.parametrize(
    ("text", "seconds"), [("1h 43m 30s", 6210), ("5m 2s", 302), ("1d 0h 1m 0s", 86460), ("45s", 45)]
)
def test_parse_duration(text, seconds):
    assert parse_duration(text) == seconds
