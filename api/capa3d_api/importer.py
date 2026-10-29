"""
Descargas para el catálogo importado: modelos y fotos en carpetas públicas de Google Drive.
Cuando un producto viene en varias piezas STL, se arman en un 3MF repartidas en camas.
"""

import json
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

import trimesh

TIMEOUT_S = 60
# Separación entre piezas y entre camas al armar un 3MF con varias piezas, en mm.
GAP = 6.0
PLATE_SPACING = 1.5


class DownloadError(Exception):
    pass


def drive_url(file_id: str) -> str:
    return f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t"


def drive_thumbnail(file_id: str) -> str:
    """Vista previa pública de una imagen de Drive, para mostrarla antes de descargarla."""
    return f"https://drive.google.com/thumbnail?id={file_id}&sz=w800"


def source_url(src: dict) -> str:
    return drive_url(src["drive"]) if "drive" in src else src["url"]


def download(url: str, dest: Path, limit_mb: int) -> Path:
    req = urllib.request.Request(url, headers={"User-Agent": "CR3D"})
    limit = limit_mb * 1024 * 1024
    size = 0
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res, dest.open("wb") as out:
            if "text/html" in res.headers.get("Content-Type", ""):
                raise DownloadError("Drive no entregó el archivo (puede que ya no esté compartido)")
            while chunk := res.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise DownloadError(f"El archivo supera {limit_mb} MB")
                out.write(chunk)
    except DownloadError:
        dest.unlink(missing_ok=True)
        raise
    except OSError as e:
        dest.unlink(missing_ok=True)
        raise DownloadError(str(e)) from e
    return dest


def combine_parts(parts: list[Path], out: Path, bed: tuple[float, float, float]) -> Path:
    """Arma un 3MF con las piezas una al lado de la otra, en tantas camas como hagan falta."""
    meshes = []
    for p in parts:
        m = trimesh.load(p, force="mesh")
        if m.is_empty:
            continue
        m.apply_translation(-m.bounds[0])
        meshes.append((p.stem, m))
    if not meshes:
        raise DownloadError("Las piezas no tienen geometría")
    meshes.sort(key=lambda x: -x[1].extents[1])

    # Estantes: se llena cada fila a lo ancho de la cama; cuando no cabe otra fila, cama nueva.
    plate, x, y, row_h = 0, 0.0, 0.0, 0.0
    placed = []
    for name, m in meshes:
        w, d = m.extents[0], m.extents[1]
        if x and x + w > bed[0]:
            x, y, row_h = 0.0, y + row_h + GAP, 0.0
        if y and y + d > bed[1]:
            plate, x, y, row_h = plate + 1, 0.0, 0.0, 0.0
        m.apply_translation([plate * bed[0] * PLATE_SPACING + x, y, 0])
        placed.append((name, m))
        x += w + GAP
        row_h = max(row_h, d)

    objects, items = [], []
    for i, (name, m) in enumerate(placed, start=1):
        verts = "".join(f'<vertex x="{v[0]:.4f}" y="{v[1]:.4f}" z="{v[2]:.4f}"/>' for v in m.vertices)
        tris = "".join(f'<triangle v1="{f[0]}" v2="{f[1]}" v3="{f[2]}"/>' for f in m.faces)
        objects.append(
            f'<object id="{i}" name="{escape(name)}" type="model"><mesh><vertices>{verts}</vertices>'
            f"<triangles>{tris}</triangles></mesh></object>"
        )
        items.append(f'<item objectid="{i}"/>')
    model = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
        f"<resources>{''.join(objects)}</resources><build>{''.join(items)}</build></model>"
    )
    with ZipFile(out, "w", ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
        )
        z.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
            'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
        )
        z.writestr("3D/3dmodel.model", model)
    return out


def load_manifest(path: Path | None) -> dict:
    if not path or not path.exists():
        return {"collections": [], "products": []}
    return json.loads(path.read_text(encoding="utf-8"))
