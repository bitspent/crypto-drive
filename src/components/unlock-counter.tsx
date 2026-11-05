"use client";

import { useState } from "react";
import { LicenseCard } from "@/components/license-card";
import { UnlockForm } from "@/components/unlock-form";

export type LicenseClass = {
  id: string;
  name: string;
  shortName: string;
  priceBand: string;
  recommended?: boolean;
  whoFor: string;
};

/*
 * The counter: the form and the blank licence side by side, with the
 * classes we issue laid out underneath like the menu on a DMV wall.
 */
export function UnlockCounter({
  classes,
  demoHint,
}: {
  classes: LicenseClass[];
  demoHint: boolean;
}) {
  const [email, setEmail] = useState("");

  return (
    <section aria-label="License counter" className="counter-grid">
      <div className="counter-panel">
        <UnlockForm email={email} onEmailChange={setEmail} />
        {demoHint ? (
          <p className="counter-demo-hint" data-testid="demo-hint">
            Trying the demo? <code>CD-DRIVE-2026</code> unlocks Certified.
          </p>
        ) : null}
      </div>
      <div className="counter-card-side">
        <LicenseCard email={email} />
        <p className="counter-card-note">
          Your key stamps the class. One licence per tier — Starter, Certified,
          or VIP.
        </p>
      </div>
      <ul className="counter-classes" aria-label="Classes we issue">
        {classes.map((cls) => (
          <li key={cls.id} className="counter-class-row" data-testid="class-row">
            <span className="counter-class-medal" aria-hidden="true">
              {cls.shortName.charAt(0)}
            </span>
            <div className="counter-class-copy">
              <p className="counter-class-name">
                {cls.name}
                {cls.recommended ? (
                  <span className="counter-class-rec" data-testid="class-recommended">
                    Recommended
                  </span>
                ) : null}
              </p>
              <p className="counter-class-who">{cls.whoFor}</p>
            </div>
            <span className="counter-class-price">{cls.priceBand}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
