"""
Lector de 3MF, equivalente al de la web (web/src/lib/mesh/threemf.ts) para que el sitio
y la API vean las mismas camas. Soporta componentes en otros archivos del paquete,
transformaciones, unidades, camas de Bambu Studio / OrcaSlicer, datos laminados y
ajustes del proyecto. Lee el XML con expresiones regulares: no hay entidades ni DTD
que resolver.
"""

import json
import re
import zipfile
from dataclasses import dataclass, field
from html import unescape
from io import BytesIO

import numpy as np

from .project import ModelObject, Plate, Project, ProjectInfo, SlicedPlate

UNIT_MM = {"micron": 0.001, "millimeter": 1.0, "centimeter": 10.0, "inch": 25.4, "foot": 304.8, "meter": 1000.0}

IDENTITY = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]], dtype=np.float64)

WANTED = re.compile(r"\.(model|rels|config|json|xml)$", re.I)


class ThreeMfError(ValueError):
    pass


def _mat(s: str | None) -> np.ndarray:
    """Matriz 3MF (4×3, el punto se multiplica por la izquierda)."""
    if not s:
        return IDENTITY
    try:
        v = [float(x) for x in s.split()]
    except ValueError:
        return IDENTITY
    return np.array(v, dtype=np.float64).reshape(4, 3) if len(v) == 12 else IDENTITY


def _then(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Aplica `a` y luego `b`."""
    lin = a[:3] @ b[:3]
    return np.vstack([lin, a[3] @ b[:3] + b[3]])


def _attr(attrs: str, name: str) -> str | None:
    m = re.search(rf'(?:^|\s)(?:\w+:)?{name}="([^"]*)"', attrs)
    return unescape(m.group(1)) if m else None


def _metadata(block: str) -> dict[str, str]:
    out = {}
    for m in re.finditer(r"<metadata\b([^>]*)>", block):
        k, v = _attr(m.group(1), "key"), _attr(m.group(1), "value")
        if k is not None and v is not None:
            out[k] = v
    return out


def _norm(p: str) -> str:
    return p.lstrip("/")


@dataclass
class _Obj:
    name: str | None = None
    vertices: np.ndarray | None = None
    triangles: np.ndarray | None = None
    # Filamento pintado en cada triángulo (0 = el de la pieza), si el modelo tiene pintura de color.
    paint: np.ndarray | None = None
    components: list[tuple[str | None, str, np.ndarray]] = field(default_factory=list)


@dataclass
class _Model:
    unit: float
    objects: dict[str, _Obj]
    items: list[tuple[str | None, str, np.ndarray]]


_VERTEX = re.compile(r"<vertex\b([^>]*)>")
_TRIANGLE = re.compile(r"<triangle\b([^>]*)>")
_NUM = {k: re.compile(rf'\b{k}="([^"]*)"') for k in ("x", "y", "z", "v1", "v2", "v3")}
# Camino rápido: los slicers escriben los atributos siempre en este orden.
_FAST = {
    "vertex": re.compile(r'<vertex\s+x="([^"]*)"\s+y="([^"]*)"\s+z="([^"]*)"'),
    "triangle": re.compile(r'<triangle\s+v1="([^"]*)"\s+v2="([^"]*)"\s+v3="([^"]*)"'),
}


def _numbers(body: str, kind: str, keys: tuple[str, str, str], dtype: type) -> np.ndarray:
    tag = _VERTEX if kind == "vertex" else _TRIANGLE
    rows = _FAST[kind].findall(body)
    if len(rows) != len(tag.findall(body)):
        rows = []
        for m in tag.finditer(body):
            attrs = m.group(1)
            rows.append([(n.group(1) if (n := _NUM[k].search(attrs)) else "0") for k in keys])
    return np.array(rows, dtype=np.float64).astype(dtype).reshape(-1, 3)


_PAINT = re.compile(r'\b(?:paint_color|slic3rpe:mmu_segmentation)="([^"]*)"')


def paint_state(code: str) -> int:
    """
    Primer filamento pintado en un triángulo. El código es el árbol de subdivisión de
    PrusaSlicer/Bambu en hexadecimal, leído desde el final: en cada hoja, los 2 bits bajos
    son 0 y los altos el filamento (3 = sigue en el siguiente dígito, sumando 3).
    """
    digits = [int(c, 16) for c in reversed(code) if c in "0123456789abcdefABCDEF"]
    i = 0
    while i < len(digits):
        d = digits[i]
        i += 1
        if d & 0b11:
            continue  # triángulo dividido: sus hijos siguen
        state = d >> 2
        if state == 3 and i < len(digits):
            state = digits[i] + 3
            i += 1
        if state:
            return state
    return 0


def _paint(body: str) -> np.ndarray | None:
    if "paint_color=" not in body and "mmu_segmentation=" not in body:
        return None
    out = []
    for m in _TRIANGLE.finditer(body):
        pm = _PAINT.search(m.group(1))
        out.append(paint_state(pm.group(1)) if pm else 0)
    return np.array(out, dtype=np.int16)


def _parse_model(xml: str) -> _Model:
    unit = UNIT_MM.get((re.search(r'<model\b[^>]*\bunit="([^"]+)"', xml) or [None, "millimeter"])[1], 1.0)
    objects: dict[str, _Obj] = {}
    for om in re.finditer(r"<object\b([^>]*)>([\s\S]*?)</object>", xml):
        oid = _attr(om.group(1), "id")
        if not oid:
            continue
        obj = _Obj(name=_attr(om.group(1), "name"))
        mesh = re.search(r"<mesh\b[^>]*>([\s\S]*?)</mesh>", om.group(2))
        if mesh:
            obj.vertices = _numbers(mesh.group(1), "vertex", ("x", "y", "z"), np.float64)
            obj.triangles = _numbers(mesh.group(1), "triangle", ("v1", "v2", "v3"), np.int64)
            obj.paint = _paint(mesh.group(1))
        for cm in re.finditer(r"<component\b([^>]*)>", om.group(2)):
            cid = _attr(cm.group(1), "objectid")
            if cid:
                path = _attr(cm.group(1), "path")
                obj.components.append((_norm(path) if path else None, cid, _mat(_attr(cm.group(1), "transform"))))
        objects[oid] = obj
    items = []
    build = re.search(r"<build\b[^>]*>([\s\S]*?)</build>", xml)
    if build:
        for im in re.finditer(r"<item\b([^>]*)>", build.group(1)):
            iid = _attr(im.group(1), "objectid")
            if iid:
                path = _attr(im.group(1), "path")
                items.append((_norm(path) if path else None, iid, _mat(_attr(im.group(1), "transform"))))
    return _Model(unit, objects, items)


def _read_zip(data: bytes, max_unzipped: int) -> dict[str, bytes]:
    try:
        zf = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile as e:
        raise ThreeMfError("El 3MF no es un paquete zip válido") from e
    infos = [i for i in zf.infolist() if WANTED.search(i.filename)]
    if sum(i.file_size for i in infos) > max_unzipped:
        raise ThreeMfError("El 3MF descomprimido es demasiado grande")
    out, total = {}, 0
    for info in infos:
        with zf.open(info) as f:
            # No se confía en el tamaño declarado: se corta al pasar el límite.
            chunk = f.read(max_unzipped - total + 1)
        total += len(chunk)
        if total > max_unzipped:
            raise ThreeMfError("El 3MF descomprimido es demasiado grande")
        out[info.filename] = chunk
    return out


def parse_3mf(data: bytes, bed: tuple[float, float, float], max_unzipped: int = 1 << 30) -> Project:
    files = _read_zip(data, max_unzipped)

    def text(name: str) -> str | None:
        return files[name].decode("utf-8", "replace") if name in files else None

    rels = text("_rels/.rels") or ""
    m = re.search(r'<Relationship\b[^>]*Target="([^"]+\.model)"[^>]*Type="[^"]*3dmodel"', rels, re.I) or re.search(
        r'<Relationship\b[^>]*Type="[^"]*3dmodel"[^>]*Target="([^"]+\.model)"', rels, re.I
    )
    root_path = _norm(m.group(1)) if m else next((n for n in files if re.match(r"^3D/[^/]+\.model$", n, re.I)), None)
    if not root_path or root_path not in files:
        raise ThreeMfError("El 3MF no tiene modelo")

    models: dict[str, _Model | None] = {}

    def model(path: str) -> _Model | None:
        if path not in models:
            xml = text(path)
            models[path] = _parse_model(xml) if xml is not None else None
        return models[path]

    root = model(root_path)
    assert root is not None
    unit = root.unit

    settings = text("Metadata/model_settings.config") or ""
    names: dict[str, str] = {}
    # Filamento de cada objeto y de cada parte; las partes que no se imprimen (negativas,
    # modificadores, bloqueadores de soportes) no suman geometría.
    obj_filament: dict[str, int] = {}
    parts: dict[tuple[str, str], tuple[str, int]] = {}
    for so in re.finditer(r"<object\b([^>]*)>([\s\S]*?)</object>", settings):
        oid = _attr(so.group(1), "id")
        if not oid:
            continue
        head, *rest = re.split(r"(?=<part\b)", so.group(2))
        md = _metadata(head)
        if md.get("name"):
            names[oid] = md["name"]
        obj_filament[oid] = _int(md.get("extruder")) or 1
        for part in rest:
            tag = re.match(r"<part\b([^>]*)>", part)
            pid = _attr(tag.group(1), "id") if tag else None
            if pid:
                subtype = _attr(tag.group(1), "subtype") or "normal_part"
                parts[(oid, pid)] = (subtype, _int(_metadata(part).get("extruder")))

    volumes = _prusa_volumes(text("Metadata/Slic3r_PE_model.config"))

    def emit(path: str, oid: str, mat: np.ndarray, out: list[np.ndarray], cols: list[np.ndarray], depth: int,
             filament: int, root: str | None) -> None:  # fmt: skip
        if depth > 32:
            return
        mf = model(path)
        obj = mf.objects.get(oid) if mf else None
        if not obj:
            return
        if obj.vertices is not None and obj.triangles is not None and len(obj.triangles):
            tri = obj.triangles
            if tri.max() < len(obj.vertices):
                base = np.full(len(tri), filament, dtype=np.int16)
                keep = None
                if path == root_path and oid in volumes:
                    # PrusaSlicer: un mismo objeto guarda sus volúmenes como rangos de triángulos.
                    obj_f, vols = volumes[oid]
                    base[:] = obj_f or filament
                    keep = np.zeros(len(tri), dtype=bool)
                    for first, last, printed, f in vols:
                        base[first : last + 1] = f or obj_f or filament
                        keep[first : last + 1] = printed
                paint = obj.paint if obj.paint is not None and len(obj.paint) == len(tri) else None
                c = np.where(paint > 0, paint, base) if paint is not None else base
                if keep is not None and keep.any():
                    tri, c = tri[keep], c[keep]
                v = obj.vertices @ mat[:3] + mat[3]
                out.append(v[tri] * unit)
                cols.append(c)
        for cpath, cid, cmat in obj.components:
            f = filament
            if root is not None:
                subtype, pf = parts.get((root, cid), ("normal_part", 0))
                if subtype != "normal_part":
                    continue
                f = pf or filament
            emit(cpath or path, cid, _then(cmat, mat), out, cols, depth + 1, f, None)

    instances: list[ModelObject] = []
    by_object: dict[str, list[int]] = {}
    for i, (path, oid, mat) in enumerate(root.items):
        out: list[np.ndarray] = []
        cols: list[np.ndarray] = []
        emit(path or root_path, oid, mat, out, cols, 0, obj_filament.get(oid, 1), oid)
        tris = np.concatenate(out) if out else np.zeros((0, 3, 3))
        colors = np.concatenate(cols) if cols else np.zeros(0, dtype=np.int16)
        src = model(path or root_path)
        name = names.get(oid) or (src.objects[oid].name if src and oid in src.objects else None) or f"Objeto {oid}"
        instances.append(ModelObject(name=name, triangles=tris, colors=colors))
        by_object.setdefault(oid, []).append(i)

    plates: list[Plate] = []
    for pl in re.finditer(r"<plate>([\s\S]*?)</plate>", settings):
        head = _metadata(pl.group(1).split("<model_instance>")[0])
        pid = int(head.get("plater_id") or len(plates) + 1)
        objs = []
        for mi in re.finditer(r"<model_instance>([\s\S]*?)</model_instance>", pl.group(1)):
            md = _metadata(mi.group(1))
            idxs = by_object.get(md.get("object_id", ""), [])
            k = int(md.get("instance_id") or 0)
            if k < len(idxs) and len(instances[idxs[k]].triangles):
                objs.append(instances[idxs[k]])
        if objs:
            plates.append(Plate(id=pid, name=head.get("plater_name") or f"Cama {pid}", objects=objs))

    plates_from = "file" if plates else "single"
    if not plates:
        groups = group_by_position([o for o in instances if len(o.triangles)], bed)
        plates_from = "position" if len(groups) > 1 else "single"
        plates = [Plate(id=i + 1, name=f"Cama {i + 1}", objects=g) for i, g in enumerate(groups) if g]
    plates.sort(key=lambda p: p.id)

    slice_info = text("Metadata/slice_info.config")
    if slice_info:
        for sm in re.finditer(r"<plate>([\s\S]*?)</plate>", slice_info):
            md = _metadata(sm.group(1))
            plate = next((p for p in plates if str(p.id) == md.get("index")), None)
            if plate:
                plate.sliced = SlicedPlate(seconds=_pos(md.get("prediction")), grams=_pos(md.get("weight")))

    for plate_id, changes in _layer_color_changes(text).items():
        target = plates if plate_id is None else [p for p in plates if p.id == plate_id]
        for p in target:
            p.layer_color_changes = changes

    info = _project_settings(text)
    info.plates_from = plates_from
    return Project(plates=plates, info=info)


def _prusa_volumes(config: str | None) -> dict[str, tuple[int, list[tuple[int, int, bool, int]]]]:
    """Volúmenes de PrusaSlicer por objeto: (filamento del objeto, [(primero, último, se imprime, filamento)])."""
    out: dict[str, tuple[int, list[tuple[int, int, bool, int]]]] = {}
    for om in re.finditer(r"<object\b([^>]*)>([\s\S]*?)</object>", config or ""):
        oid = _attr(om.group(1), "id")
        if not oid:
            continue
        head = re.split(r"<volume\b", om.group(2))[0]
        vols = []
        for vm in re.finditer(r"<volume\b([^>]*)>([\s\S]*?)</volume>", om.group(2)):
            first, last = _int(_attr(vm.group(1), "firstid")), _int(_attr(vm.group(1), "lastid"))
            md = _metadata(vm.group(2))
            printed = md.get("volume_type", "ModelPart") == "ModelPart" and md.get("modifier", "0") != "1"
            vols.append((first, last, printed, _int(md.get("extruder"))))
        if vols:
            out[oid] = (_int(_metadata(head).get("extruder")), vols)
    return out


def _layer_color_changes(text) -> dict[int | None, int]:
    """
    Cambios de color a una altura ("cambiar filamento en esta capa") por cama; None = todas.
    Bambu/Orca los guardan por cama; PrusaSlicer, para todo el proyecto.
    """
    out: dict[int | None, int] = {}
    bambu = text("Metadata/custom_gcode_per_layer.xml")
    for pm in re.finditer(r"<plate>([\s\S]*?)</plate>", bambu or ""):
        info = re.search(r'<plate_info\b[^>]*\bid="(\d+)"', pm.group(1))
        n = sum(1 for lm in re.finditer(r"<layer\b([^>]*)>", pm.group(1)) if _is_color_change(lm.group(1)))
        if info and n:
            out[int(info.group(1))] = n
    prusa = text("Metadata/Prusa_Slicer_custom_gcode_per_print_z.xml")
    n = sum(1 for cm in re.finditer(r"<code\b([^>]*)>", prusa or "") if _is_color_change(cm.group(1)))
    if n:
        out[None] = n
    return out


def _is_color_change(attrs: str) -> bool:
    # Tipo 0 = cambio de color (M600); también cuenta un cambio de herramienta (T1, T2…).
    kind = _attr(attrs, "type")
    gcode = (_attr(attrs, "gcode") or "").upper()
    return kind == "0" or "M600" in gcode or bool(re.fullmatch(r"T\d+", gcode.strip()))


def _mean_flush(matrix, multiplier) -> float | None:
    """Promedio de la matriz de purga de Bambu (mm³ por cada par de colores distintos)."""
    try:
        values = [float(v) for v in matrix or []]
        mult = float(multiplier or 1)
    except (TypeError, ValueError):
        return None
    n = int(round(len(values) ** 0.5))
    off = [values[i * n + j] for i in range(n) for j in range(n) if i != j and i * n + j < len(values)]
    off = [v for v in off if v > 0]
    return sum(off) / len(off) * mult if off else None


def _int(s: str | None) -> int:
    try:
        return int(s or 0)
    except ValueError:
        return 0


def _pos(s: str | None) -> float | None:
    try:
        v = float(s) if s is not None else None
    except ValueError:
        return None
    return v if v and v > 0 else None


def _project_settings(text) -> ProjectInfo:
    info = ProjectInfo()

    def first(v):
        return v[0] if isinstance(v, list) and v else v

    raw = text("Metadata/project_settings.config")
    if raw:
        try:
            s = json.loads(raw)
        except ValueError:
            return info
        info.slicer = "Bambu Studio / OrcaSlicer"
        info.printer = str(first(s.get("printer_model")) or first(s.get("printer_settings_id")) or "") or None
        info.layer_height = _pos(str(first(s.get("layer_height")) or ""))
        info.infill = _pos(str(first(s.get("sparse_infill_density")) or "").replace("%", ""))
        if (sup := first(s.get("enable_support"))) is not None:
            info.supports = str(sup).lower() in ("1", "true")
        types = s.get("filament_type") or []
        colors = s.get("filament_colour") or []
        info.filaments = [
            {"type": str(t), "color": str(colors[i]) if i < len(colors) else ""} for i, t in enumerate(types)
        ]
        info.flush_mm3 = _mean_flush(s.get("flush_volumes_matrix"), first(s.get("flush_multiplier")))
        return info
    ini = text("Metadata/Slic3r_PE.config")
    if ini:

        def val(k: str) -> str | None:
            m = re.search(rf"^;\s*{k}\s*=\s*(.*)$", ini, re.M)
            return m.group(1).strip() if m else None

        info.slicer = "PrusaSlicer"
        info.printer = val("printer_model") or val("printer_settings_id") or None
        info.layer_height = _pos(val("layer_height"))
        info.infill = _pos((val("fill_density") or "").replace("%", ""))
        if (sup := val("support_material")) is not None:
            info.supports = sup == "1"
        types = [t for t in (val("filament_type") or "").split(";") if t]
        colors = (val("filament_colour") or "").split(";")
        info.filaments = [{"type": t, "color": colors[i] if i < len(colors) else ""} for i, t in enumerate(types)]
    return info


def _fits(w: float, h: float, bed) -> bool:
    return (w <= bed[0] and h <= bed[1]) or (w <= bed[1] and h <= bed[0])


def group_by_position(objects: list[ModelObject], bed) -> list[list[ModelObject]]:
    """
    Sin camas declaradas: si las piezas no caben juntas, se agrupan por cercanía y luego
    se unen grupos mientras quepan en una cama. Si algún grupo no cabe, todo queda junto.
    """
    if len(objects) <= 1:
        return [objects]
    boxes = []
    for o in objects:
        xy = o.triangles.reshape(-1, 3)[:, :2]
        boxes.append((xy.min(axis=0), xy.max(axis=0)))
    lo = np.min([b[0] for b in boxes], axis=0)
    hi = np.max([b[1] for b in boxes], axis=0)
    if _fits(*(hi - lo), bed):
        return [objects]

    gap = 0.15 * min(bed[0], bed[1])
    parent = list(range(len(objects)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (amin, amax), (bmin, bmax) = boxes[i], boxes[j]
            d = np.maximum(0, np.maximum(amin - bmax, bmin - amax))
            if d.max() < gap:
                parent[find(i)] = find(j)

    def box(idx: list[int]):
        mn = np.min([boxes[i][0] for i in idx], axis=0)
        mx = np.max([boxes[i][1] for i in idx], axis=0)
        return {"idx": idx, "c": (mn + mx) / 2, "w": mx[0] - mn[0], "h": mx[1] - mn[1]}

    groups: dict[int, list[int]] = {}
    for i in range(len(objects)):
        groups.setdefault(find(i), []).append(i)
    lst = [box(g) for g in groups.values()]
    if not all(_fits(g["w"], g["h"], bed) for g in lst):
        return [objects]

    while True:
        best = None
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                g = box(lst[i]["idx"] + lst[j]["idx"])
                if _fits(g["w"], g["h"], bed) and (best is None or g["w"] * g["h"] < best[2]["w"] * best[2]["h"]):
                    best = (i, j, g)
        if best is None:
            break
        i, j, g = best
        lst = [x for k, x in enumerate(lst) if k not in (i, j)] + [g]

    def row(cy: float) -> int:
        return round(-cy / (bed[1] * 1.2))

    lst.sort(key=lambda g: (row(g["c"][1]), g["c"][0]))
    return [[objects[i] for i in g["idx"]] for g in lst]
