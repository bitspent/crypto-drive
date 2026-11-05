"use client";

import { useEffect, useRef, useState } from "react";

/*
 * The blank operator licence waiting on the counter. A physical object:
 * fixed dark print + amber guilloche in both themes. The holder line
 * mirrors the email typed into the form; tilt follows the pointer only
 * when the device can hover and motion is welcome.
 */
export function LicenseCard({ email }: { email: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [canTilt, setCanTilt] = useState(false);

  useEffect(() => {
    const hover = window.matchMedia("(hover: hover)");
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const sync = () => setCanTilt(hover.matches && motion.matches);
    sync();
    hover.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      hover.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canTilt || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cardRef.current.style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
    cardRef.current.style.setProperty("--tilt-y", `${(x * 9).toFixed(2)}deg`);
  };

  const onLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--tilt-x", "0deg");
    cardRef.current.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <div className="license-card-tilt" aria-hidden="true">
      <div
        ref={cardRef}
        className="license-card"
        data-testid="license-card"
        onPointerMove={canTilt ? onMove : undefined}
        onPointerLeave={canTilt ? onLeave : undefined}
      >
        <span className="license-card-slot" />
        <p className="license-card-brand">CRYPTO DRIVE</p>
        <p className="license-card-doc">OPERATOR LICENCE</p>
        <div className="license-card-fields">
          <div>
            <p className="license-card-label">Holder</p>
            <p className="license-card-value" data-testid="license-holder">
              {email || "—"}
            </p>
          </div>
          <div>
            <p className="license-card-label">Class</p>
            <p className="license-card-value">Issued by key</p>
          </div>
          <div>
            <p className="license-card-label">Valid</p>
            <p className="license-card-value">Lifetime · per tier</p>
          </div>
        </div>
        <div className="license-card-foot">
          <span className="license-card-sign" />
          <span className="license-card-seal" />
        </div>
      </div>
    </div>
  );
}
