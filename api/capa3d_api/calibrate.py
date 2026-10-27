"""
Calibra el laminado de la API contra tu slicer (Bambu Studio u otro).

Compara el tiempo y los gramos que da tu slicer con los que calcula la API para las
mismas piezas, y propone time_factor y weight_factor para api/config/catalog.toml.

Uso:
  # Proyectos de Bambu Studio guardados DESPUÉS de laminar (traen tiempo y gramos por cama):
  python -m capa3d_api.calibrate proyecto1.3mf proyecto2.3mf --guardar

  # Cualquier modelo, con los datos que te muestra tu slicer:
  python -m capa3d_api.calibrate pieza.stl --tiempo "1h 23m" --gramos 38.2 --relleno 15 --material PLA
"""

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .catalog import Catalog, load_catalog
from .mesh.load import CAD_FORMATS, load_project, write_stl
from .settings import get_settings
from .slicer import PrusaSlicer, SliceOptions, SlicerError, parse_duration


@dataclass
class Sample:
    label: str
    ref_seconds: float
    ref_grams: float | None
    our_seconds: float
    our_grams: float


def _nearest_quality(cat: Catalog, layer: float | None) -> str:
    if layer is None:
        return next(iter(cat.qualities))
    return min(cat.qualities, key=lambda q: abs(cat.qualities[q].layer_height - layer))


def _material(cat: Catalog, filament: str | None, fallback: str) -> str:
    kind = (filament or "").upper()
    return next((m for m in cat.materials if kind.startswith(m)), fallback)


def _fmt(seconds: float) -> str:
    h, m = divmod(round(seconds / 60), 60)
    return f"{h} h {m:02d} min" if h else f"{m} min"


def collect(args: argparse.Namespace, cat: Catalog, slicer: PrusaSlicer, work: Path) -> list[Sample]:
    samples: list[Sample] = []
    for file in args.archivos:
        ext = file.suffix.lower().lstrip(".")
        if ext in CAD_FORMATS:
            stl = work / f"{file.stem}.stl"
            slicer.step_to_stl(file, stl)
            file, ext = stl, "stl"
        project = load_project(file, ext, file.stem, cat.printer.bed, 1 << 30)
        info = project.info
        manual = args.tiempo is not None
        for plate in project.plates:
            if manual:
                ref_s, ref_g = parse_duration(args.tiempo), args.gramos
            elif plate.sliced and plate.sliced.seconds:
                ref_s, ref_g = plate.sliced.seconds, plate.sliced.grams
            else:
                continue
            layer = args.capa or info.layer_height
            opts = SliceOptions(
                material=args.material or _material(cat, info.filaments[0]["type"] if info.filaments else None, "PLA"),
                quality=_nearest_quality(cat, layer),
                infill=args.relleno if args.relleno is not None else (info.infill if info.infill is not None else 15),
                supports=args.soportes if args.soportes is not None else bool(info.supports),
                layer_height=layer,
            )
            stl = work / f"{file.stem}-{plate.id}.stl"
            write_stl(plate.triangles, stl)
            r = slicer.slice(stl, opts, work / f"{file.stem}-{plate.id}.gcode")
            used_layer = opts.layer_height or cat.qualities[opts.quality].layer_height
            label = f"{file.name} · {plate.name}" + (
                f"  ({opts.material}, capa {used_layer:g} mm, relleno {opts.infill:g}%"
                f"{', soportes' if opts.supports else ''})"
            )
            samples.append(Sample(label, ref_s, ref_g, r.seconds, r.grams))
            if manual:
                break  # con datos manuales, el archivo debe ser una sola pieza
    return samples


def save(catalog_path: Path, time_factor: float, weight_factor: float | None) -> None:
    text = catalog_path.read_text(encoding="utf-8")
    text = re.sub(r"(?m)^time_factor\s*=.*$", f"time_factor = {time_factor:.3f}", text)
    if weight_factor is not None:
        text = re.sub(r"(?m)^weight_factor\s*=.*$", f"weight_factor = {weight_factor:.3f}", text)
    catalog_path.write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m capa3d_api.calibrate", description=__doc__.split("\n\n")[0])
    p.add_argument("archivos", nargs="+", type=Path, help="3MF de Bambu Studio laminados, o un STL/OBJ/3MF/STEP")
    p.add_argument("--tiempo", help='tiempo que da tu slicer, ej. "1h 23m 10s"')
    p.add_argument("--gramos", type=float, help="gramos que da tu slicer")
    p.add_argument("--material", help="PLA, PETG, ABS o TPU (si no, el del archivo)")
    p.add_argument("--capa", type=float, help="altura de capa en mm (si no, la del archivo)")
    p.add_argument("--relleno", type=float, help="relleno en %% (si no, el del archivo)")
    p.add_argument("--soportes", action=argparse.BooleanOptionalAction, default=None, help="con o sin soportes")
    p.add_argument("--guardar", action="store_true", help="escribe los factores en catalog.toml")
    args = p.parse_args(argv)
    if args.tiempo is not None and len(args.archivos) != 1:
        p.error("con --tiempo pasa un solo archivo")

    settings = get_settings()
    cat = load_catalog(settings.catalog_path)
    slicer = PrusaSlicer(settings.slicer_path, cat, settings.slice_timeout_s)
    if slicer.version is None:
        print("No se encontró PrusaSlicer. Instálalo o define CAPA3D_SLICER_PATH.", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        try:
            samples = collect(args, cat, slicer, Path(tmp))
        except (SlicerError, ValueError) as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1
    if not samples:
        print(
            "Ningún archivo trae tiempo de laminado. En Bambu Studio lamina todas las camas y guarda el proyecto,\n"
            'o pasa los datos a mano con --tiempo "1h 23m" --gramos 38.2.',
            file=sys.stderr,
        )
        return 1

    print(f"\nPerfil: {cat.profile_path.name} · PrusaSlicer {slicer.version}\n")
    for s in samples:
        print(s.label)
        grams = f"{s.ref_grams:.1f} g" if s.ref_grams else "—"
        print(f"   tu slicer: {_fmt(s.ref_seconds):>12} {grams:>9}")
        print(f"   la API:    {_fmt(s.our_seconds):>12} {s.our_grams:>7.1f} g\n")

    time_factor = sum(s.ref_seconds for s in samples) / sum(s.our_seconds for s in samples)
    with_grams = [s for s in samples if s.ref_grams]
    weight_factor = sum(s.ref_grams for s in with_grams) / sum(s.our_grams for s in with_grams) if with_grams else None
    print("Factores sugeridos para [calibration] en catalog.toml:")
    print(f"   time_factor = {time_factor:.3f}")
    if weight_factor is not None:
        print(f"   weight_factor = {weight_factor:.3f}")
    if len(samples) < 3:
        print("\nConsejo: calibra con 3 o más piezas distintas (pequeña, mediana, grande) para un factor más fiable.")
    if args.guardar:
        save(settings.catalog_path, time_factor, weight_factor)
        print(f"\nGuardado en {settings.catalog_path}. Reinicia la API para usarlo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
