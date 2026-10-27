from pathlib import Path

import numpy as np
import trimesh

from .project import ModelObject, Plate, Project
from .threemf import parse_3mf

MESH_FORMATS = {"stl", "obj", "3mf"}
CAD_FORMATS = {"step", "stp"}
FORMATS = MESH_FORMATS | CAD_FORMATS


class ModelError(ValueError):
    """El archivo no se pudo leer como modelo 3D."""


def load_project(path: Path, ext: str, name: str, bed: tuple[float, float, float], max_unzipped: int) -> Project:
    """
    Lee un STL, OBJ o 3MF. STL y OBJ dan una cama con un objeto. Un STEP debe
    convertirse antes a STL con el slicer (ver slicer.step_to_stl).
    """
    try:
        if ext == "3mf":
            project = parse_3mf(path.read_bytes(), bed, max_unzipped)
        elif ext in ("stl", "obj"):
            tris = _trimesh_triangles(path, ext)
            if ext == "obj":
                # OBJ viene con Y hacia arriba: (x, y, z) → (x, -z, y), igual que en la web.
                tris = np.stack([tris[..., 0], -tris[..., 2], tris[..., 1]], axis=-1)
            project = Project(plates=[Plate(id=1, name="Cama 1", objects=[ModelObject(name=name, triangles=tris)])])
        else:
            raise ModelError(f"Formato no soportado: {ext}")
    except ModelError:
        raise
    except Exception as e:
        raise ModelError(str(e)) from e

    project.plates = [p for p in project.plates if any(len(o.triangles) for o in p.objects)]
    if not project.plates:
        raise ModelError("El modelo no tiene triángulos")
    for p in project.plates:
        if not np.isfinite(p.triangles).all():
            raise ModelError("El modelo tiene vértices inválidos")
    return project


def _trimesh_triangles(path: Path, ext: str) -> np.ndarray:
    loaded = trimesh.load(path, file_type=ext, process=False, force="mesh")
    if not isinstance(loaded, trimesh.Trimesh) or not len(loaded.faces):
        raise ModelError("El archivo no contiene una malla")
    return np.asarray(loaded.triangles, dtype=np.float64)


def write_stl(tris: np.ndarray, path: Path) -> None:
    """STL binario de triángulos sin indexar, con normales."""
    n = len(tris)
    rec = np.zeros(n, dtype=[("normal", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
    rec["v"] = tris
    normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    rec["normal"] = np.divide(normals, lengths, out=np.zeros_like(normals), where=lengths > 0)
    body = np.uint32(n).tobytes() + rec.tobytes()
    # PrusaSlicer toma el STL como texto si los 128 bytes tras el encabezado son todos < 128.
    # Las normales casi siempre lo evitan; si no, se marcan los atributos (que se ignoran).
    if max(body[:128], default=0) < 128:
        rec["attr"][:3] = 0xFFFF
        body = np.uint32(n).tobytes() + rec.tobytes()
    with path.open("wb") as f:
        f.write(b"Capa3D".ljust(80, b"\0"))
        f.write(body)
