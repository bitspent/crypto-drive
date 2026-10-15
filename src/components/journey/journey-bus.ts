"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

const values = new Map<string, unknown>();
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

/** Publish a scene signal (progress 0..1, flags, counts). Primitives only. */
export function publish(key: string, value: unknown): void {
  if (values.get(key) === value) return;
  values.set(key, value);
  emit();
}

/** Clear all signals. Called on step change so state never leaks across stops. */
export function resetJourneyBus(): void {
  if (values.size === 0) return;
  values.clear();
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to a signal inside a 3D scene. Returns `initial` until published. */
export function useJourneySignal<T>(key: string, initial: T): T {
  return useSyncExternalStore(
    subscribe,
    () => (values.has(key) ? (values.get(key) as T) : initial),
    () => initial,
  );
}
