"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Portrait, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

const NODES: Array<[number, number, number]> = [
  [-1.1, 2.2, 0.9],
  [1.1, 2.2, 0.9],
  [-1.5, 2.2, -0.4],
  [1.5, 2.2, -0.4],
  [-0.7, 2.2, -1.2],
  [0.7, 2.2, -1.2],
  [0, 3.4, 0],
  [0, 1.1, 0],
];

function NetNode({ position, lit, index }: { position: [number, number, number]; lit: boolean; index: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const node = ref.current;
    if (!node || reduced) return;
    const s = (lit ? 1.3 : 1) + Math.sin(state.clock.elapsedTime * 2 + index * 0.9) * 0.12;
    node.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position} scale={lit ? 1.3 : 1}>
      <sphereGeometry args={[0.16, 14, 14]} />
      <meshStandardMaterial
        color="#f7931a"
        emissive="#f7931a"
        emissiveIntensity={lit ? 1.4 : 0.35}
        roughness={0.4}
      />
    </mesh>
  );
}

export function SatoshiStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const quill = useRef<THREE.Group>(null);
  const author = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    if (quill.current && !win) {
      quill.current.rotation.z = 0.4 + Math.sin(t * 6) * 0.14;
      quill.current.position.x = 0.5 + Math.sin(t * 6) * 0.05;
    }
    if (author.current) {
      author.current.scale.y = 1 + Math.sin(t * 1.6) * 0.015;
    }
    const node = paper.current;
    if (node) {
      const tx = win ? 0.9 : 0.55;
      const ty = win ? 2.3 : 2.3 + Math.sin(t * 1.2) * 0.1;
      const tz = win ? -1.5 : 0.6;
      node.position.set(
        damp(node.position.x, tx, 2.6, step),
        damp(node.position.y, ty, 2.6, step),
        damp(node.position.z, tz, 2.6, step),
      );
      const targetScale = win ? 0.55 : 1;
      node.scale.setScalar(damp(node.scale.x, targetScale, 2.6, step));
      node.rotation.y = damp(node.rotation.y, win ? 0.6 : -0.15 + Math.sin(t * 0.9) * 0.06, 2.6, step);
    }
  });

  return (
    <group position={[x, 0, 0]}>
      {/* Author desk */}
      <group position={[-1.85, 0, 0.6]}>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[2.3, 0.18, 1.3]} />
          <meshStandardMaterial color="#6b4423" roughness={0.9} />
        </mesh>
        {[-0.9, 0.9].map((lx) => (
          <mesh key={lx} position={[lx, 0.45, 0]}>
            <boxGeometry args={[0.16, 0.9, 1.1]} />
            <meshStandardMaterial color="#4a2d14" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[-0.35, 1.12, 0]} rotation-y={0.12}>
          <boxGeometry args={[0.9, 0.04, 1.05]} />
          <meshStandardMaterial color="#f4f1e8" roughness={0.9} />
        </mesh>
        <group ref={quill} position={[0.5, 1.35, 0.2]} rotation-z={0.4}>
          <mesh>
            <cylinderGeometry args={[0.025, 0.04, 0.75, 8]} />
            <meshStandardMaterial color="#e8e4da" roughness={0.6} />
          </mesh>
        </group>
        <BlobShadow position={[0, 0.03, 0]} radius={1.6} />
      </group>

      {/* Hooded author */}
      <group ref={author} position={[-1.85, 0, -1.0]}>
        <mesh position={[0, 1.1, 0]}>
          <coneGeometry args={[0.85, 2.2, 14]} />
          <meshStandardMaterial color="#14161c" roughness={1} />
        </mesh>
        <mesh position={[0, 2.35, 0]}>
          <sphereGeometry args={[0.42, 18, 14]} />
          <meshStandardMaterial color="#1b1e25" roughness={1} />
        </mesh>
        <mesh position={[0, 2.35, 0.24]} scale={[0.72, 0.9, 0.55]}>
          <sphereGeometry args={[0.4, 18, 14]} />
          <meshStandardMaterial color="#efe6d4" roughness={0.7} />
        </mesh>
        {[-0.14, 0.14].map((ex) => (
          <mesh key={ex} position={[ex, 2.46, 0.5]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshBasicMaterial color="#101010" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 2.22, 0.5]}>
          <boxGeometry args={[0.34, 0.07, 0.05]} />
          <meshBasicMaterial color="#141414" toneMapped={false} />
        </mesh>
        <mesh position={[0, 2.1, 0.5]} rotation-z={Math.PI}>
          <torusGeometry args={[0.11, 0.018, 8, 20, Math.PI]} />
          <meshBasicMaterial color="#141414" toneMapped={false} />
        </mesh>
        <BlobShadow position={[0, 0.03, 0]} radius={1.1} />
      </group>
      <Label position={[-1.85, 4.05, -0.6]} text="SATOSHI" tone="ink" height={0.42} />

      {/* Portrait easel behind the desk */}
      <group position={[-1.85, 0, -2.7]}>
        {[-0.8, 0.8].map((lx) => (
          <mesh key={lx} position={[lx, 1.0, 0]}>
            <boxGeometry args={[0.14, 2.0, 0.14]} />
            <meshStandardMaterial color="#4a2d14" roughness={0.9} />
          </mesh>
        ))}
        <Portrait position={[0, 2.75, 0]} src="/images/satoshi.jpeg" width={2.3} height={1.28} />
        <Label position={[0.9, 1.3, 0.1]} text="SATOSHI NAKAMOTO" tone="ink" height={0.26} />
        <BlobShadow position={[0, 0.03, 0]} radius={1.6} />
      </group>

      {/* Flying paper */}
      <group
        ref={paper}
        position={win && reduced ? [0.9, 2.3, -1.5] : [0.55, 2.3, 0.6]}
        scale={win ? 0.55 : 1}
      >
        <mesh>
          <boxGeometry args={[1.05, 1.35, 0.06]} />
          <meshStandardMaterial color="#f4f1e8" roughness={0.9} />
        </mesh>
        {[0.32, 0.05, -0.22].map((ly) => (
          <mesh key={ly} position={[0, ly, 0.035]}>
            <boxGeometry args={[0.7, 0.06, 0.012]} />
            <meshBasicMaterial color="#3c3830" toneMapped={false} />
          </mesh>
        ))}
        <Label position={[0, 0.95, 0]} text="2008" tone="ink" height={0.3} />
      </group>

      {/* Node mesh dome, deep behind the glass — the paper flies INTO it */}
      <group position={[0.9, 0, -1.8]}>
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.3, 16, 12]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={win ? 1.6 : 0.5} roughness={0.4} />
        </mesh>
        {NODES.map((pos, i) => (
          <NetNode key={i} position={pos} lit={win} index={i} />
        ))}
        <mesh position={[0, 2.2, 0]} rotation-x={Math.PI / 2.4}>
          <torusGeometry args={[1.5, 0.03, 8, 40]} />
          <meshBasicMaterial color="#f7931a" transparent opacity={win ? 0.9 : 0.35} toneMapped={false} />
        </mesh>
        <mesh position={[0, 2.2, 0]} rotation-x={Math.PI / 1.7} rotation-y={0.7}>
          <torusGeometry args={[1.5, 0.03, 8, 40]} />
          <meshBasicMaterial color="#f7931a" transparent opacity={win ? 0.9 : 0.35} toneMapped={false} />
        </mesh>
        <Label position={[0, 4.15, 0]} text={win ? "2009 LIVE" : "2009"} tone={win ? "amber" : "ink"} height={0.44} />
        {win ? (
          <Sparkles count={26} scale={[3.4, 3.4, 3.4]} position={[0, 2.2, 0]} size={4} speed={0.5} color="#ffd75e" />
        ) : null}
        <BlobShadow position={[0, 0.03, 0]} radius={1.9} />
      </group>

      {active ? <SpotCone position={[0.4, 3.4, -0.6]} /> : null}
    </group>
  );
}
