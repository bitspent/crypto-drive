"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

function coinRing(count: number, radius: number, y: number): Array<[number, number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return [Math.cos(a) * radius, y, Math.sin(a) * radius];
  });
}

export function ScarceStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const reject = useRef<THREE.Group>(null);
  const rejectMat = useRef<THREE.MeshBasicMaterial>(null);
  const startAt = useRef<number | null>(null);

  const coins = useMemo(
    () => [...coinRing(7, 0.5, 2.3), ...coinRing(5, 0.32, 2.48), ...coinRing(3, 0.16, 2.64)],
    [],
  );

  useFrame((state) => {
    const node = reject.current;
    const mat = rejectMat.current;
    if (!node || !mat || reduced) return;
    if (!win) {
      node.visible = false;
      return;
    }
    if (startAt.current === null) startAt.current = state.clock.elapsedTime;
    const p = Math.min((state.clock.elapsedTime - startAt.current) / 1.1, 1);
    // Quadratic arc off the rim.
    const sx = 0;
    const sy = 3.0;
    const cx = 1.4;
    const cy = 4.2;
    const ex = 3.0;
    const ey = 2.0;
    const q = 1 - p;
    node.position.set(q * q * sx + 2 * q * p * cx + p * p * ex, q * q * sy + 2 * q * p * cy + p * p * ey, 0.6);
    node.rotation.z = p * 4;
    mat.opacity = 1 - p;
    node.visible = p < 1;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[2.7, 2.9, 0.15, 28]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>

      {/* Barrel */}
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.95, 0.85, 2.0, 14]} />
        <meshStandardMaterial color="#7c4f22" roughness={0.9} />
      </mesh>
      {[0.55, 1.15, 1.72].map((hy) => (
        <mesh key={hy} position={[0, hy, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.92, 0.07, 10, 28]} />
          <meshStandardMaterial color="#9aa3af" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 2.18, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.95, 0.09, 10, 28]} />
        <meshStandardMaterial color="#c98a3d" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.19, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.88, 28]} />
        <meshBasicMaterial color="#0d0803" toneMapped={false} />
      </mesh>

      {/* Coins mounded to the rim */}
      {coins.map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.18, 0.18, 0.09, 16]} />
          <meshStandardMaterial color="#f7931a" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* Plaque */}
      <mesh position={[0, 1.2, 0.9]}>
        <boxGeometry args={[2.3, 0.7, 0.14]} />
        <meshStandardMaterial color="#f7931a" roughness={0.55} />
      </mesh>
      <Label position={[0, 1.27, 1.12]} text="21,000,000" tone="amber" height={0.36} />
      <Label position={[0, 0.68, 1.08]} text="HARD CAP" tone="ink" height={0.3} />

      {/* Rejected +1 coin */}
      <group ref={reject} position={[0, 3.0, 0.6]} visible={false}>
        <mesh>
          <sphereGeometry args={[0.22, 16, 12]} />
          <meshBasicMaterial ref={rejectMat} color="#c2410c" transparent toneMapped={false} />
        </mesh>
      </group>

      {win ? <Label position={[0, 3.4, 0]} text="SEALED" tone="go" height={0.42} /> : null}
      {win ? (
        <Sparkles count={20} scale={[3, 1.6, 3]} position={[0, 2.5, 0]} size={3} speed={0.5} color="#ffd75e" />
      ) : null}
      <BlobShadow position={[0, 0.16, 0]} radius={1.9} />
      {active ? <SpotCone position={[0, 3.1, 0]} /> : null}
    </group>
  );
}
