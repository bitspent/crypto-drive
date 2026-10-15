"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function RouteStage({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="stage-shell">
      <div className="road-ambient" aria-hidden />
      <div key={pathname} className="stage-enter">
        {children}
      </div>
    </div>
  );
}
