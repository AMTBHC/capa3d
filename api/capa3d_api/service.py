"""Lógica de archivos y cotizaciones, independiente de HTTP."""

import hashlib
import json
import math
import secrets
import shutil
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import BinaryIO

import numpy as np

from .catalog import Catalog
from .mesh.analyze import analyze
from .mesh.colors import color_profile
from .mesh.load import CAD_FORMATS, FORMATS, ModelError, load_project, write_stl
from .pricing import PlateUsage, estimate_usage, price
from .schemas import UNIT_MM, QuoteRequest
from .settings import Settings
from .slicer import PrusaSlicer, SliceOptions, SlicerError
from .store import Store


class UploadError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _fits(dims: list[float], bed: tuple[float, float, float]) -> bool:
    return all(d <= b for d, b in zip(sorted(dims), sorted(bed), strict=True))


class QuoteService:
    def __init__(self, settings: Settings, catalog: Catalog, store: Store, slicer: PrusaSlicer):
        self.settings = settings
        self.catalog = catalog
        self.store = store
        self.slicer = slicer
        self.files_dir = settings.data_dir / "files"
        self.pool = ThreadPoolExecutor(max_workers=settings.slicer_workers, thread_name_prefix="slicer")

    @property
    def can_slice(self) -> bool:
        return self.settings.slicer_enabled and self.slicer.version is not None

    def file_dir(self, file_id: str) -> Path:
        # Los ids los generamos nosotros; se validan para no salir de la carpeta.
        if not file_id.isalnum():
            raise KeyError(file_id)
        return self.files_dir / file_id

    # Archivos

    def save_upload(self, filename: str, stream: BinaryIO) -> dict:
        name = Path(filename or "modelo").name[:200]
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in FORMATS:
            raise UploadError("Formato no soportado. Usa STL, OBJ, 3MF o STEP.", 415)

        file_id = secrets.token_hex(12)
        folder = self.file_dir(file_id)
        folder.mkdir(parents=True)
        original = folder / f"original.{ext}"
        limit = self.settings.max_upload_mb * 1024 * 1024
        size = 0
        try:
            with original.open("wb") as out:
                while chunk := stream.read(1024 * 1024):
                    size += len(chunk)
                    if size > limit:
                        raise UploadError(f"El archivo supera {self.settings.max_upload_mb} MB.", 413)
                    out.write(chunk)
            summary = self._process(folder, original, ext, name)
        except Exception:
            shutil.rmtree(folder, ignore_errors=True)
            raise
        self.store.add_file(file_id, name, ext, size, summary)
        return self.file_out(self.store.get_file(file_id))

    def _process(self, folder: Path, original: Path, ext: str, name: str) -> dict:
        source, fmt = original, ext
        if ext in CAD_FORMATS:
            if self.slicer.version is None:
                raise UploadError("Por ahora no podemos abrir archivos STEP. Envíanoslo por WhatsApp.", 422)
            source, fmt = folder / "model.stl", "stl"
            try:
                self.slicer.step_to_stl(original, source)
            except SlicerError as e:
                raise UploadError(f"No pudimos convertir el STEP: {e}", 422) from e
        try:
            project = load_project(
                source,
                fmt,
                name.rsplit(".", 1)[0],
                self.catalog.printer.bed,
                self.settings.max_unzipped_mb * 1024 * 1024,
            )
        except ModelError as e:
            raise UploadError(f"No pudimos leer el modelo: {e}", 422) from e

        plates = []
        for plate in project.plates:
            tris = plate.triangles
            write_stl(tris, folder / f"plate_{plate.id}.stl")
            a = analyze(tris)
            colors, mix = color_profile(tris, plate.colors)
            plates.append(
                {
                    "id": plate.id,
                    "name": plate.name,
                    "objects": [o.name for o in plate.objects],
                    **asdict(a),
                    "colors": colors,
                    "color_mix_mm": round(mix, 2),
                    "sliced_seconds": plate.sliced.seconds if plate.sliced else None,
                    "sliced_grams": plate.sliced.grams if plate.sliced else None,
                }
            )
        return {"plates": plates, "info": asdict(project.info)}

    def with_colors(self, row: dict) -> dict:
        """Archivos subidos antes de que se contaran los colores: se calculan una vez y se guardan."""
        plates = row["summary"]["plates"]
        if row["format"] != "3mf" or all("colors" in p for p in plates):
            return row
        original = self.file_dir(row["id"]) / "original.3mf"
        try:
            project = load_project(
                original, "3mf", row["name"], self.catalog.printer.bed, self.settings.max_unzipped_mb * 1024 * 1024
            )
        except (ModelError, OSError):
            return row
        by_id = {p.id: color_profile(p.triangles, p.colors) for p in project.plates}
        for p in plates:
            colors, mix = by_id.get(p["id"], (1, 0.0))
            p.update(colors=colors, color_mix_mm=round(mix, 2))
        row["summary"].setdefault("info", {})["flush_mm3"] = project.info.flush_mm3
        self.store.update_file_summary(row["id"], row["summary"])
        return row

    def file_out(self, row: dict | None) -> dict:
        if row is None:
            raise KeyError("file")
        row = self.with_colors(row)
        return {"id": row["id"], "name": row["name"], "format": row["format"], "size": row["size"], **row["summary"]}

    def plate_stl(self, file_id: str, plate_id: int) -> Path:
        if self.store.get_file(file_id) is None:
            raise KeyError(file_id)
        path = self.file_dir(file_id) / f"plate_{int(plate_id)}.stl"
        if not path.exists():
            raise KeyError(plate_id)
        return path

    # Cotizaciones

    def validate(self, req: QuoteRequest) -> dict:
        if req.material not in self.catalog.materials:
            raise UploadError(f"Material desconocido: {req.material}", 422)
        if req.quality not in self.catalog.qualities:
            raise UploadError(f"Calidad desconocida: {req.quality}", 422)
        file = self.store.get_file(req.file_id) if req.file_id.isalnum() else None
        if file is None:
            raise UploadError("Archivo no encontrado", 404)
        return file

    def create_quote(self, req: QuoteRequest) -> dict:
        self.validate(req)
        params = req.model_dump()
        # El color no cambia el precio: no forma parte de la clave de caché.
        key_params = {k: v for k, v in params.items() if k != "color"}
        key = hashlib.sha256(json.dumps(key_params, sort_keys=True).encode()).hexdigest()[:32]
        existing = self.store.find_quote(req.file_id, key)
        if existing:
            return existing
        quote_id = "Q" + secrets.token_hex(4).upper()
        valid = datetime.now(UTC) + timedelta(days=self.catalog.pricing.quote_valid_days)
        self.store.add_quote(quote_id, req.file_id, params, key, valid.isoformat(timespec="seconds"))
        self.pool.submit(self._run_quote, quote_id)
        return self.store.get_quote(quote_id)

    def _run_quote(self, quote_id: str) -> None:
        try:
            result = self.compute(quote_id)
            self.store.finish_quote(quote_id, result, None)
        except Exception as e:  # el trabajo nunca debe quedar pendiente
            self.store.finish_quote(quote_id, None, str(e) or e.__class__.__name__)

    def compute(self, quote_id: str) -> dict:
        q = self.store.get_quote(quote_id)
        req = QuoteRequest(**q["params"])
        file = self.with_colors(self.validate(req))
        cat = self.catalog
        k = UNIT_MM[req.unit] * req.scale / 100
        mat, quality = cat.materials[req.material], cat.qualities[req.quality]
        bed = cat.printer.bed
        work = self.file_dir(req.file_id) / "quotes" / quote_id
        work.mkdir(parents=True, exist_ok=True)

        plates = file["summary"]["plates"]
        too_big = [p["name"] for p in plates if not _fits([p["dx"] * k, p["dy"] * k, p["dz"] * k], bed)]
        if too_big:
            raise ValueError(f"{', '.join(too_big)} no cabe en la impresora con esta escala")

        usages: list[PlateUsage] = []
        plates_out = []
        for p in plates:
            note = None
            if self.can_slice:
                try:
                    stl = self._scaled_stl(req.file_id, p["id"], k, work)
                    opts = SliceOptions(req.material, req.quality, req.infill, req.supports)
                    r = self.slicer.slice(stl, opts, work / f"plate_{p['id']}.gcode")
                    cal = cat.calibration
                    usage = PlateUsage(
                        grams=r.grams * cal.weight_factor, print_hours=r.seconds / 3600 * cal.time_factor
                    )
                    method = "slicer"
                except SlicerError as e:
                    note, usage, method = f"No se pudo laminar: {e}", None, "estimate"
            else:
                note, usage, method = "Laminado no disponible", None, "estimate"
            if usage is None:
                vol, area = p["volume_cm3"] * k**3, p["area_cm2"] * k**2
                usage = estimate_usage(vol, area, mat.density, quality.flow, req.infill)
            colors = p.get("colors", 1)
            if req.multicolor and colors > 1:
                usage = self._color_changes(usage, p, k, quality.layer_height, mat.density, file)
                if colors > cat.multicolor.max_colors:
                    most = cat.multicolor.max_colors
                    note = f"Tiene {colors} colores y la impresora carga {most}: te confirmamos cómo hacerlo"
            usages.append(usage)
            plates_out.append(
                {
                    "id": p["id"],
                    "name": p["name"],
                    "method": method,
                    "grams": usage.grams,
                    "hours": usage.print_hours + cat.pricing.setup_hours_per_plate,
                    "note": note,
                    "colors": colors if req.multicolor else 1,
                    "color_changes": usage.color_changes,
                    "purge_grams": usage.purge_grams,
                }
            )

        methods = {p["method"] for p in plates_out}
        pr = price(usages, req.material, req.qty, cat)
        return {
            "method": methods.pop() if len(methods) == 1 else "mixed",
            "plates": plates_out,
            "price": {"currency": cat.currency, **asdict(pr)},
        }

    def _color_changes(self, usage: PlateUsage, plate: dict, k: float, layer: float, density: float, file: dict):
        """Suma la purga y el tiempo de cada cambio de filamento de una cama de varios colores."""
        mc = self.catalog.multicolor
        changes = math.ceil(plate.get("color_mix_mm", 0) * k / layer)
        flush = file["summary"].get("info", {}).get("flush_mm3") or mc.purge_mm3
        purge = changes * flush / 1000 * density
        return PlateUsage(
            grams=usage.grams + purge,
            print_hours=usage.print_hours + changes * mc.change_seconds / 3600,
            color_changes=changes,
            purge_grams=purge,
        )

    def _scaled_stl(self, file_id: str, plate_id: int, k: float, work: Path) -> Path:
        src = self.plate_stl(file_id, plate_id)
        if abs(k - 1) < 1e-9:
            return src
        data = np.fromfile(src, dtype=np.uint8, offset=84).view(
            np.dtype([("normal", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
        )
        dst = work / f"plate_{plate_id}.stl"
        write_stl(data["v"].astype(np.float64) * k, dst)
        return dst

    def quote_out(self, q: dict | None) -> dict:
        if q is None:
            raise KeyError("quote")
        res = q["result"] or {}
        return {
            "id": q["id"],
            "file_id": q["file_id"],
            "status": q["status"],
            "params": q["params"],
            "method": res.get("method"),
            "plates": res.get("plates", []),
            "price": res.get("price"),
            "error": q["error"],
            "created_at": q["created_at"],
            "valid_until": q["valid_until"],
        }

    # Administración

    def admin_quote_out(self, q: dict) -> dict:
        res = q["result"] or {}
        price = res.get("price") or {}
        plates = q["file_summary"]["plates"]
        return {
            "id": q["id"],
            "status": q["status"],
            "created_at": q["created_at"],
            "valid_until": q["valid_until"],
            "requested_at": q.get("requested_at"),
            "color": q.get("requested_color") or q["params"].get("color"),
            "file_name": q["file_name"],
            "file_format": q["file_format"],
            "plates": len(plates),
            "pieces": sum(len(p["objects"]) for p in plates),
            "params": q["params"],
            "method": res.get("method"),
            "grams": price.get("grams"),
            "hours": price.get("hours"),
            "total": price.get("total"),
            "currency": price.get("currency"),
            "error": q["error"],
        }

    def order_zip(self, quote_id: str, dest: Path, header: str = "") -> str:
        """Zip con el archivo del cliente, el G-code de cada cama y un resumen. Devuelve el nombre sugerido."""
        q = self.store.get_quote(quote_id)
        if q is None:
            raise KeyError(quote_id)
        file = self.store.get_file(q["file_id"])
        folder = self.file_dir(q["file_id"])
        original = next(folder.glob("original.*"), None)
        stem = Path(file["name"]).stem
        with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
            if original:
                z.write(original, file["name"])
            for gcode in sorted((folder / "quotes" / quote_id).glob("plate_*.gcode")):
                z.write(gcode, f"gcode/{stem}-cama-{gcode.stem.split('_')[1]}.gcode")
            z.writestr("resumen.txt", header + self._summary_text(q, file))
        return f"{quote_id}-{stem}.zip"

    def _summary_text(self, q: dict, file: dict) -> str:
        p = q["params"]
        res = q["result"] or {}
        price = res.get("price") or {}
        quality = {"borrador": "Borrador", "estandar": "Estándar", "detalle": "Detalle"}.get(p["quality"], p["quality"])
        lines = [
            f"Cotización {q['id']}",
            f"Creada: {_when(q['created_at'])}  ·  válida hasta: {_when(q['valid_until'])}",
            f"Pedida por WhatsApp: {_when(q['requested_at']) if q.get('requested_at') else 'no'}",
            "",
            f"Archivo: {file['name']} ({_size(file['size'])})",
            f"Material: {p['material']}  ·  color: {q.get('requested_color') or p.get('color') or 'sin indicar'}",
            f"Calidad: {quality}  ·  relleno: {p['infill']}%  ·  soportes: {'sí' if p.get('supports') else 'no'}",
            f"Unidades: {p['unit']}  ·  escala: {p['scale']:g}%  ·  cantidad: {p['qty']}",
            "",
        ]
        for pl in res.get("plates", []):
            how = "laminado" if pl["method"] == "slicer" else "estimado"
            note = f" ({pl['note']})" if pl.get("note") else ""
            lines.append(f"{pl['name']}: {pl['grams']:.1f} g · {_duration(pl['hours'])} · {how}{note}")
        if price:
            lines += [
                "",
                f"Filamento:          {_money(price['material_cost'])}",
                f"Máquina:            {_money(price['machine_cost'])}",
                f"Cargo base:         {_money(price['base_fee'])}",
                f"Precio por unidad:  {_money(price['unit_price'])} × {price['qty']}",
                f"TOTAL:              {_money(price['total'])} {price['currency']}",
            ]
        if q.get("error"):
            lines += ["", f"Error: {q['error']}"]
        return "\n".join(lines) + "\n"


def _money(x: float) -> str:
    """$12.345, como se escribe en Colombia."""
    return "$" + f"{round(x):,}".replace(",", ".")


def _duration(hours: float) -> str:
    h, m = divmod(round(hours * 60), 60)
    return f"{h} h {m:02d} min" if h else f"{m} min"


def _size(n: int) -> str:
    return f"{n / 1e6:.1f} MB" if n >= 1e6 else f"{max(1, round(n / 1e3))} KB"


def _when(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M UTC")
