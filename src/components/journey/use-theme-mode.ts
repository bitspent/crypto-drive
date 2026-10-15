"use client";

import { useSyncExternalStore } from "react";
import { JOURNEY_PALETTES, type JourneyPalette, type ThemeMode } from "./palette";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("storage", onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onChange);
  };
}

function snapshot(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Live page theme for the 3D layer. SSR-safe (assumes dark first paint). */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, snapshot, () => "dark");
}

/** Theme palette for the 3D layer. Worlds re-render instantly on toggle. */
export function useThemePalette(): JourneyPalette {
  return JOURNEY_PALETTES[useThemeMode()];
}
