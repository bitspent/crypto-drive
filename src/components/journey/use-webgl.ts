"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => undefined;
}

// Detected once per session. Detection creates a real GL context, so it must
// never run per render — leaked contexts exhaust the browser's context limit
// and can get the journey canvas's own context killed.
let cached: boolean | null = null;

function detectWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    cached = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * True when the browser can render WebGL. SSR-safe: false on the server,
 * detected value on the client with no hydration mismatch.
 */
export function useWebGLAvailable(): boolean {
  return useSyncExternalStore(subscribe, detectWebGL, () => false);
}
