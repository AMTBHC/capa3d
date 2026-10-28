// Llavero con nombre: placa que sigue el contorno del texto, letras en relieve y argolla.
// La API lo genera con: openscad -o llavero.stl -D 'name="Ana"' llavero_nombre.scad
// Medidas en mm.

name = "Capa3D";
size = 10;          // alto de las letras
base_h = 3;         // grosor de la placa
text_h = 1.6;       // relieve de las letras
border = 3;         // margen de la placa alrededor del texto
font = "Liberation Sans:style=Bold";

// OpenSCAD 2021 no mide el texto: se estima el ancho para ubicar la argolla.
w = len(name) * size * 0.62;
ring_x = -w / 2 - 4;

module label() text(name, size = size, font = font, halign = "center", valign = "center");

difference() {
  union() {
    linear_extrude(base_h) union() {
      offset(r = border) label();
      // Puente hasta la argolla
      hull() {
        translate([ring_x, 0]) circle(r = 5.5, $fn = 48);
        translate([-w / 2 + 3, 0]) circle(r = 4, $fn = 32);
      }
    }
    translate([0, 0, base_h]) linear_extrude(text_h) label();
  }
  translate([ring_x, 0, -1]) cylinder(r = 2.6, h = base_h + text_h + 2, $fn = 32);
}
