import numpy as np
import pytest

from capa3d_api.mesh.analyze import analyze
from capa3d_api.mesh.colors import color_profile
from capa3d_api.mesh.load import ModelError, load_project
from capa3d_api.mesh.threemf import ThreeMfError, paint_state, parse_3mf

from .builders import (
    bambu_multicolor,
    bambu_project,
    binary_stl,
    cube,
    layer_change_3mf,
    mesh_xml,
    model,
    painted_3mf,
    prusa_multicolor,
    tr,
    zip3mf,
)

BED = (256, 256, 256)


def test_analyze_cubo_cerrado():
    a = analyze(cube(10))
    assert a.triangles == 12
    assert (a.dx, a.dy, a.dz) == (10, 10, 10)
    assert a.volume_cm3 == pytest.approx(1)
    assert a.area_cm2 == pytest.approx(6)
    assert a.open_edges == 0


def test_analyze_detecta_bordes_abiertos():
    assert analyze(cube(10)[:10]).open_edges > 0


def test_stl_y_obj(tmp_path):
    stl = tmp_path / "a.stl"
    stl.write_bytes(binary_stl(cube(20)))
    p = load_project(stl, "stl", "a", BED, 1 << 30)
    assert analyze(p.plates[0].triangles).volume_cm3 == pytest.approx(8)

    obj = tmp_path / "t.obj"
    obj.write_text("v 0 0 0\nv 10 0 0\nv 0 30 0\nf 1 2 3\n")
    a = analyze(load_project(obj, "obj", "t", BED, 1 << 30).plates[0].triangles)
    assert a.dz == pytest.approx(30)  # Y del OBJ pasa a ser Z


def test_archivo_basura(tmp_path):
    bad = tmp_path / "x.stl"
    bad.write_bytes(b"no soy un stl")
    with pytest.raises(ModelError):
        load_project(bad, "stl", "x", BED, 1 << 30)


def test_3mf_unidades_y_transformacion():
    f = zip3mf(
        {
            "3D/3dmodel.model": model(
                "centimeter", f'<object id="1">{mesh_xml(2)}</object>', f'<item objectid="1" transform="{tr(5, 5)}"/>'
            )
        }
    )
    p = parse_3mf(f, BED)
    a = analyze(p.plates[0].triangles)
    assert (a.dx, a.dy, a.dz) == pytest.approx((20, 20, 20))
    assert p.plates[0].triangles[..., 0].min() == pytest.approx(50)


def test_3mf_camas_de_bambu():
    p = parse_3mf(bambu_project(), BED)
    assert [x.name for x in p.plates] == ["Cama 1", "Tapas"]
    assert [o.name for o in p.plates[0].objects] == ["Cubo & tapa", "Cubo & tapa"]
    a = analyze(p.plates[0].triangles)
    assert a.volume_cm3 == pytest.approx(2)
    assert a.dx == pytest.approx(60)
    assert analyze(p.plates[1].triangles).dx == pytest.approx(20)
    assert p.plates[1].sliced.seconds == 3600 and p.plates[1].sliced.grams == 12.5
    assert p.info.plates_from == "file"
    assert p.info.printer == "Bambu Lab X1 Carbon"
    assert p.info.layer_height == 0.2 and p.info.infill == 15


def test_3mf_componentes_anidados():
    comps = f'<component objectid="1"/><component objectid="1" transform="{tr(0, 0, 10)}"/>'
    res = f'<object id="1">{mesh_xml(10)}</object><object id="2"><components>{comps}</components></object>'
    p = parse_3mf(zip3mf({"3D/3dmodel.model": model("millimeter", res, '<item objectid="2"/>')}), BED)
    a = analyze(p.plates[0].triangles)
    assert a.dz == pytest.approx(20) and a.triangles == 24


def test_3mf_agrupa_por_posicion():
    res = f'<object id="1">{mesh_xml(10)}</object>'
    build = "".join(
        f'<item objectid="1" transform="{t}"/>' for t in [tr(10, 10), tr(200, 200), tr(400, 10), tr(420, 30)]
    )
    p = parse_3mf(zip3mf({"3D/3dmodel.model": model("millimeter", res, build)}), BED)
    assert p.info.plates_from == "position"
    assert [len(x.objects) for x in p.plates] == [2, 2]


def test_3mf_atributos_en_otro_orden():
    mesh = (
        '<mesh><vertices><vertex z="0" y="0" x="0"/><vertex y="0" x="10" z="0"/><vertex x="0" z="0" y="10"/>'
        '</vertices><triangles><triangle v3="2" v1="0" v2="1"/></triangles></mesh>'
    )
    p = parse_3mf(
        zip3mf({"3D/3dmodel.model": model("millimeter", f'<object id="1">{mesh}</object>', '<item objectid="1"/>')}),
        BED,
    )
    assert np.allclose(p.plates[0].triangles[0], [[0, 0, 0], [10, 0, 0], [0, 10, 0]])


def test_3mf_zip_bomba():
    f = zip3mf(
        {
            "3D/3dmodel.model": model("millimeter", f'<object id="1">{mesh_xml(10)}</object>', '<item objectid="1"/>')
            + " " * 5000
        }
    )
    with pytest.raises(ThreeMfError):
        parse_3mf(f, BED, max_unzipped=1000)


def test_stl_escrito_se_lee_como_binario(tmp_path):
    """PrusaSlicer confunde con texto un STL binario cuyos primeros bytes son todos < 128."""
    from capa3d_api.mesh.load import write_stl

    for tris in (cube(40) + 700, np.zeros((3, 3, 3))):
        path = tmp_path / "a.stl"
        write_stl(tris, path)
        assert max(path.read_bytes()[80:208]) > 127


def test_colores_por_parte_y_sin_partes_negativas():
    p = parse_3mf(bambu_multicolor(), BED)
    plate = p.plates[0]
    # La parte negativa (cubo de 50) no se imprime.
    assert len(plate.triangles) == 24 and plate.triangles[:, :, 2].max() == 20
    assert set(plate.colors.tolist()) == {1, 2}
    # Dos colores conviven en los primeros 10 mm.
    colors, mix = color_profile(plate.triangles, plate.colors)
    assert colors == 2 and mix == pytest.approx(10, abs=0.1)


def test_colores_pintados():
    assert [paint_state(c) for c in ("4", "8", "0C", "", "1")] == [1, 2, 3, 0, 0]
    plate = parse_3mf(painted_3mf(), BED).plates[0]
    assert sorted(set(plate.colors.tolist())) == [1, 2]
    assert color_profile(plate.triangles, plate.colors)[0] == 2


def test_un_color():
    plate = parse_3mf(
        zip3mf(
            {"3D/3dmodel.model": model("millimeter", f'<object id="1">{mesh_xml(10)}</object>', '<item objectid="1"/>')}
        ),
        BED,
    ).plates[0]
    assert color_profile(plate.triangles, plate.colors) == (1, 0.0)


def test_colores_de_prusaslicer():
    plate = parse_3mf(prusa_multicolor(), BED).plates[0]
    # El modificador (cubo de 40) no se imprime.
    assert len(plate.triangles) == 24 and plate.triangles[:, :, 2].max() == 20
    assert color_profile(plate.triangles, plate.colors) == (2, pytest.approx(10, abs=0.1))


def test_cambios_de_color_por_altura():
    plate = parse_3mf(layer_change_3mf(), BED).plates[0]
    assert plate.layer_color_changes == 2  # la pausa no cuenta
