"""Cuánto se mezclan los colores de una cama, para cobrar los cambios de filamento."""

import numpy as np

# Resolución en altura del cálculo (mm).
STEP_MM = 0.05


def color_profile(triangles: np.ndarray, colors: np.ndarray) -> tuple[int, float]:
    """
    Colores distintos y "altura de mezcla": la suma, a lo largo de la pieza, de cuántos
    colores de más hay en cada capa. Por cada capa con k colores la impresora cambia de
    filamento k − 1 veces (empieza la siguiente con el último), así que los cambios de
    color son esta altura dividida por la altura de capa.
    """
    if not len(triangles) or len(colors) != len(triangles):
        return 1, 0.0
    used = np.unique(colors[colors > 0])
    if len(used) <= 1:
        return max(1, len(used)), 0.0
    z = triangles[:, :, 2]
    zmin, zmax = z.min(axis=1), z.max(axis=1)
    base = zmin.min()
    bins = int(np.ceil((zmax.max() - base) / STEP_MM)) + 1
    per_layer = np.zeros(bins, dtype=np.int32)
    for c in used:
        sel = colors == c
        lo = np.floor((zmin[sel] - base) / STEP_MM).astype(np.int64)
        hi = np.ceil((zmax[sel] - base) / STEP_MM).astype(np.int64)
        cover = np.zeros(bins + 1, dtype=np.int32)
        np.add.at(cover, lo, 1)
        np.add.at(cover, np.minimum(hi, bins), -1)
        per_layer += np.cumsum(cover[:-1]) > 0
    return len(used), float(np.maximum(per_layer - 1, 0).sum() * STEP_MM)
