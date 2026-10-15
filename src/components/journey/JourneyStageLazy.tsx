"use client";

import dynamic from "next/dynamic";

// The entire 3D stack (fiber + three + worlds) loads lazily on the client,
// after first paint. Content and HUD never wait for it.
const JourneyStage = dynamic(
  () => import("./JourneyStage").then((m) => m.JourneyStage),
  { ssr: false },
);

export function JourneyStageLazy() {
  return <JourneyStage />;
}
