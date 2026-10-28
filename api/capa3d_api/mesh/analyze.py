from dataclasses import dataclass

import numpy as np

from .project import Triangles

# Por encima de este número de triángulos no se revisan los bordes abiertos.
MAX_TRIANGLES_FOR_EDGE_CHECK = 2_000_000


@dataclass
class MeshAnalysis:
    triangles: int
    dx: float
    dy: float
    dz: float
    volume_cm3: float
    area_cm2: float
    # Aristas que no comparten exactamente dos caras; -1 si no se revisó.
    open_edges: int


def analyze(tris: Triangles) -> MeshAnalysis:
    n = len(tris)
    pts = tris.reshape(-1, 3)
    size = pts.max(axis=0) - pts.min(axis=0)
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    cross = np.cross(b - a, c - a)
    area = 0.5 * np.linalg.norm(cross, axis=1).sum()
    # Volumen con signo de los tetraedros (origen, a, b, c).
    volume = np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6
    return MeshAnalysis(
        triangles=n,
        dx=float(size[0]),
        dy=float(size[1]),
        dz=float(size[2]),
        volume_cm3=float(abs(volume) / 1000),
        area_cm2=float(area / 100),
        open_edges=count_open_edges(tris) if n <= MAX_TRIANGLES_FOR_EDGE_CHECK else -1,
    )


def count_open_edges(tris: Triangles) -> int:
    """Suelda vértices a 1 µm y cuenta las aristas que no tienen exactamente dos caras."""
    keys = np.round(tris.reshape(-1, 3) * 1000).astype(np.int64)
    keys -= keys.min(axis=0)
    # Cada vértice (y luego cada arista) se empaca en un solo entero: ordenar enteros es
    # mucho más rápido que ordenar filas. Hasta 2 m por eje a 1 µm caben en 21 bits.
    if keys.max() < 1 << 21:
        packed = (keys[:, 0] << 42) | (keys[:, 1] << 21) | keys[:, 2]
        _, ids = np.unique(packed, return_inverse=True)
    else:
        _, ids = np.unique(keys, axis=0, return_inverse=True)
    ids = ids.reshape(-1, 3).astype(np.int64)
    edges = np.concatenate([ids[:, [0, 1]], ids[:, [1, 2]], ids[:, [2, 0]]])
    edges = edges[edges[:, 0] != edges[:, 1]]
    edges.sort(axis=1)
    _, counts = np.unique((edges[:, 0] << 32) | edges[:, 1], return_counts=True)
    return int((counts != 2).sum())
