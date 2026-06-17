"use client";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const TEX_BASE =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/";

function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

const PINS = [
  { lat: 31.45, lng: -105.2 },
  { lat: 32.18, lng: -107.76 },
  { lat: 34.5, lng: -109.4 },
  { lat: 37.2, lng: -105.5 },
  { lat: 29.6, lng: -81.7 },
  { lat: 41.0, lng: -115.5 },
  { lat: 39.5, lng: -98.35 },
  { lat: 44.0, lng: -103.2 },
];

function Pin({ position }: { position: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 2 + position.x;
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(t) * 0.25);
    if (glow.current) {
      const s = 1.4 + Math.sin(t) * 0.5;
      glow.current.scale.setScalar(s);
      (glow.current.material as THREE.MeshBasicMaterial).opacity =
        0.35 - Math.sin(t) * 0.15;
    }
  });
  return (
    <group position={position}>
      <mesh ref={glow}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color="#9db4ff" transparent opacity={0.35} />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color="#4a6aff" />
      </mesh>
    </group>
  );
}

function Earth() {
  const group = useRef<THREE.Group>(null);
  const radius = 2;

  const [dayMap, bumpMap, specMap] = useLoader(THREE.TextureLoader, [
    TEX_BASE + "earth_atmos_2048.jpg",
    TEX_BASE + "earth_normal_2048.jpg",
    TEX_BASE + "earth_specular_2048.jpg",
  ]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.1;
  });

  const pinPositions = useMemo(
    () => PINS.map((p) => latLngToVec3(p.lat, p.lng, radius * 1.02)),
    []
  );

  return (
    <group ref={group} rotation={[0.35, -1.2, 0.15]}>
      {/* Earth — emissive map keeps the whole globe bright, no gloomy dark side */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={dayMap}
          normalMap={bumpMap}
          roughnessMap={specMap}
          roughness={0.7}
          metalness={0.05}
          emissive={new THREE.Color("#ffffff")}
          emissiveMap={dayMap}
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Subtle thin atmosphere rim — no big blurry halo */}
      <mesh>
        <sphereGeometry args={[radius * 1.012, 64, 64]} />
        <meshBasicMaterial
          color="#9db4ff"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Land pins */}
      {pinPositions.map((pos, i) => (
        <Pin key={i} position={pos} />
      ))}
    </group>
  );
}

export default function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[5, 3, 5]} intensity={1} color="#fff6e0" />
      <directionalLight position={[-5, -2, -4]} intensity={0.7} color="#dfeede" />
      <Stars radius={60} depth={40} count={900} factor={2.5} fade speed={1} />
      <Earth />
    </Canvas>
  );
}
