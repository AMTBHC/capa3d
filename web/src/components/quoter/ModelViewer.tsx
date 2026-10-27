"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, PerspectiveCamera, Vector3 } from "three";
import type { MeshAnalysis } from "@/lib/mesh/analyze";
import type { Bed } from "@/lib/checks";

interface Props {
  positions: Float32Array;
  analysis: MeshAnalysis;
  /** Factor mm del archivo → mm reales (unidades × escala). */
  k: number;
  color: string;
  wire: boolean;
  autoRotate: boolean;
  layerMm: number;
  bed: Bed;
  fits: boolean;
}

const FOV = 38;

/** Lo que usamos de los controles de órbita de drei. */
interface Orbit {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update(): void;
}

/** Visor WebGL del modelo del cliente sobre la cama de la impresora, en mm reales y Z hacia arriba. */
export default function ModelViewer(props: Props) {
  return (
    <Canvas
      frameloop={props.autoRotate ? "always" : "demand"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: FOV, up: [0, 0, 1], position: [200, -280, 200], near: 0.1, far: 10000 }}
      style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab" }}
      aria-label="Vista 3D de tu modelo. Arrastra para girarlo y usa la rueda para acercar."
      role="img"
    >
      <hemisphereLight args={["#ffffff", "#30303a", 1.1]} />
      <directionalLight position={[-160, -220, 300]} intensity={1.6} />
      <directionalLight position={[220, 160, 120]} intensity={0.5} />
      <Scene {...props} />
    </Canvas>
  );
}

function Scene({ positions, analysis, k, color, wire, autoRotate, layerMm, bed, fits }: Props) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useLayeredMaterial();
  useEffect(() => {
    updateMaterial(material, color, wire, layerMm);
  }, [material, color, wire, layerMm]);

  const [cx, cy] = analysis.center;
  const size = new Vector3(analysis.dx * k, analysis.dy * k, analysis.dz * k);

  return (
    <>
      <group scale={k}>
        <mesh geometry={geometry} material={material} position={[-cx, -cy, -analysis.minZ]} />
      </group>
      <BedGrid bed={bed} />
      <BuildVolume bed={bed} fits={fits} />
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enableDamping={false} />
      <CameraRig size={size} />
    </>
  );
}

function updateMaterial(m: MeshStandardMaterial, color: string, wire: boolean, layerMm: number) {
  m.color = new Color(color);
  m.wireframe = wire;
  m.userData.uniforms.uLayer.value = layerMm;
  m.needsUpdate = true;
}

/** Material estándar con surcos cada `uLayer` mm de altura, para que se vean las capas de impresión. */
function useLayeredMaterial() {
  const material = useMemo(() => {
    const uniforms = { uLayer: { value: 0.2 }, uStrength: { value: 0.22 } };
    const m = new MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, flatShading: false });
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = "varying float vLayerZ;\n" + shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n vLayerZ = (modelMatrix * vec4(transformed, 1.0)).z;",
      );
      shader.fragmentShader = "uniform float uLayer;\nuniform float uStrength;\nvarying float vLayerZ;\n" + shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float lz = vLayerZ / uLayer;
        float fw = fwidth(lz);
        float groove = smoothstep(0.55, 1.0, abs(fract(lz) - 0.5) * 2.0);
        float fade = 1.0 - smoothstep(0.25, 0.7, fw);
        diffuseColor.rgb *= 1.0 - uStrength * groove * fade;`,
      );
    };
    m.customProgramCacheKey = () => "layered";
    return m;
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

function BedGrid({ bed }: { bed: Bed }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const hx = bed.x / 2, hy = bed.y / 2;
    for (let x = -hx; x <= hx + 1e-6; x += 10) pts.push(x, -hy, 0, x, hy, 0);
    for (let y = -hy; y <= hy + 1e-6; y += 10) pts.push(-hx, y, 0, hx, y, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, [bed.x, bed.y]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.08} />
    </lineSegments>
  );
}

function BuildVolume({ bed, fits }: { bed: Bed; fits: boolean }) {
  const geometry = useMemo(() => {
    const hx = bed.x / 2, hy = bed.y / 2, z = bed.z;
    const c = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
    const pts: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = c[i], [bx, by] = c[(i + 1) % 4];
      pts.push(ax, ay, 0, bx, by, 0, ax, ay, z, bx, by, z, ax, ay, 0, ax, ay, z);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, [bed.x, bed.y, bed.z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={fits ? "#ffffff" : "#EF4F52"} transparent opacity={fits ? 0.12 : 0.6} />
    </lineSegments>
  );
}

/** Encuadra la cámara al modelo cuando cambia de tamaño. */
function CameraRig({ size }: { size: Vector3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Orbit | null;
  const invalidate = useThree((s) => s.invalidate);
  const { x, y, z } = size;

  useEffect(() => {
    if (!controls) return;
    frame(camera, controls, new Vector3(x, y, z));
    invalidate();
  }, [camera, controls, invalidate, x, y, z]);

  return null;
}

function frame(camera: PerspectiveCamera, controls: Orbit, size: Vector3) {
  const radius = Math.max(1, 0.5 * size.length());
  const dist = (radius / Math.sin(((FOV / 2) * Math.PI) / 180)) * 1.05;
  const target = new Vector3(0, 0, size.z / 2);
  const dir = new Vector3(0.55, -0.85, 0.55).normalize();
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.near = dist / 200;
  camera.far = dist * 40 + 2000;
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.minDistance = radius * 0.3;
  controls.maxDistance = dist * 8;
  controls.update();
}
