import type { ReactNode } from "react";
import { JourneyStageLazy } from "@/components/journey/JourneyStageLazy";
import { JOURNEY_3D_ENABLED } from "@/components/journey/enabled";

export default function DriveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="journey-drive">
      {JOURNEY_3D_ENABLED ? <JourneyStageLazy /> : null}
      <div className="journey-content">{children}</div>
    </div>
  );
}
