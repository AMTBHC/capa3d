"""Laminado con PrusaSlicer por línea de comandos."""

import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

from .catalog import Catalog


class SlicerError(RuntimeError):
    pass


@dataclass
class SliceResult:
    grams: float
    seconds: float
    filament_mm: float
    gcode: Path


@dataclass
class SliceOptions:
    material: str
    quality: str
    infill: int
    supports: bool


_TIME = re.compile(r"(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?")


def parse_duration(s: str) -> float:
    """'1d 2h 3m 4s' → segundos."""
    m = _TIME.fullmatch(s.strip())
    if not m or not any(m.groups()):
        raise SlicerError(f"Tiempo ilegible: {s!r}")
    d, h, mi, se = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + se


def parse_gcode_stats(gcode: Path, density: float) -> tuple[float, float, float]:
    """(gramos, segundos, mm de filamento) del pie del G-code de PrusaSlicer."""
    with gcode.open("rb") as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - 256 * 1024))
        tail = f.read().decode("utf-8", "replace")

    def field(pattern: str) -> str | None:
        m = re.search(pattern, tail, re.M)
        return m.group(1).strip() if m else None

    time = field(r"^; estimated printing time \(normal mode\) = (.+)$")
    cm3 = field(r"^; filament used \[cm3\] = ([\d.]+)")
    mm = field(r"^; filament used \[mm\] = ([\d.]+)")
    if time is None or cm3 is None:
        raise SlicerError("El G-code no trae tiempo ni filamento")
    return float(cm3) * density, parse_duration(time), float(mm or 0)


def find_prusaslicer() -> str | None:
    """PrusaSlicer en el PATH o en su carpeta de instalación habitual (Windows, Mac)."""
    for name in ("prusa-slicer", "PrusaSlicer", "prusa-slicer-console"):
        if found := shutil.which(name):
            return found
    candidates = [
        Path("/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer"),
        Path("/Applications/Original Prusa Drivers/PrusaSlicer.app/Contents/MacOS/PrusaSlicer"),
    ]
    for env in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
        if base := os.environ.get(env):
            candidates.append(Path(base) / "Prusa3D" / "PrusaSlicer" / "prusa-slicer-console.exe")
    return next((str(c) for c in candidates if c.is_file()), None)


class PrusaSlicer:
    def __init__(self, executable: str, catalog: Catalog, timeout_s: int):
        self.executable = executable or find_prusaslicer() or ""
        self.catalog = catalog
        self.timeout_s = timeout_s

    @cached_property
    def version(self) -> str | None:
        """Versión instalada, o None si no está disponible."""
        if not self.executable:
            return None
        try:
            out = subprocess.run(
                [self.executable, "--help"], capture_output=True, encoding="utf-8", errors="replace", timeout=60
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        m = re.search(r"PrusaSlicer-([\w.+-]+)", out.stdout + out.stderr)
        return m.group(1) if m else None

    def _run(self, args: list[str], cwd: Path) -> None:
        try:
            out = subprocess.run(
                [self.executable, *args],
                cwd=cwd,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.timeout_s,
            )
        except subprocess.TimeoutExpired as e:
            raise SlicerError("El laminado tardó demasiado") from e
        except OSError as e:
            raise SlicerError(f"No se pudo ejecutar PrusaSlicer: {e}") from e
        if out.returncode != 0:
            msg = (out.stderr or out.stdout).strip().splitlines()
            raise SlicerError(msg[-1] if msg else f"PrusaSlicer terminó con código {out.returncode}")

    def step_to_stl(self, step: Path, stl: Path) -> None:
        self._run(["--export-stl", "--output", str(stl), str(step)], cwd=stl.parent)
        if not stl.exists():
            raise SlicerError("PrusaSlicer no generó la malla del STEP")

    def slice(self, stl: Path, opts: SliceOptions, gcode: Path) -> SliceResult:
        cat = self.catalog
        mat = cat.materials[opts.material]
        q = cat.qualities[opts.quality]
        bx, by, bz = cat.printer.bed
        args = [
            "--export-gcode",
            "--load", str(cat.profile_path),
            "--bed-shape", f"0x0,{bx:g}x0,{bx:g}x{by:g},0x{by:g}",
            "--max-print-height", f"{bz:g}",
            "--center", f"{bx / 2:g},{by / 2:g}",
            "--layer-height", f"{q.layer_height:g}",
            "--first-layer-height", f"{max(q.layer_height, 0.2):g}",
            "--fill-density", f"{opts.infill}%",
            "--filament-density", f"{mat.density:g}",
            "--temperature", str(mat.temperature),
            "--first-layer-temperature", str(mat.temperature),
            "--bed-temperature", str(mat.bed_temperature),
            "--first-layer-bed-temperature", str(mat.bed_temperature),
            *(["--support-material", "--support-material-auto"] if opts.supports else []),
            "--output", str(gcode),
            str(stl),
        ]  # fmt: skip
        self._run(args, cwd=gcode.parent)
        grams, seconds, mm = parse_gcode_stats(gcode, mat.density)
        return SliceResult(grams=grams, seconds=seconds, filament_mm=mm, gcode=gcode)
