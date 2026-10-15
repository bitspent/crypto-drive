"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

function StackCard({
  index,
  progress,
}: {
  index: number;
  progress: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<THREE.Group>(null);
  const center = index - 1;

  const target = {
    ry: (1 - progress) * center * -0.5,
    rz: (1 - progress) * center * 0.16,
    px: center * (1 - progress) * 1.15 + center * progress * 0.14,
    py: 1.55 + index * (0.62 - progress * 0.37),
    pz: index * 0.18,
  };

  useFrame((_, delta) => {
    const node = ref.current;
    if (!node || reduced) return;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    node.rotation.y = damp(node.rotation.y, target.ry, 5, step);
    node.rotation.z = damp(node.rotation.z, target.rz, 5, step);
    node.position.x = damp(node.position.x, target.px, 5, step);
    node.position.y = damp(node.position.y, target.py, 5, step);
    node.position.z = damp(node.position.z, target.pz, 5, step);
  });

  return (
    <group
      ref={ref}
      position={[target.px, target.py, target.pz]}
      rotation={[0, target.ry, target.rz]}
    >
      <mesh>
        <boxGeometry args={[1.9, 1.0, 0.08]} />
        <meshStandardMaterial color="#f2eee2" roughness={0.85} />
      </mesh>
      <mesh position={[-0.68, 0, 0.045]}>
        <boxGeometry args={[0.4, 0.85, 0.012]} />
        <meshStandardMaterial color="#0d9488" roughness={0.7} />
      </mesh>
      {/* Stacked cards converge — only the top card keeps its tag. */}
      {progress < 0.5 || index === 2 ? (
        <Label position={[0, 0.72, 0]} text={`CHEQUE ${index + 1} · UTXO`} tone="ink" height={0.28} />
      ) : null}
    </group>
  );
}

export function ChequesStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const typed = useJourneySignal("cheques-progress", 0);
  const progress = win ? 1 : typed;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[6.2, 0.25, 3.0]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>

      {[0, 1, 2].map((i) => (
        <StackCard key={i} index={i} progress={progress} />
      ))}

      {win ? <Label position={[0, 3.4, 0]} text="STACKED" tone="go" height={0.44} /> : null}
      {win ? (
        <Sparkles count={24} scale={[3.4, 2.6, 3]} position={[0, 2.0, 0]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={2.8} opacity={0.25} />
      {active ? <SpotCone position={[0, 2.8, 0]} /> : null}
    </group>
  );
}
