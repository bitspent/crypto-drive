"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone, Traveler } from "../rig";
import { Label, Sparkles, WorldShell } from "../rig-drei";
import { DriveArch, VitrineShell } from "../rig-glass";
import { useJourneySignal } from "../journey-bus";
import { useReducedMotion } from "../use-reduced-motion";

function KeyStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const gotAddress = useJourneySignal("key-address", false);
  const gotKey = useJourneySignal("key-key", false);
  const reduced = useReducedMotion();
  const mail = useRef<THREE.Group>(null);
  const key = useRef<THREE.Group>(null);
  const showMail = win || gotAddress;
  const melt = win || gotKey;

  useFrame((_, delta) => {
    if (reduced) return;
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    if (mail.current) {
      mail.current.position.y = damp(mail.current.position.y, showMail ? 1.9 : 1.1, 3.5, step);
    }
    if (key.current) {
      key.current.scale.y = damp(key.current.scale.y, melt ? 0.4 : 1, 3.5, step);
      key.current.position.y = damp(key.current.position.y, melt ? 1.2 : 1.7, 3.5, step);
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[7.4, 0.25, 3.2]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      {/* Mailbox */}
      <group position={[-1.7, 0, 0]}>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[1.5, 1.5, 1.1]} />
          <meshStandardMaterial
            color="#123b38"
            roughness={0.7}
            emissive={showMail ? "#0d9488" : "#000000"}
            emissiveIntensity={showMail ? 0.5 : 0}
          />
        </mesh>
        <group ref={mail} position={[0, showMail && reduced ? 1.9 : 1.1, 0.2]}>
          <mesh>
            <boxGeometry args={[0.9, 0.6, 0.5]} />
            <meshStandardMaterial color="#f4f1e8" roughness={0.85} />
          </mesh>
        </group>
        <Label position={[0, 2.5, 0]} text="ADDRESS" tone="ink" height={0.32} />
        {showMail ? <Label position={[0, 2.0, 0.7]} text="SAFE TO SHARE" tone="go" height={0.3} /> : null}
        <BlobShadow position={[0, 0.26, 0]} radius={1.3} />
      </group>
      {/* Key vault */}
      <group position={[1.1, 0, 0]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[1.6, 0.6, 1.2]} />
          <meshStandardMaterial color="#2f3640" roughness={0.8} />
        </mesh>
        <group ref={key} position={[0, melt && reduced ? 1.2 : 1.7, 0]} scale={[1, melt ? 0.4 : 1, 1]}>
          <mesh position={[0, 0.45, 0]}>
            <torusGeometry args={[0.28, 0.09, 10, 22]} />
            <meshStandardMaterial
              color={melt ? "#c2410c" : "#f7931a"}
              emissive={melt ? "#c2410c" : "#000000"}
              emissiveIntensity={melt ? 0.7 : 0}
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <boxGeometry args={[0.16, 0.9, 0.12]} />
            <meshStandardMaterial color={melt ? "#c2410c" : "#f7931a"} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0.2, -0.45, 0]}>
            <boxGeometry args={[0.32, 0.12, 0.12]} />
            <meshStandardMaterial color={melt ? "#c2410c" : "#f7931a"} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
        <Label position={[0, 2.9, 0]} text="KEY" tone="ink" height={0.32} />
        {melt ? <Label position={[0, 2.35, 0.6]} text="WALLET DRAINED" tone="danger" height={0.3} /> : null}
        <BlobShadow position={[0, 0.26, 0]} radius={1.3} />
      </group>
      {win ? (
        <Sparkles count={20} scale={[6, 2.6, 2.6]} position={[-0.3, 1.8, 0]} size={3} speed={0.5} color="#ffd75e" />
      ) : null}
      {active ? <SpotCone position={[-0.3, 3.6, 0]} /> : null}
    </group>
  );
}

function SeedStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const picked = useJourneySignal("seed-picked", 0);
  const phase = useJourneySignal<string>("seed-phase", "write");
  const filled = win ? 12 : picked;
  const phaseLabel =
    win || phase === "ready" ? null : phase === "photo" ? "NO PHOTO" : phase === "chat" ? "REFUSE" : phase === "recall" ? "RECALL" : null;

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[5.8, 0.25, 3.0]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>
      <group position={[0, 1.9, -0.4]} rotation-x={-0.12}>
        <mesh>
          <boxGeometry args={[3.2, 2.7, 0.2]} />
          <meshStandardMaterial color="#2f3640" roughness={0.8} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const on = i < filled;
          return (
            <mesh key={i} position={[-1.02 + col * 1.02, 0.92 - row * 0.62, 0.14]} scale={on ? 1 : 0.8}>
              <boxGeometry args={[0.85, 0.44, 0.1]} />
              <meshStandardMaterial
                color={on ? "#f4f1e8" : "#1c2230"}
                emissive={on && win ? "#0d9488" : "#000000"}
                emissiveIntensity={on && win ? 0.35 : 0}
                roughness={0.8}
              />
            </mesh>
          );
        })}
      </group>
      <Label position={[-1.5, 1.18, 0.4]} text="12 WORDS" tone="amber" height={0.26} />
      {phaseLabel ? (
        <Label position={[1.45, 1.18, 0.4]} text={phaseLabel} tone={phase === "recall" ? "amber" : "danger"} height={0.26} />
      ) : null}
      {win ? <Label position={[1.45, 1.18, 0.4]} text="SEALED" tone="go" height={0.3} /> : null}
      {win ? (
        <Sparkles count={24} scale={[4, 2.8, 2.4]} position={[0, 1.9, 0]} size={4} speed={0.6} color="#5eead4" />
      ) : null}
      <BlobShadow position={[0, 0.26, 0]} radius={2.8} opacity={0.25} />
      {active ? <SpotCone position={[0, 3.4, 0]} /> : null}
    </group>
  );
}

export function BitcoinGuardWorld({ step }: { step: string }) {
  const currentX = step === "words" ? 14 : 0;
  return (
    <WorldShell center={7} roadLength={48}>
      <KeyStop x={0} active={step === "key"} />
      <SeedStop x={14} active={step === "words"} />
      <Traveler x={currentX} />
      <VitrineShell key={step} x={currentX} />
      <DriveArch x={23} label="NEXT DRIVE" />
    </WorldShell>
  );
}
