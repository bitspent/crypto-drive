"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

export function ChangeStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const signalled = useJourneySignal("change-spent", false);
  const spent = win || signalled;
  const reduced = useReducedMotion();
  const fat = useRef<THREE.Group>(null);
  const fatMat = useRef<THREE.MeshStandardMaterial>(null);
  const pay = useRef<THREE.Group>(null);
  const change = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (reduced) return;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    if (fat.current) {
      fat.current.position.y = damp(fat.current.position.y, spent ? 0.9 : 2.1, 3.5, step);
      const s = damp(fat.current.scale.x, spent ? 0.55 : 1, 3.5, step);
      fat.current.scale.setScalar(s);
    }
    if (fatMat.current) {
      fatMat.current.opacity = damp(fatMat.current.opacity, spent ? 0.25 : 1, 3.5, step);
    }
    for (const node of [pay.current, change.current]) {
      if (!node) continue;
      node.position.y = damp(node.position.y, spent ? 2.1 : 0.5, 3.5, step);
      const s = damp(node.scale.x, spent ? 1 : 0.3, 3.5, step);
      node.scale.setScalar(s);
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[6.4, 0.25, 3.0]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>

      {/* Fat cheque in */}
      <group ref={fat} position={[0, spent && reduced ? 0.9 : 2.0, 0]} scale={spent ? 0.55 : 1}>
        <mesh>
          <boxGeometry args={[2.2, 1.25, 0.1]} />
          <meshStandardMaterial
            ref={fatMat}
            color="#f2eee2"
            roughness={0.85}
            transparent
            opacity={spent ? 0.25 : 1}
          />
        </mesh>
        {!spent ? <Label position={[0, 0.9, 0]} text="SIGN" tone="ink" height={0.32} /> : null}
      </group>

      {/* Two cheques out */}
      <group ref={pay} position={[-1.5, spent ? 2.0 : 0.5, 0.3]} scale={spent ? 1 : 0.3}>
        <mesh>
          <boxGeometry args={[1.5, 0.9, 0.1]} />
          <meshStandardMaterial color="#fbf8ef" roughness={0.85} />
        </mesh>
        <Label position={[0, 0.72, 0]} text="PAY" tone="amber" height={0.32} />
      </group>
      <group ref={change} position={[1.5, spent ? 2.0 : 0.5, 0.3]} scale={spent ? 1 : 0.3}>
        <mesh>
          <boxGeometry args={[1.5, 0.9, 0.1]} />
          <meshStandardMaterial color="#e6f7f4" roughness={0.85} />
        </mesh>
        <Label position={[0, 0.72, 0]} text="CHANGE" tone="go" height={0.32} />
      </group>
      {spent ? <Label position={[0, 2.9, 0.3]} text="TOLL" tone="danger" height={0.3} /> : null}

      {win ? (
        <Sparkles count={24} scale={[4.2, 2.6, 3]} position={[0, 2.1, 0]} size={4} speed={0.6} color="#ffd75e" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={2.8} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
    </group>
  );
}
