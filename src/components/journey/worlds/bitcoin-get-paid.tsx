"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone, Traveler } from "../rig";
import { Label, Sparkles, WorldShell } from "../rig-drei";
import { DriveArch, VitrineShell } from "../rig-glass";
import { useJourneySignal } from "../journey-bus";
import { useReducedMotion } from "../use-reduced-motion";

function AddressStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const copied = useJourneySignal("address-copied", false);
  const ends = useJourneySignal("address-ends", 0);
  const reduced = useReducedMotion();
  const plate = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!plate.current || reduced) return;
    plate.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.06;
    plate.current.scale.setScalar(
      THREE.MathUtils.damp(plate.current.scale.x, win ? 1.06 : 1, 4, Math.min(delta, 0.05)),
    );
  });

  const lit = (n: number) => win || ends >= n;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[6.4, 0.25, 3.2]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <group position={[-0.7, 0, 0]}>
      <group ref={plate} position={[0, 2.1, 0]} scale={win ? 1.06 : 1}>
        <mesh>
          <boxGeometry args={[3.6, 1.15, 0.14]} />
          <meshStandardMaterial
            color="#dfe5ee"
            metalness={0.3}
            roughness={0.5}
            emissive={copied || win ? "#f7931a" : "#000000"}
            emissiveIntensity={copied || win ? 0.25 : 0}
          />
        </mesh>
        <mesh position={[-1.32, 0, 0.1]}>
          <boxGeometry args={[0.95, 0.72, 0.1]} />
          <meshStandardMaterial
            color={lit(1) ? "#f7931a" : "#59606e"}
            emissive={lit(1) ? "#f7931a" : "#000000"}
            emissiveIntensity={lit(1) ? 0.8 : 0}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[1.32, 0, 0.1]}>
          <boxGeometry args={[0.95, 0.72, 0.1]} />
          <meshStandardMaterial
            color={lit(2) ? "#f7931a" : "#59606e"}
            emissive={lit(2) ? "#f7931a" : "#000000"}
            emissiveIntensity={lit(2) ? 0.8 : 0}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[0.8, 0.12, 0.06]} />
          <meshBasicMaterial color="#3c4250" toneMapped={false} />
        </mesh>
      </group>
      <Label position={[-1.35, 3.0, 0]} text="FIRST 4" tone="ink" height={0.3} />
      <Label position={[1.35, 3.0, 0]} text="LAST 4" tone="ink" height={0.3} />
      {copied && !win ? <Label position={[0, 3.55, 0]} text="COPIED" tone="amber" height={0.36} /> : null}
      {win ? <Label position={[0, 3.55, 0]} text="LOCKED" tone="go" height={0.44} /> : null}
      {win ? (
        <Sparkles count={22} scale={[4, 2.6, 2.6]} position={[0, 2.1, 0]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={2.6} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
      </group>
    </group>
  );
}

function ReceiptStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const found = useJourneySignal("receipt-found", false);
  const confirms = useJourneySignal("receipt-confirms", 0);
  const reduced = useReducedMotion();
  const slip = useRef<THREE.Group>(null);
  const out = win || found;
  const done = win || confirms >= 3;

  useFrame((_, delta) => {
    if (!slip.current || reduced) return;
    slip.current.position.z = THREE.MathUtils.damp(
      slip.current.position.z,
      out ? 1.5 : -0.7,
      3.5,
      Math.min(delta, 0.05),
    );
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[6.4, 0.25, 3.6]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <mesh position={[0, 0.85, -0.7]}>
        <boxGeometry args={[3.2, 1.2, 1.9]} />
        <meshStandardMaterial color="#2f3640" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.48, -0.1]}>
        <boxGeometry args={[2.4, 0.1, 0.5]} />
        <meshBasicMaterial color="#0b0e14" toneMapped={false} />
      </mesh>
      <group ref={slip} position={[0, 1.5, out && reduced ? 1.5 : -0.7]}>
        <mesh>
          <boxGeometry args={[2.0, 0.06, 2.4]} />
          <meshStandardMaterial color="#f4f1e8" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.05, -0.6]}>
          <boxGeometry args={[1.2, 0.03, 0.3]} />
          <meshBasicMaterial color="#3c3830" toneMapped={false} />
        </mesh>
        {[-0.6, 0, 0.6].map((sx, i) => {
          const on = done || confirms > i;
          return (
            <mesh key={sx} position={[sx, 0.08, 0.55]} scale={on ? 1 : 0.55}>
              <cylinderGeometry args={[0.22, 0.22, 0.1, 18]} />
              <meshStandardMaterial
                color={on ? "#0d9488" : "#59606e"}
                emissive={on ? "#0d9488" : "#000000"}
                emissiveIntensity={on ? 0.6 : 0}
                roughness={0.5}
              />
            </mesh>
          );
        })}
      </group>
      <Label position={[0, 3.1, -0.7]} text="RECEIPT" tone="ink" height={0.36} />
      {found && !done ? (
        <Label position={[0, 3.0, 0.9]} text={`${confirms}/3`} tone="amber" height={0.4} />
      ) : null}
      {done ? <Label position={[0, 3.0, 0.9]} text="SAFE" tone="go" height={0.44} /> : null}
      {done ? (
        <Sparkles count={22} scale={[3.4, 2.4, 3]} position={[0, 1.8, 0.6]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={2.8} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
    </group>
  );
}

export function BitcoinGetPaidWorld({ step }: { step: string }) {
  const currentX = step === "receipt" ? 14 : 0;
  return (
    <WorldShell center={7} roadLength={48}>
      <AddressStop x={0} active={step === "address"} />
      <ReceiptStop x={14} active={step === "receipt"} />
      <Traveler x={currentX} />
      <VitrineShell key={step} x={currentX} />
      <DriveArch x={23} label="NEXT DRIVE" />
    </WorldShell>
  );
}
