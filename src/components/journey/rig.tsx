"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Anchor, Vec3 } from "./registry";
import { useReducedMotion } from "./use-reduced-motion";
import { useThemePalette } from "./use-theme-mode";

export const SKY = "#141a2e";
export const GROUND = "#20263a";
export const ROAD = "#2b3049";
export const AMBER = "#f7931a";
export const AMBER_SOFT = "#f5c46b";

/** Shared light rig, themed live. No shadow maps — blob shadows instead. */
export function JourneyLights() {
  const p = useThemePalette();
  return (
    <>
      <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
      <directionalLight position={[6, 10, 6]} intensity={p.sunIntensity} color={p.sunColor} />
      <pointLight position={[-8, 5, -6]} intensity={p.rimIntensity} distance={40} color={p.rimColor} />
    </>
  );
}

/**
 * Glides the camera between stop anchors. On wide screens the look-target
 * shifts so the HUD panel never covers the vignette. Reduced motion snaps.
 */
export function CameraDirector({ anchor }: { anchor: Anchor }) {
  const reduced = useReducedMotion();
  // Persistent flight state — survives step changes so flights glide.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pos = useMemo(() => new THREE.Vector3(...anchor.pos), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const look = useMemo(() => new THREE.Vector3(...anchor.look), []);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);
    const wide = state.size.width >= 1024;
    const lookX = anchor.look[0] + (wide ? 1.4 : 0);
    if (reduced) {
      pos.set(anchor.pos[0], anchor.pos[1], anchor.pos[2]);
      look.set(lookX, anchor.look[1], anchor.look[2]);
      state.camera.position.copy(pos);
    } else {
      const damp = THREE.MathUtils.damp;
      pos.set(
        damp(pos.x, anchor.pos[0], 2.4, step),
        damp(pos.y, anchor.pos[1], 2.4, step),
        damp(pos.z, anchor.pos[2], 2.4, step),
      );
      look.set(
        damp(look.x, lookX, 2.4, step),
        damp(look.y, anchor.look[1], 2.4, step),
        damp(look.z, anchor.look[2], 2.4, step),
      );
      const sway = Math.sin(state.clock.elapsedTime * 0.55) * 0.12;
      state.camera.position.set(pos.x, pos.y + sway, pos.z);
    }
    state.camera.lookAt(look);
  });
  return null;
}

/** Cheap painted shadow disc. */
export function BlobShadow({
  position,
  radius = 1.5,
  opacity = 0.35,
}: {
  position: Vec3;
  radius?: number;
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[radius, 28]} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** Focus spotlight cone over the active vignette. */
export function SpotCone({ position }: { position: Vec3 }) {
  return (
    <mesh position={position} rotation-x={Math.PI}>
      <coneGeometry args={[2.4, 6.5, 24, 1, true]} />
      <meshBasicMaterial
        color={AMBER_SOFT}
        transparent
        opacity={0.09}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Glass-orb traveler gliding along the road to the current stop. */
export function Traveler({ x }: { x: number }) {
  const reduced = useReducedMotion();
  const palette = useThemePalette();
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    if (reduced) {
      ref.current.position.x = x;
      ref.current.position.y = 0.4;
      return;
    }
    ref.current.position.x = THREE.MathUtils.damp(
      ref.current.position.x,
      x,
      2.0,
      Math.min(delta, 0.05),
    );
    ref.current.position.y = 0.4 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
  });
  return (
    <group ref={ref} position={[x, 0.4, 0.9]}>
      <mesh>
        <sphereGeometry args={[0.2, 14, 12]} />
        <meshBasicMaterial color="#ffd75e" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 18, 14]} />
        <meshPhysicalMaterial
          color={palette.glassTint}
          transmission={1}
          thickness={0.4}
          roughness={0.12}
          ior={1.5}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, -0.28, 0]}>
        <ringGeometry args={[0.3, 0.42, 24]} />
        <meshBasicMaterial
          color="#f7931a"
          transparent
          opacity={0.8}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
