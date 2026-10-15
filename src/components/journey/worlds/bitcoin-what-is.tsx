"use client";

import { Traveler } from "../rig";
import { Sparkles } from "../rig-drei";
import { DriveArch, VitrineShell } from "../rig-glass";
import { useThemePalette } from "../use-theme-mode";
import { JOURNEY_ANCHORS } from "../registry";
import { SatoshiStop } from "./what-is/satoshi";
import { ScarceStop } from "./what-is/scarce";
import { BlockStop } from "./what-is/block";
import { HalvingStop } from "./what-is/halving";
import { SatsStop } from "./what-is/sats";
import { ChequesStop } from "./what-is/cheques";
import { ChangeStop } from "./what-is/change";

const STOPS = Object.entries(JOURNEY_ANCHORS["bitcoin/what-is"] ?? {});
const DASHES = Array.from({ length: 26 }, (_, i) => -6 + i * 4);
const HILLS: Array<[number, number, number]> = [
  [-10, 3.2, 2.6],
  [12, 4.2, 3.2],
  [34, 3.6, 2.8],
  [58, 4.6, 3.4],
  [80, 3.4, 2.7],
  [98, 4.0, 3.0],
];

const VIGNETTES: Record<string, React.ComponentType<{ x: number; active: boolean }>> = {
  satoshi: SatoshiStop,
  scarce: ScarceStop,
  block: BlockStop,
  halving: HalvingStop,
  sats: SatsStop,
  cheques: ChequesStop,
  change: ChangeStop,
};

export function BitcoinWhatIsWorld({ step }: { step: string }) {
  const palette = useThemePalette();
  const currentX = STOPS.find(([slug]) => slug === step)?.[1].look[0] ?? 0;
  return (
    <group>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 20, 70]} />
      <mesh position={[42, 0, -6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[240, 90]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <mesh position={[42, 0.02, 2.5]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[130, 4.6]} />
        <meshStandardMaterial color={palette.road} roughness={1} />
      </mesh>
      {DASHES.map((x) => (
        <mesh key={x} position={[x, 0.04, 2.5]}>
          <boxGeometry args={[1.1, 0.03, 0.2]} />
          <meshBasicMaterial color={palette.dash} toneMapped={false} />
        </mesh>
      ))}
      {HILLS.map(([x, h, r], i) => (
        <mesh key={i} position={[x, h / 2 - 0.1, -16]}>
          <coneGeometry args={[r, h, 7]} />
          <meshStandardMaterial color={palette.hills} roughness={1} />
        </mesh>
      ))}
      {STOPS.map(([slug, anchor]) => {
        const Stop = VIGNETTES[slug];
        if (!Stop) return null;
        return <Stop key={slug} x={anchor.look[0]} active={slug === step} />;
      })}
      <Traveler x={currentX} />
      <VitrineShell key={step} x={currentX} />
      <DriveArch x={93} label="NEXT DRIVE" />
      <Sparkles
        count={70}
        scale={[120, 12, 34]}
        position={[42, 5, -2]}
        size={2}
        speed={0.25}
        color="#f5c46b"
        opacity={0.55}
      />
    </group>
  );
}
