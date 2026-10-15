"use client";

import { useEffect, useMemo, type ComponentProps, type ReactNode } from "react";
import * as THREE from "three";
import { Billboard, Sparkles as DreiSparkles, useTexture } from "@react-three/drei";
import type { Vec3 } from "./registry";
import { AMBER_SOFT } from "./rig";
import { useReducedMotion } from "./use-reduced-motion";
import { useThemePalette } from "./use-theme-mode";

/**
 * Drei-dependent rig pieces, isolated so the drive layout chunk (which only
 * needs lights + camera) never pays for drei. Imported solely by the
 * per-drive world modules behind next/dynamic ssr:false.
 */

export type LabelTone = "amber" | "ink" | "go" | "danger";

const TONES: Record<LabelTone, string> = {
  amber: "#f7931a",
  ink: "rgba(12,16,24,0.85)",
  go: "#0d9488",
  danger: "#c2410c",
};

function pillPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
}

/** Billboarded pill label rendered from an offline-safe canvas texture. */
export function Label({
  position,
  text,
  tone = "amber",
  height = 0.55,
}: {
  position: Vec3;
  text: string;
  tone?: LabelTone;
  height?: number;
}) {
  const { texture, aspect } = useMemo(() => {
    const scale = 2;
    const padX = 30;
    const h = 88;
    const font = "700 46px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    const measurer = document.createElement("canvas").getContext("2d");
    if (!measurer) throw new Error("2d context unavailable");
    measurer.font = font;
    const w = Math.ceil(measurer.measureText(text).width) + padX * 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.scale(scale, scale);
    pillPath(ctx, w, h, h / 2);
    ctx.fillStyle = TONES[tone];
    ctx.fill();
    ctx.font = font;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, h / 2 + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: w / h };
  }, [text, tone]);

  useEffect(() => () => {
    texture.dispose();
  }, [texture]);

  return (
    <Billboard position={position}>
      <mesh scale={[height * aspect, height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

/** Motion-safe sparkles: hidden entirely under reduced motion. */
export function Sparkles(props: ComponentProps<typeof DreiSparkles>) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <DreiSparkles {...props} />;
}

/** Shared valley shell: sky, fog, ground, road, hills, dust. Vignettes slot in. */
export function WorldShell({
  center,
  roadLength,
  children,
}: {
  center: number;
  roadLength: number;
  children: ReactNode;
}) {
  const dashes = useMemo(() => {
    const n = Math.max(4, Math.floor(roadLength / 4));
    return Array.from({ length: n }, (_, i) => center - roadLength / 2 + 3 + i * 4);
  }, [center, roadLength]);
  const hills = useMemo(
    () =>
      [-0.42, -0.24, -0.06, 0.12, 0.3, 0.44].map((f, i) => ({
        x: center + f * roadLength * 2,
        h: [3.2, 4.2, 3.6, 4.6, 3.4, 4.0][i],
        r: [2.6, 3.2, 2.8, 3.4, 2.7, 3.0][i],
      })),
    [center, roadLength],
  );
  const palette = useThemePalette();
  return (
    <group>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 20, 70]} />
      <mesh position={[center, 0, -6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[roadLength + 110, 90]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <mesh position={[center, 0.02, 2.5]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[roadLength, 4.6]} />
        <meshStandardMaterial color={palette.road} roughness={1} />
      </mesh>
      {dashes.map((x) => (
        <mesh key={x} position={[x, 0.04, 2.5]}>
          <boxGeometry args={[1.1, 0.03, 0.2]} />
          <meshBasicMaterial color={palette.dash} toneMapped={false} />
        </mesh>
      ))}
      {hills.map((hill, i) => (
        <mesh key={i} position={[hill.x, hill.h / 2 - 0.1, -16]}>
          <coneGeometry args={[hill.r, hill.h, 7]} />
          <meshStandardMaterial color={palette.hills} roughness={1} />
        </mesh>
      ))}
      {children}
      <Sparkles
        count={Math.round(roadLength * 0.8)}
        scale={[roadLength, 12, 34]}
        position={[center, 5, -2]}
        size={2}
        speed={0.25}
        color={AMBER_SOFT}
        opacity={0.55}
      />
    </group>
  );
}

/** Framed portrait from a public image URL. Unlit for readability. */
export function Portrait({
  position,
  src,
  width = 2.7,
  height = 1.5,
  rotationY = 0,
}: {
  position: Vec3;
  src: string;
  width?: number;
  height?: number;
  rotationY?: number;
}) {
  const tex = useTexture(src);
  const mapped = useMemo(() => {
    const clone = tex.clone();
    clone.colorSpace = THREE.SRGBColorSpace;
    clone.needsUpdate = true;
    return clone;
  }, [tex]);
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh>
        <boxGeometry args={[width + 0.28, height + 0.28, 0.12]} />
        <meshStandardMaterial color="#3a2410" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={mapped} toneMapped={false} />
      </mesh>
    </group>
  );
}
