/**
 * Análisis geométrico de una malla de triángulos sin indexar
 * (9 floats por triángulo, en mm, eje Z hacia arriba).
 */
export interface MeshAnalysis {
  triangles: number;
  dx: number;
  dy: number;
  dz: number;
  volumeCm3: number;
  areaCm2: number;
  /** Bordes que no comparten exactamente dos triángulos; -1 si la malla es demasiado grande para revisarla. */
  openEdges: number;
  center: [number, number, number];
  minZ: number;
}

/** Por encima de este número de triángulos no se revisa la malla en el navegador. */
export const MAX_TRIANGLES_FOR_EDGE_CHECK = 500_000;

export function analyzeMesh(p: Float32Array): MeshAnalysis {
  const n = (p.length / 9) | 0;
  let mnx = Infinity, mny = Infinity, mnz = Infinity;
  let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  let vol = 0, area = 0;

  for (let i = 0; i < n; i++) {
    const o = i * 9;
    const ax = p[o], ay = p[o + 1], az = p[o + 2];
    const bx = p[o + 3], by = p[o + 4], bz = p[o + 5];
    const cx = p[o + 6], cy = p[o + 7], cz = p[o + 8];
    mnx = Math.min(mnx, ax, bx, cx); mny = Math.min(mny, ay, by, cy); mnz = Math.min(mnz, az, bz, cz);
    mxx = Math.max(mxx, ax, bx, cx); mxy = Math.max(mxy, ay, by, cy); mxz = Math.max(mxz, az, bz, cz);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
    // Volumen con signo del tetraedro (origen, a, b, c).
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }

  const dx = mxx - mnx, dy = mxy - mny, dz = mxz - mnz;
  return {
    triangles: n,
    dx, dy, dz,
    volumeCm3: Math.abs(vol) / 1000,
    areaCm2: area / 100,
    openEdges: n <= MAX_TRIANGLES_FOR_EDGE_CHECK ? countOpenEdges(p, n) : -1,
    center: [(mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2],
    minZ: mnz,
  };
}

/** Suelda vértices a 1 µm y cuenta las aristas que no son compartidas por exactamente dos caras. */
function countOpenEdges(p: Float32Array, n: number): number {
  const ids = new Map<string, number>();
  const tri = new Uint32Array(n * 3);
  for (let j = 0; j < n * 3; j++) {
    const key = `${Math.round(p[j * 3] * 1000)},${Math.round(p[j * 3 + 1] * 1000)},${Math.round(p[j * 3 + 2] * 1000)}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    tri[j] = id;
  }
  const edges = new Map<number, number>();
  const add = (a: number, b: number) => {
    if (a === b) return;
    const k = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    edges.set(k, (edges.get(k) ?? 0) + 1);
  };
  for (let t = 0; t < n; t++) {
    add(tri[t * 3], tri[t * 3 + 1]);
    add(tri[t * 3 + 1], tri[t * 3 + 2]);
    add(tri[t * 3 + 2], tri[t * 3]);
  }
  let open = 0;
  edges.forEach((c) => {
    if (c !== 2) open++;
  });
  return open;
}
