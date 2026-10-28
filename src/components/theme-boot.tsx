"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";

/**
 * No-flash theme boot. The inline script must reach the initial HTML so it
 * runs before hydration, but React never executes script tags rendered on
 * the client (Fast Refresh, re-renders) and logs an error for them — so this
 * renders the script for hydration and removes it once mounted. Post-boot
 * the node is inert; ThemeProvider owns the theme from then on.
 */
export function ThemeBoot({ code }: { code: string }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (mounted) return null;
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- rendered only from the root layout
    <Script id="cd-theme-boot" strategy="beforeInteractive">
      {code}
    </Script>
  );
}
