"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone, Traveler } from "../rig";
import { Label, Sparkles, WorldShell } from "../rig-drei";
import { DriveArch, VitrineShell } from "../rig-glass";
import { useJourneySignal } from "../journey-bus";
import { useReducedMotion } from "../use-reduced-motion";

function SupportStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const bubble = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!bubble.current || reduced) return;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    bubble.current.position.y = damp(bubble.current.position.y, win ? 0.7 : 2.3, 3.5, step);
    const s = damp(bubble.current.scale.y, win ? 0.18 : 1, 3.5, step);
    bubble.current.scale.set(1, s, 1);
    if (!win) bubble.current.position.x = Math.sin(state.clock.elapsedTime * 1.2) * 0.08;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[5.8, 0.25, 3.0]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.8, 0.5, 1.5]} />
        <meshStandardMaterial color="#151a26" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[2.3, 0.08, 0.3]} />
        <meshBasicMaterial color={win ? "#0d9488" : "#59606e"} toneMapped={false} />
      </mesh>
      <group ref={bubble} position={[0, win && reduced ? 0.7 : 2.1, 0]} scale={[1, win ? 0.18 : 1, 1]}>
        <mesh>
          <boxGeometry args={[2.3, 1.2, 0.5]} />
          <meshStandardMaterial color="#4a1f10" roughness={0.8} emissive="#c2410c" emissiveIntensity={win ? 0 : 0.3} />
        </mesh>
        {!win ? <Label position={[0, 0.92, 0]} text="12 WORDS?" tone="danger" height={0.34} /> : null}
      </group>
      {win ? <Label position={[0, 2.6, 0]} text="SHREDDED" tone="go" height={0.44} /> : null}
      {win ? (
        <Sparkles count={20} scale={[3.4, 2, 2.4]} position={[0, 1.2, 0]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={2.6} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
    </group>
  );
}

function NetworkStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const bitcoin = useJourneySignal("network-bitcoin", false);
  const reduced = useReducedMotion();
  const eth = useRef<THREE.Group>(null);
  const btc = useRef<THREE.Group>(null);
  const open = win || bitcoin;

  useFrame((state, delta) => {
    if (reduced) return;
    if (eth.current && !open) {
      eth.current.rotation.y = Math.sin(state.clock.elapsedTime * 14) * 0.06;
    }
    if (btc.current) {
      btc.current.rotation.y = THREE.MathUtils.damp(btc.current.rotation.y, open ? -1.0 : 0, 3.5, Math.min(delta, 0.05));
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[7.4, 0.25, 3.2]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <group ref={eth} position={[-1.5, 1.7, 0]}>
        <mesh>
          <boxGeometry args={[1.7, 2.9, 0.2]} />
          <meshStandardMaterial color="#232838" roughness={0.8} transparent opacity={open ? 0.35 : 1} />
        </mesh>
        <Label position={[0, 0.6, 0.3]} text="0x" tone="danger" height={0.4} />
      </group>
      <group ref={btc} position={[0.9, 1.7, 0]} rotation={[0, open && reduced ? -1.0 : 0, 0]}>
        <mesh>
          <boxGeometry args={[1.7, 2.9, 0.2]} />
          <meshStandardMaterial
            color="#f7931a"
            roughness={0.6}
            emissive={open ? "#f7931a" : "#000000"}
            emissiveIntensity={open ? 0.55 : 0}
          />
        </mesh>
        <Label position={[0, 0.6, 0.3]} text="BTC" tone={open ? "amber" : "ink"} height={0.4} />
      </group>
      {open ? <Label position={[-0.1, 2.75, 0.5]} text="BITCOIN" tone="go" height={0.4} /> : null}
      {win ? (
        <Sparkles count={22} scale={[2.6, 3, 2.4]} position={[0.9, 1.8, 0]} size={4} speed={0.6} color="#ffd75e" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={3.2} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.6, 0]} /> : null}
    </group>
  );
}

function MismatchStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const door = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!door.current || reduced) return;
    door.current.rotation.x = THREE.MathUtils.damp(
      door.current.rotation.x,
      win ? 0 : -1.25,
      5,
      Math.min(delta, 0.05),
    );
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[7.4, 0.25, 3.4]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[3.4, 1.3, 2.2]} />
        <meshStandardMaterial color="#2f3640" roughness={0.85} />
      </mesh>
      <group position={[0, 2.35, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 0.5, 0.5]} />
          <meshStandardMaterial color="#4a1f10" roughness={0.7} emissive="#c2410c" emissiveIntensity={win ? 0.1 : 0.6} />
        </mesh>
        <Label position={[0, 0.55, 0]} text="SEND" tone="danger" height={0.34} />
      </group>
      <group ref={door} position={[0, 1.6, -1.1]} rotation={[win && reduced ? 0 : -1.25, 0, 0]}>
        <mesh position={[0, 0, 1.0]}>
          <boxGeometry args={[3.0, 0.14, 2.0]} />
          <meshStandardMaterial color={win ? "#0d9488" : "#59606e"} roughness={0.7} />
        </mesh>
      </group>
      <Label position={[-2.2, 1.9, 0.6]} text="MEANT" tone="ink" height={0.3} />
      <Label position={[0.6, 1.9, 0.6]} text="SHOWN" tone="danger" height={0.3} />
      {win ? <Label position={[0, 1.9, 1.4]} text="STOPPED" tone="go" height={0.44} /> : null}
      {win ? (
        <Sparkles count={22} scale={[3.4, 2.4, 3]} position={[0, 1.8, 0]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={3.2} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
    </group>
  );
}

export function BitcoinRoadTestWorld({ step }: { step: string }) {
  return (
    <WorldShell center={14} roadLength={62}>
      <SupportStop x={0} active={step === "support"} />
      <NetworkStop x={14} active={step === "network"} />
      <MismatchStop x={28} active={step === "mismatch"} />
      <Traveler x={step === "network" ? 14 : step === "mismatch" ? 28 : 0} />
      <VitrineShell key={step} x={step === "network" ? 14 : step === "mismatch" ? 28 : 0} />
      <DriveArch x={37} label="FINISH" />
    </WorldShell>
  );
}
