"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Component, Suspense, useEffect, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { JOURNEY_DRIVES, anchorFor, driveKey } from "./registry";
import { resetJourneyBus } from "./journey-bus";
import { CameraDirector, JourneyLights } from "./rig";

const BitcoinWhatIsWorld = dynamic(
  () => import("./worlds/bitcoin-what-is").then((m) => m.BitcoinWhatIsWorld),
  { ssr: false },
);
const BitcoinGetPaidWorld = dynamic(
  () => import("./worlds/bitcoin-get-paid").then((m) => m.BitcoinGetPaidWorld),
  { ssr: false },
);
const BitcoinSendWorld = dynamic(
  () => import("./worlds/bitcoin-send").then((m) => m.BitcoinSendWorld),
  { ssr: false },
);
const BitcoinGuardWorld = dynamic(
  () => import("./worlds/bitcoin-guard").then((m) => m.BitcoinGuardWorld),
  { ssr: false },
);
const BitcoinRoadTestWorld = dynamic(
  () => import("./worlds/bitcoin-road-test").then((m) => m.BitcoinRoadTestWorld),
  { ssr: false },
);

const WORLDS: Record<string, React.ComponentType<{ step: string }>> = {
  "bitcoin/what-is": BitcoinWhatIsWorld,
  "bitcoin/get-paid": BitcoinGetPaidWorld,
  "bitcoin/send": BitcoinSendWorld,
  "bitcoin/guard": BitcoinGuardWorld,
  "bitcoin/road-test": BitcoinRoadTestWorld,
};

/** If WebGL fails at runtime, vanish and let the 2D content stand alone. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Exposes last-frame render stats for the perf-gate probe. */
function PerfTap() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const w = window as unknown as { __journeyPerf?: () => unknown };
    w.__journeyPerf = () => {
      let meshes = 0;
      scene.traverse((o) => {
        if ((o as { isMesh?: boolean }).isMesh) meshes += 1;
      });
      return {
        meshes,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
      };
    };
    return () => {
      delete w.__journeyPerf;
    };
  }, [gl, scene]);
  return null;
}

/**
 * Persistent journey stage. Mounted once per drive layout — it does NOT
 * remount on step navigation, so the camera flies instead of flashing.
 */
export function JourneyStage() {
  const params = useParams();
  const key = driveKey(param(params.slug), param(params.drive));
  const step = param(params.step);
  const World = WORLDS[key];

  useEffect(() => {
    resetJourneyBus();
  }, [key, step]);

  if (!World || !JOURNEY_DRIVES.has(key)) return null;
  const anchor = anchorFor(key, step);

  return (
    <div className="journey-stage" aria-hidden="true">
      <StageBoundary>
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 38, near: 0.1, far: 220, position: anchor.pos }}
        >
          <JourneyLights />
          <Suspense fallback={null}>
            <World step={step} />
          </Suspense>
          <CameraDirector anchor={anchor} />
          <PerfTap />
        </Canvas>
      </StageBoundary>
    </div>
  );
}
