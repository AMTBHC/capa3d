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

WANTED = re.compile(r"\.(model|rels|config|json)$", re.I)


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

    def emit(path: str, oid: str, mat: np.ndarray, out: list[np.ndarray], depth: int) -> None:
        if depth > 32:
            return
        mf = model(path)
        obj = mf.objects.get(oid) if mf else None
        if not obj:
            return
        if obj.vertices is not None and obj.triangles is not None and len(obj.triangles):
            tri = obj.triangles
            if tri.max() < len(obj.vertices):
                v = obj.vertices @ mat[:3] + mat[3]
                out.append(v[tri] * unit)
        for cpath, cid, cmat in obj.components:
            emit(cpath or path, cid, _then(cmat, mat), out, depth + 1)

    settings = text("Metadata/model_settings.config") or ""
    names = {}
    for so in re.finditer(r"<object\b([^>]*)>([\s\S]*?)</object>", settings):
        oid = _attr(so.group(1), "id")
        md = _metadata(re.split(r"<part\b", so.group(2))[0])
        if oid and md.get("name"):
            names[oid] = md["name"]

    instances: list[ModelObject] = []
    by_object: dict[str, list[int]] = {}
    for i, (path, oid, mat) in enumerate(root.items):
        out: list[np.ndarray] = []
        emit(path or root_path, oid, mat, out, 0)
        tris = np.concatenate(out) if out else np.zeros((0, 3, 3))
        src = model(path or root_path)
        name = names.get(oid) or (src.objects[oid].name if src and oid in src.objects else None) or f"Objeto {oid}"
        instances.append(ModelObject(name=name, triangles=tris))
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

    info = _project_settings(text)
    info.plates_from = plates_from
    return Project(plates=plates, info=info)


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
