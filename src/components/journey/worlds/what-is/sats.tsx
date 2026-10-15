"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BlobShadow, SpotCone } from "../../rig";
import { Label, Sparkles } from "../../rig-drei";
import { useJourneySignal } from "../../journey-bus";
import { useReducedMotion } from "../../use-reduced-motion";

const GRID = 10;
const COUNT = GRID * GRID;
const SPACING = 0.23;

// App-lifetime shared instanced dots. Pure three.js objects (no DOM), safe to
// build at module scope; the world module only ever loads on the client.
function createSatDots(): { mesh: THREE.InstancedMesh; dists: number[] } {
  const geo = new THREE.SphereGeometry(0.045, 10, 10);
  const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const created = new THREE.InstancedMesh(geo, mat, COUNT);
  created.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const distances: number[] = [];
  for (let i = 0; i < COUNT; i++) {
    const gx = (i % GRID) - (GRID - 1) / 2;
    const gy = Math.floor(i / GRID) - (GRID - 1) / 2;
    distances.push(Math.hypot(gx, gy));
    dummy.position.set(gx * SPACING, gy * SPACING, 0.22);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    created.setMatrixAt(i, dummy.matrix);
  }
  created.instanceMatrix.needsUpdate = true;
  return { mesh: created, dists: distances };
}

const SAT_DOTS = createSatDots();

function coinFaceTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const grad = ctx.createRadialGradient(size * 0.36, size * 0.32, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#ffe1a8");
  grad.addColorStop(0.55, "#f7931a");
  grad.addColorStop(1, "#8a4c00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "300px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₿", size / 2, size / 2 + 18);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function SatsStop({ x, active }: { x: number; active: boolean }) {
  const win = useJourneySignal("step:win", false);
  const reduced = useReducedMotion();
  const coin = useRef<THREE.Group>(null);

  const face = useMemo(() => coinFaceTexture(), []);
  useEffect(() => () => {
    face.dispose();
  }, [face]);

  useFrame((state) => {
    if (coin.current && !reduced) {
      coin.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.18;
    }
    if (reduced) return;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const gx = (i % GRID) - (GRID - 1) / 2;
      const gy = Math.floor(i / GRID) - (GRID - 1) / 2;
      dummy.position.set(gx * SPACING, gy * SPACING, 0.22);
      dummy.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 2.2 - SAT_DOTS.dists[i] * 0.9)));
      dummy.updateMatrix();
      SAT_DOTS.mesh.setMatrixAt(i, dummy.matrix);
    }
    SAT_DOTS.mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.3, 28]} />
        <meshStandardMaterial color="#2a2f45" roughness={1} />
      </mesh>

      <group ref={coin} position={[0, 2.5, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[1.55, 1.55, 0.3, 48]} />
          <meshStandardMaterial color="#c97a10" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.16]}>
          <circleGeometry args={[1.5, 48]} />
          <meshBasicMaterial map={face} toneMapped={false} />
        </mesh>
        <primitive object={SAT_DOTS.mesh} />
      </group>

      <Label position={[0, 0.95, 1.2]} text="1 BTC = 100,000,000" tone={win ? "amber" : "ink"} height={0.3} />
      {win ? (
        <Sparkles count={30} scale={[4, 4, 3]} position={[0, 2.5, 0]} size={4} speed={0.5} color="#ffffff" opacity={0.8} />
      ) : null}
      <BlobShadow position={[0, 0.32, 0]} radius={2.2} />
      {active ? <SpotCone position={[0, 3.2, 0]} /> : null}
    </group>
  );
}
