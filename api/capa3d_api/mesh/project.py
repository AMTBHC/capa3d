from dataclasses import dataclass, field
from typing import Literal

import numpy as np

# Triángulos sin indexar: arreglo (n, 3, 3) en mm, Z hacia arriba.
Triangles = np.ndarray


@dataclass
class ModelObject:
    name: str
    triangles: Triangles


@dataclass
class SlicedPlate:
    """Datos que el slicer del cliente guardó en el archivo."""

    seconds: float | None = None
    grams: float | None = None


@dataclass
class Plate:
    id: int
    name: str
    objects: list[ModelObject]
    sliced: SlicedPlate | None = None

    @property
    def triangles(self) -> Triangles:
        if len(self.objects) == 1:
            return self.objects[0].triangles
        return np.concatenate([o.triangles for o in self.objects])


@dataclass
class ProjectInfo:
    plates_from: Literal["file", "position", "single"] = "single"
    slicer: str | None = None
    printer: str | None = None
    layer_height: float | None = None
    infill: float | None = None
    supports: bool | None = None
    filaments: list[dict[str, str]] = field(default_factory=list)


@dataclass
class Project:
    plates: list[Plate]
    info: ProjectInfo = field(default_factory=ProjectInfo)
