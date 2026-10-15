"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Label } from "./rig-drei";
import { useJourneySignal } from "./journey-bus";
import { useReducedMotion } from "./use-reduced-motion";
import { useThemePalette } from "./use-theme-mode";

/**
 * Liquid-glass kit. Two tiers: cheap fake glass (transparent standard
 * material, no depth write) everywhere, and at most ONE true-transmission
 * hero surface per stop. Worlds-only module (loads behind next/dynamic).
 */

/** Frosted plinth block with a dark base shoe. */
export function GlassPlinth({
  position,
  size = [6.4, 0.3, 3.2],
}: {
  position: [number, number, number];
  size?: [number, number, number];
}) {
  const palette = useThemePalette();
  return (
    <group position={position}>
      <mesh position={[0, size[1] / 2 + 0.1, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={palette.glassTint}
          transparent
          opacity={0.16}
          roughness={0.1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[size[0] + 0.15, 0.1, size[2] + 0.15]} />
        <meshStandardMaterial color="#2f3640" roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * Shared vitrine glass. Only one vitrine mounts at a time, so sharing is
 * safe — and module scope keeps the render loop clear of hook-mutation rules.
 */
const VITRINE_GLASS = {
  side: new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    roughness: 0.08,
    metalness: 0,
    depthWrite: false,
  }),
  front: new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    roughness: 0.08,
    metalness: 0,
    depthWrite: false,
  }),
};

/**
 * Glass vitrine around the active stop. Mounts on arrival (key by step)
 * with a rim glow; on win the roof cap glows amber and the front glass
 * dissolves. Inactive stops render no case at all — the vignette stands
 * alone in the fog.
 */
export function VitrineShell({
  x,
  w = 6.6,
  h = 3.8,
  d = 4.0,
}: {
  x: number;
  w?: number;
  h?: number;
  d?: number;
}) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const palette = useThemePalette();
  const group = useRef<THREE.Group>(null);
  const lastTint = useRef("");
  const baseY = 0.18;

  useEffect(() => {
    VITRINE_GLASS.side.opacity = 0;
    VITRINE_GLASS.front.opacity = 0;
  }, []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    if (lastTint.current !== palette.glassTint) {
      VITRINE_GLASS.side.color.set(palette.glassTint);
      VITRINE_GLASS.front.color.set(palette.glassTint);
      lastTint.current = palette.glassTint;
    }
    if (reduced) {
      VITRINE_GLASS.side.opacity = win ? 0.1 : 0.15;
      VITRINE_GLASS.front.opacity = win ? 0.02 : 0.15;
      node.scale.setScalar(1);
      return;
    }
    const step = Math.min(delta, 0.05);
    const damp = THREE.MathUtils.damp;
    VITRINE_GLASS.side.opacity = damp(VITRINE_GLASS.side.opacity, win ? 0.1 : 0.15, 3.5, step);
    VITRINE_GLASS.front.opacity = damp(VITRINE_GLASS.front.opacity, win ? 0.02 : 0.15, 3.5, step);
    node.scale.setScalar(damp(node.scale.x, 1, 3.5, step));
  });

  return (
    <group position={[x, 0, 0]}>
      <group ref={group} scale={0.94}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[w + 0.2, 0.18, d + 0.2]} />
          <meshStandardMaterial color="#1c2230" roughness={0.6} />
        </mesh>
        <mesh position={[0, baseY + h / 2, d / 2]} material={VITRINE_GLASS.front}>
          <boxGeometry args={[w, h, 0.05]} />
        </mesh>
        <mesh position={[0, baseY + h / 2, -d / 2]} material={VITRINE_GLASS.side}>
          <boxGeometry args={[w, h, 0.05]} />
        </mesh>
        {[-w / 2, w / 2].map((px) => (
          <mesh key={px} position={[px, baseY + h / 2, 0]} material={VITRINE_GLASS.side}>
            <boxGeometry args={[0.05, h, d]} />
          </mesh>
        ))}
        {/* Roof cap. Fixed in place — the win state reads as an amber
            glow plus dissolving front glass, never as moving geometry. */}
        <mesh position={[0, baseY + h, 0]}>
          <boxGeometry args={[w + 0.2, 0.14, d + 0.2]} />
          <meshStandardMaterial
            color={win ? "#f7931a" : "#2f3640"}
            emissive={win ? "#f7931a" : "#000000"}
            emissiveIntensity={win ? 0.7 : 0}
            roughness={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Glass arch marking the road to the next drive. */
export function DriveArch({ x, label }: { x: number; label: string }) {
  const palette = useThemePalette();
  return (
    <group position={[x, 0, 0]}>
      {[-2.4, 2.4].map((px) => (
        <group key={px} position={[px, 0, 0]}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <meshStandardMaterial color="#1c2230" roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <boxGeometry args={[0.5, 3.4, 0.5]} />
            <meshStandardMaterial
              color={palette.glassTint}
              transparent
              opacity={0.22}
              roughness={0.08}
              metalness={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 3.9, 0]}>
        <boxGeometry args={[5.4, 0.4, 0.5]} />
        <meshStandardMaterial
          color={palette.glassTint}
          transparent
          opacity={0.22}
          roughness={0.08}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <Label position={[0, 4.55, 0]} text={label} tone="ink" height={0.36} />
    </group>
  );
}
