"""Modelos de prueba generados en memoria."""

import io
import json
import zipfile

import numpy as np

CUBE_FACES = [
    (0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4),
    (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7),
]  # fmt: skip


def cube_vertices(s: float) -> list[tuple[float, float, float]]:
    return [(0, 0, 0), (s, 0, 0), (s, s, 0), (0, s, 0), (0, 0, s), (s, 0, s), (s, s, s), (0, s, s)]


def cube(s: float = 10) -> np.ndarray:
    v = np.array(cube_vertices(s), dtype=np.float64)
    return v[np.array(CUBE_FACES)]


def binary_stl(tris: np.ndarray) -> bytes:
    rec = np.zeros(len(tris), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    rec["v"] = tris
    return b"\0" * 80 + np.uint32(len(tris)).tobytes() + rec.tobytes()


def mesh_xml(s: float) -> str:
    vs = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in cube_vertices(s))
    ts = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in CUBE_FACES)
    return f"<mesh><vertices>{vs}</vertices><triangles>{ts}</triangles></mesh>"


RELS = (
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
    'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'
)


def tr(x: float, y: float, z: float = 0) -> str:
    return f"1 0 0 0 1 0 0 0 1 {x} {y} {z}"


def zip3mf(files: dict[str, str | bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("_rels/.rels", RELS)
        for k, v in files.items():
            z.writestr(k, v)
    return buf.getvalue()


def model(unit: str, resources: str, build: str) -> str:
    return (
        f'<?xml version="1.0"?><model unit="{unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
        f"<resources>{resources}</resources><build>{build}</build></model>"
    )


def bambu_project() -> bytes:
    """Igual que bambuProject() en web/src/lib/testing.ts."""

    def sub(s: float) -> str:
        return model("millimeter", f'<object id="1" type="model">{mesh_xml(s)}</object>', "")

    comp = '<components><component p:path="/3D/Objects/object_{n}.model" objectid="1" transform="{t}"/></components>'
    ident = "1 0 0 0 1 0 0 0 1 0 0 0"
    root = (
        '<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"'
        ' xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>'
        f'<object id="2" type="model">{comp.format(n=1, t=ident)}</object>'
        f'<object id="4" type="model">{comp.format(n=2, t=ident)}</object>'
        f'</resources><build><item objectid="2" transform="{tr(100, 100)}" printable="1"/>'
        f'<item objectid="4" transform="{tr(370, 100)}" printable="1"/>'
        f'<item objectid="2" transform="{tr(150, 100)}" printable="1"/></build></model>'
    )

    def md(k: str, v: object) -> str:
        return f'<metadata key="{k}" value="{v}"/>'

    def inst(o: int, i: int) -> str:
        return f"<model_instance>{md('object_id', o)}{md('instance_id', i)}</model_instance>"

    settings = (
        '<?xml version="1.0"?><config>'
        f'<object id="2">{md("name", "Cubo &amp; tapa")}<part id="1">{md("name", "parte")}</part></object>'
        f'<object id="4">{md("name", "Cubo grande")}</object>'
        f"<plate>{md('plater_id', 1)}{md('plater_name', '')}{inst(2, 0)}{inst(2, 1)}</plate>"
        f"<plate>{md('plater_id', 2)}{md('plater_name', 'Tapas')}{inst(4, 0)}</plate>"
        "</config>"
    )
    slice_info = (
        f'<?xml version="1.0"?><config><plate>{md("index", 2)}{md("prediction", 3600)}{md("weight", 12.5)}'
        '<filament id="1" type="PETG" color="#FFFFFF" used_g="12.5"/></plate></config>'
    )
    project = json.dumps(
        {
            "printer_model": "Bambu Lab X1 Carbon",
            "layer_height": "0.2",
            "sparse_infill_density": "15%",
            "filament_type": ["PETG"],
            "filament_colour": ["#FFFFFF"],
        }
    )
    return zip3mf(
        {
            "3D/3dmodel.model": root,
            "3D/Objects/object_1.model": sub(10),
            "3D/Objects/object_2.model": sub(20),
            "Metadata/model_settings.config": settings,
            "Metadata/slice_info.config": slice_info,
            "Metadata/project_settings.config": project,
        }
    )


def bambu_multicolor() -> bytes:
    """Un objeto de Bambu con dos partes de distinto filamento y una parte negativa."""
    sub = model(
        "millimeter",
        f'<object id="1" type="model">{mesh_xml(20)}</object>'
        f'<object id="2" type="model">{mesh_xml(10)}</object>'
        f'<object id="3" type="model">{mesh_xml(50)}</object>',
        "",
    )
    comp = '<component p:path="/3D/Objects/object_1.model" objectid="{n}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>'
    root = (
        '<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"'
        ' xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>'
        f'<object id="9" type="model"><components>{"".join(comp.format(n=n) for n in (1, 2, 3))}</components></object>'
        f'</resources><build><item objectid="9" transform="{tr(100, 100)}"/></build></model>'
    )
    settings = (
        '<config><object id="9"><metadata key="name" value="Llavero"/><metadata key="extruder" value="1"/>'
        '<part id="1" subtype="normal_part"><metadata key="extruder" value="1"/></part>'
        '<part id="2" subtype="normal_part"><metadata key="extruder" value="2"/></part>'
        '<part id="3" subtype="negative_part"><metadata key="extruder" value="0"/></part>'
        "</object></config>"
    )
    return zip3mf(
        {"3D/3dmodel.model": root, "3D/Objects/object_1.model": sub, "Metadata/model_settings.config": settings}
    )


def painted_3mf() -> bytes:
    """Cubo de 20 mm con una cara lateral pintada con el filamento 2."""
    vs = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in cube_vertices(20))
    ts = "".join(
        f'<triangle v1="{a}" v2="{b}" v3="{c}"' + (' paint_color="8"' if i == 4 else "") + "/>"
        for i, (a, b, c) in enumerate(CUBE_FACES)
    )
    mesh = f"<mesh><vertices>{vs}</vertices><triangles>{ts}</triangles></mesh>"
    return zip3mf(
        {
            "3D/3dmodel.model": model(
                "millimeter", f'<object id="1" type="model">{mesh}</object>', '<item objectid="1"/>'
            )
        }
    )


def prusa_multicolor() -> bytes:
    """Objeto de PrusaSlicer con dos volúmenes (filamentos 1 y 2) y un modificador, en un mismo mesh."""
    a, b, c = cube(20), cube(10) + [0, 0, 0], cube(40)
    tris = np.concatenate([a, b, c])
    verts = tris.reshape(-1, 3)
    vs = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in verts)
    ts = "".join(f'<triangle v1="{3 * i}" v2="{3 * i + 1}" v3="{3 * i + 2}"/>' for i in range(len(tris)))
    mesh = f"<mesh><vertices>{vs}</vertices><triangles>{ts}</triangles></mesh>"
    config = (
        '<config><object id="1" instances_count="1"><metadata type="object" key="extruder" value="1"/>'
        '<volume firstid="0" lastid="11"><metadata type="volume" key="volume_type" value="ModelPart"/>'
        '<metadata type="volume" key="extruder" value="1"/></volume>'
        '<volume firstid="12" lastid="23"><metadata type="volume" key="volume_type" value="ModelPart"/>'
        '<metadata type="volume" key="extruder" value="2"/></volume>'
        '<volume firstid="24" lastid="35"><metadata type="volume" key="volume_type" value="ParameterModifier"/>'
        '<metadata type="volume" key="extruder" value="3"/></volume></object></config>'
    )
    return zip3mf({
        "3D/3dmodel.model": model("millimeter", f'<object id="1" type="model">{mesh}</object>', '<item objectid="1"/>'),
        "Metadata/Slic3r_PE_model.config": config,
    })  # fmt: skip


def layer_change_3mf() -> bytes:
    """Cubo de un color con dos cambios de color por altura (Bambu)."""
    gcodes = (
        '<?xml version="1.0"?><custom_gcodes_per_layer><plate><plate_info id="1"/>'
        '<layer top_z="5" type="0" extruder="1" color="#FFFFFF" extra="" gcode="M600"/>'
        '<layer top_z="10" type="0" extruder="1" color="#000000" extra="" gcode="M600"/>'
        '<layer top_z="12" type="1" extruder="1" color="" extra="" gcode="M400 U1"/>'
        "</plate></custom_gcodes_per_layer>"
    )
    settings = (
        '<config><plate><metadata key="plater_id" value="1"/><model_instance>'
        '<metadata key="object_id" value="1"/><metadata key="instance_id" value="0"/></model_instance></plate></config>'
    )
    cube_model = model("millimeter", f'<object id="1" type="model">{mesh_xml(20)}</object>', '<item objectid="1"/>')
    return zip3mf({
        "3D/3dmodel.model": cube_model,
        "Metadata/model_settings.config": settings,
        "Metadata/custom_gcode_per_layer.xml": gcodes,
    })  # fmt: skip


def copies_3mf(n: int) -> bytes:
    """n camas de Bambu, cada una con una copia del mismo cubo en otro lugar."""
    items = "".join(f'<item objectid="1" transform="{tr(20 + i * 300, 20)}"/>' for i in range(n))
    plates = "".join(
        f'<plate><metadata key="plater_id" value="{i + 1}"/><model_instance><metadata key="object_id" value="1"/>'
        f'<metadata key="instance_id" value="{i}"/></model_instance></plate>'
        for i in range(n)
    )
    return zip3mf({
        "3D/3dmodel.model": model("millimeter", f'<object id="1" type="model">{mesh_xml(15)}</object>', items),
        "Metadata/model_settings.config": f"<config>{plates}</config>",
    })  # fmt: skip
