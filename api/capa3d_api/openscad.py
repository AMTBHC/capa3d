"""Generación de modelos con OpenSCAD (llaveros con nombre)."""

import os
import shutil
import subprocess
from functools import cached_property
from pathlib import Path


class OpenScadError(RuntimeError):
    pass


def find_openscad() -> str | None:
    """OpenSCAD en el PATH o en su carpeta de instalación habitual (Windows, Mac)."""
    if found := shutil.which("openscad"):
        return found
    candidates = [Path("/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD")]
    for env in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
        if base := os.environ.get(env):
            candidates += [Path(base) / "OpenSCAD" / "openscad.exe", Path(base) / "OpenSCAD (Nightly)" / "openscad.exe"]
    return next((str(c) for c in candidates if c.is_file()), None)


def scad_string(text: str) -> str:
    """Texto como literal de OpenSCAD, con comillas y barras escapadas."""
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


class OpenScad:
    def __init__(self, executable: str = "", timeout_s: int = 120):
        self.executable = executable or find_openscad() or ""
        self.timeout_s = timeout_s

    @cached_property
    def available(self) -> bool:
        if not self.executable:
            return False
        try:
            subprocess.run([self.executable, "--version"], capture_output=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired):
            return False
        return True

    def render(self, template: Path, out: Path, variables: dict[str, str]) -> None:
        args = [self.executable, "-q", "-o", str(out)]
        for k, v in variables.items():
            args += ["-D", f"{k}={scad_string(v)}"]
        args.append(str(template))
        try:
            r = subprocess.run(args, capture_output=True, encoding="utf-8", errors="replace", timeout=self.timeout_s)
        except subprocess.TimeoutExpired as e:
            raise OpenScadError("OpenSCAD tardó demasiado") from e
        except OSError as e:
            raise OpenScadError(f"No se pudo ejecutar OpenSCAD: {e}") from e
        if r.returncode != 0 or not out.exists() or out.stat().st_size < 100:
            raise OpenScadError(
                (r.stderr or r.stdout).strip().splitlines()[-1] if (r.stderr or r.stdout) else "OpenSCAD falló"
            )
