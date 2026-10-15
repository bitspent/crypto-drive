"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

const BLOCKS: Array<{ dx: number; z: number }> = [
  { dx: -3.25, z: 1.0 },
  { dx: -1.55, z: 0.4 },
  { dx: 0.15, z: -0.2 },
  { dx: 1.85, z: -0.8 },
];

function StrataBlock({ sealed, tip }: { sealed: boolean; tip: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial
          color="#141a26"
          roughness={0.8}
          emissive={tip ? "#f7931a" : "#000000"}
          emissiveIntensity={sealed ? 0.9 : tip ? 0.35 : 0}
        />
      </mesh>
      {/* Fee strata on the face */}
      <mesh position={[0, 1.7, 0.76]}>
        <boxGeometry args={[1.52, 0.45, 0.04]} />
        <meshStandardMaterial color="#f97316" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.18, 0.76]}>
        <boxGeometry args={[1.52, 0.57, 0.04]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.69, 0.76]}>
        <boxGeometry args={[1.52, 0.48, 0.04]} />
        <meshStandardMaterial color="#2dd4bf" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.98, 0]}>
        <boxGeometry args={[1.52, 0.06, 1.52]} />
        <meshStandardMaterial color="#ffb84a" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function BlockStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const arm = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    if (arm.current) {
      const speed = win ? 8 : 2.2;
      arm.current.rotation.z = -0.3 + Math.sin(t * speed) * 0.55;
    }
    const node = tip.current;
    if (node) {
      const target = win ? 1.12 : 1;
      node.scale.setScalar(THREE.MathUtils.damp(node.scale.x, target, 4, Math.min(delta, 0.05)));
    }
  });

  return (
    <group position={[x, 0, 0]}>
      {/* Fit-wrap: shrink the row about the ground so blocks + miner clear
          the HUD and frame edges with margin. */}
      <group position={[-0.6, 0, 0]} scale={0.62}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[8.5, 0.25, 4.2]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>

      {BLOCKS.map((b, i) => {
        const isTip = i === BLOCKS.length - 1;
        return (
          <group key={i} position={[b.dx, 0.25, b.z]} ref={isTip ? tip : undefined} scale={isTip && win ? 1.12 : 1}>
            <StrataBlock sealed={isTip && win} tip={isTip} />
          </group>
        );
      })}
      {BLOCKS.slice(0, -1).map((b, i) => {
        const next = BLOCKS[i + 1];
        return (
          <mesh key={i} position={[(b.dx + next.dx) / 2, 1.45, (b.z + next.z) / 2]}>
            <boxGeometry args={[0.55, 0.22, 0.22]} />
            <meshStandardMaterial color={win ? "#0d9488" : "#f7931a"} emissive={win ? "#0d9488" : "#f7931a"} emissiveIntensity={0.5} roughness={0.5} />
          </mesh>
        );
      })}

      {/* Miner */}
      <group position={[3.3, 0.25, 1.3]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.8, 1.1, 0.5]} />
          <meshStandardMaterial color="#4a6076" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.34, 16, 12]} />
          <meshStandardMaterial color="#e0aa7e" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.86, 0]}>
          <sphereGeometry args={[0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f7931a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.92, 0.36]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshBasicMaterial color="#fff8e1" toneMapped={false} />
        </mesh>
        <group ref={arm} position={[-0.45, 1.25, 0]} rotation-z={-0.3}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.24, 0.9, 0.24]} />
            <meshStandardMaterial color="#4a6076" roughness={0.9} />
          </mesh>
          <group position={[0, -0.85, 0.15]} rotation-z={0.5}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 1.0, 8]} />
              <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.85, 0]}>
              <boxGeometry args={[0.7, 0.3, 0.3]} />
              <meshStandardMaterial color="#9aa3af" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        </group>
        <BlobShadow position={[0, 0.03, 0]} radius={1.0} />
      </group>

      <Label position={[-3.25, 3.5, 0.6]} text="~10:00" tone="ink" height={0.4} />
      {win ? <Label position={[1.85, 3.4, -0.8]} text="TIP" tone="amber" height={0.46} /> : null}
      {win ? (
        <Sparkles count={30} scale={[2.6, 2.6, 2.6]} position={[1.85, 2.2, -0.8]} size={5} speed={0.7} color="#ffd75e" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={3.4} opacity={0.25} />
      {active ? <SpotCone position={[1.85, 3.4, -0.8]} /> : null}
      </group>
    </group>
  );
}
