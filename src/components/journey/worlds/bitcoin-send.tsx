"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone, Traveler } from "../rig";
import { Label, Sparkles, WorldShell } from "../rig-drei";
import { DriveArch, VitrineShell } from "../rig-glass";
import { useJourneySignal } from "../journey-bus";
import { useReducedMotion } from "../use-reduced-motion";

function SwapStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const pasted = useJourneySignal("swap-pasted", false);
  const reduced = useReducedMotion();
  const bad = useRef<THREE.Group>(null);
  const badMat = useRef<THREE.MeshStandardMaterial>(null);
  const sheared = (pasted || win) && !win;

  useFrame((state, delta) => {
    if (reduced) return;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    if (bad.current) {
      bad.current.rotation.z = damp(bad.current.rotation.z, sheared ? 0.35 : 0, 4, step);
      bad.current.position.x = damp(bad.current.position.x, sheared ? 1.6 : 0.9, 4, step);
      if (sheared) bad.current.position.y = 2.1 + Math.sin(state.clock.elapsedTime * 9) * 0.03;
    }
    if (badMat.current) {
      badMat.current.opacity = damp(badMat.current.opacity, win ? 0.25 : 1, 4, step);
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[7.4, 0.25, 3.2]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <group position={[-2.0, 2.1, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 1.2, 0.14]} />
          <meshStandardMaterial color="#123b38" roughness={0.7} emissive="#0d9488" emissiveIntensity={0.35} />
        </mesh>
        <Label position={[0, 0.95, 0]} text="TRUE END" tone="go" height={0.32} />
      </group>
      <group
        ref={bad}
        position={[sheared && reduced ? 1.6 : 0.9, 2.1, 0]}
        rotation={[0, 0, sheared && reduced ? 0.35 : 0]}
      >
        <mesh>
          <boxGeometry args={[2.2, 1.2, 0.14]} />
          <meshStandardMaterial
            ref={badMat}
            color="#4a1f10"
            roughness={0.7}
            emissive="#c2410c"
            emissiveIntensity={sheared || win ? 0.7 : 0.25}
            transparent
            opacity={win ? 0.25 : 1}
          />
        </mesh>
        <Label position={[0, 0.95, 0]} text="PASTE" tone="danger" height={0.32} />
      </group>
      {win ? <Label position={[-0.5, 1.15, 0.8]} text="REJECTED" tone="go" height={0.44} /> : null}
      {win ? (
        <Sparkles count={22} scale={[4, 2.6, 2.6]} position={[-2.0, 2.1, 0]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={3.2} opacity={0.25} />
      {active ? <SpotCone position={[-0.5, 3.4, 0]} /> : null}
    </group>
  );
}

function TollStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const pace = useJourneySignal<string>("fee-pace", "none");
  const reduced = useReducedMotion();
  const gate = useRef<THREE.Group>(null);
  const car = useRef<THREE.Group>(null);
  const siren = useRef<THREE.MeshBasicMaterial>(null);
  const slow = win || pace === "slow";
  const fast = pace === "fast" && !win;

  useFrame((state, delta) => {
    if (reduced) return;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    if (gate.current) {
      gate.current.rotation.z = damp(gate.current.rotation.z, slow ? -1.0 : 0, 3.5, step);
    }
    if (car.current) {
      car.current.position.x = slow
        ? Math.sin(state.clock.elapsedTime * 0.8) * 2.2
        : damp(car.current.position.x, -2.6, 3, step);
    }
    if (siren.current) {
      siren.current.opacity = fast ? 0.45 + Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.55 : 0.12;
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]} rotation-x={-0.06}>
        <boxGeometry args={[9.5, 0.25, 4.6]} />
        <meshStandardMaterial color="#232839" roughness={1} />
      </mesh>
      {/* Fast lane */}
      <mesh position={[0, 0.3, -1.2]}>
        <boxGeometry args={[9.0, 0.06, 1.7]} />
        <meshBasicMaterial ref={siren} color="#c2410c" transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <Label position={[-2.85, 1.0, -1.2]} text="FAST" tone={fast ? "danger" : "ink"} height={0.32} />
      {/* Slow lane + car + gate */}
      <mesh position={[0, 0.3, 1.2]}>
        <boxGeometry args={[9.0, 0.06, 1.7]} />
        <meshStandardMaterial color={slow ? "#0d9488" : "#3a4358"} emissive={slow ? "#0d9488" : "#000000"} emissiveIntensity={slow ? 0.4 : 0} roughness={0.7} />
      </mesh>
      <Label position={[-1.8, 1.0, 2.0]} text="SLOW" tone="ink" height={0.32} />
      <group ref={car} position={[slow && reduced ? 1.5 : -2.6, 0.55, 1.2]}>
        <mesh>
          <boxGeometry args={[1.5, 0.4, 0.9]} />
          <meshStandardMaterial color="#f7931a" roughness={0.6} />
        </mesh>
        <mesh position={[-0.1, 0.35, 0]}>
          <boxGeometry args={[0.8, 0.32, 0.8]} />
          <meshStandardMaterial color="#2f3640" roughness={0.6} />
        </mesh>
      </group>
      <group position={[2.0, 0.35, 1.2]}>
        <mesh position={[0, 0.5, 0.8]}>
          <boxGeometry args={[0.18, 1.0, 0.18]} />
          <meshStandardMaterial color="#59606e" roughness={0.7} />
        </mesh>
        <group ref={gate} position={[0, 0.95, 0.8]} rotation={[0, 0, slow && reduced ? -1.0 : 0]}>
          <mesh position={[-0.9, 0, -0.8]}>
            <boxGeometry args={[1.8, 0.14, 0.14]} />
            <meshStandardMaterial color="#0d9488" emissive="#0d9488" emissiveIntensity={slow ? 0.8 : 0.2} roughness={0.5} />
          </mesh>
        </group>
        <mesh position={[0, 1.15, 0.8]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshBasicMaterial color={slow ? "#5eead4" : "#59606e"} toneMapped={false} />
        </mesh>
      </group>
      {[-2.2, 2.2].map((px) => (
        <mesh key={px} position={[px, 1.9, 0]}>
          <boxGeometry args={[0.22, 3.4, 0.22]} />
          <meshStandardMaterial color="#59606e" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 3.6, 0]}>
        <boxGeometry args={[4.8, 0.3, 0.3]} />
        <meshStandardMaterial color="#2f3640" roughness={0.7} />
      </mesh>
      <Label position={[0, 3.0, 0.2]} text="TOLL" tone="amber" height={0.4} />
      {win ? <Label position={[0, 2.4, 0.9]} text="TOLL PAID" tone="go" height={0.44} /> : null}
      {win ? (
        <Sparkles count={22} scale={[5, 2.4, 3]} position={[0, 1.4, 1.2]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={3.6} opacity={0.22} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
    </group>
  );
}

function NoUndoStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const sent = useJourneySignal("send-sent", false);
  const confirms = useJourneySignal("send-confirms", 0);
  const reduced = useReducedMotion();
  const coin = useRef<THREE.Group>(null);
  const gone = win || sent;
  const landed = win || confirms >= 3;

  useFrame((_, delta) => {
    if (!coin.current || reduced) return;
    const step = Math.min(delta, 0.05);
    coin.current.position.y = THREE.MathUtils.damp(coin.current.position.y, gone ? 0.5 : 2.7, 2.2, step);
    if (gone) coin.current.rotation.y += delta * 7;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[-1.6, 1.5, 0]} rotation-z={-0.14}>
        <boxGeometry args={[3.4, 0.18, 1.2]} />
        <meshStandardMaterial color="#4a6076" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.5, 2.0, 0.5]} />
        <meshStandardMaterial color="#2f3640" roughness={0.9} />
      </mesh>
      <mesh position={[1.8, 0.35, 0]}>
        <boxGeometry args={[5.2, 0.3, 4.2]} />
        <meshStandardMaterial color="#2e6f8e" transparent opacity={0.75} roughness={0.4} />
      </mesh>
      <group ref={coin} position={[0.4, gone && reduced ? 0.5 : 2.7, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.42, 0.42, 0.12, 24]} />
          <meshStandardMaterial color="#f7931a" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      <group position={[-1.6, 2.6, 0]} rotation={[0, 0, gone ? -0.12 : 0]}>
        <mesh>
          <boxGeometry args={[1.7, 0.5, 0.24]} />
          <meshStandardMaterial color={gone ? "#4a1f10" : "#2f3640"} roughness={0.8} />
        </mesh>
        <Label position={[0, 0.55, 0]} text={gone ? "NO UNDO" : "UNDO"} tone={gone ? "danger" : "ink"} height={0.32} />
      </group>
      {landed ? <Label position={[0.9, 2.5, 0.6]} text="LANDED" tone="go" height={0.44} /> : null}
      {landed ? (
        <Sparkles count={22} scale={[3.4, 2.4, 3]} position={[0.9, 1.2, 0.6]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.03, 0]} radius={2.8} />
      {active ? <SpotCone position={[0.4, 3.4, 0]} /> : null}
    </group>
  );
}

export function BitcoinSendWorld({ step }: { step: string }) {
  const currentX = step === "toll" ? 14 : step === "no-undo" ? 28 : 0;
  return (
    <WorldShell center={14} roadLength={62}>
      <SwapStop x={0} active={step === "swapped"} />
      <TollStop x={14} active={step === "toll"} />
      <NoUndoStop x={28} active={step === "no-undo"} />
      <Traveler x={currentX} />
      <VitrineShell key={step} x={currentX} />
      <DriveArch x={37} label="NEXT DRIVE" />
    </WorldShell>
  );
}
