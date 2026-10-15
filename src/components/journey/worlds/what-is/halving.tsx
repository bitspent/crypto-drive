"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

const ERAS = [
  { value: "50", h: 2.6, dx: -2.45 },
  { value: "25", h: 1.9, dx: -1.05 },
  { value: "12.5", h: 1.4, dx: 0.35 },
  { value: "6.25", h: 1.05, dx: 1.75 },
];

function RewardBar({ h, dimmed, current, index }: { h: number; dimmed: boolean; current: boolean; index: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const node = ref.current;
    if (!node || reduced) return;
    const step = Math.min(delta, 0.05);
    const target = current ? 1.08 : 1;
    const s = THREE.MathUtils.damp(node.scale.x, target, 4, step);
    const pulse = current ? 0 : Math.sin(state.clock.elapsedTime * 1.6 + index * 0.7) * 0.015;
    node.scale.set(s, s + pulse, s);
  });
  return (
    <group ref={ref} scale={current ? 1.08 : 1}>
      <mesh position={[0, h / 2 + 0.15, 0]}>
        <boxGeometry args={[0.95, h, 0.95]} />
        <meshStandardMaterial color={dimmed ? "#6b5a3e" : "#f7931a"} roughness={0.55} />
      </mesh>
      <mesh position={[0, h + 0.18, 0]}>
        <boxGeometry args={[1.0, 0.08, 1.0]} />
        <meshStandardMaterial color={dimmed ? "#57503f" : "#ffd9a0"} roughness={0.5} />
      </mesh>
      {current ? (
        <mesh position={[0, h + 0.5, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.8, 0.06, 10, 32]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function HalvingStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[-0.35, 0.07, 0]}>
        <boxGeometry args={[6.8, 0.15, 3.0]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>

      {ERAS.map((era, i) => {
        const current = win && i === ERAS.length - 1;
        return (
          <group key={era.value} position={[era.dx, 0, 0]}>
            <RewardBar h={era.h} dimmed={win && !current} current={current} index={i} />
            <Label position={[0, era.h / 2 + 0.15, 0.7]} text={era.value} tone="amber" height={0.34} />
            {i > 0 ? (
              <Label position={[-0.7, 3.1, 0.4]} text="÷2" tone="ink" height={0.34} />
            ) : null}
            {current ? <Label position={[0, era.h + 1.0, 0]} text="NOW" tone="go" height={0.38} /> : null}
          </group>
        );
      })}

      {win ? (
        <Sparkles count={22} scale={[2.4, 2.4, 2.4]} position={[1.75, 1.3, 0]} size={4} speed={0.6} color="#ffd75e" />
      ) : null}
      <BlobShadow position={[-0.35, 0.16, 0]} radius={2.7} />
      {active ? <SpotCone position={[-0.35, 3.2, 0]} /> : null}
    </group>
  );
}
