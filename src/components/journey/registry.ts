// Journey registry — static, three-free so any client component can import it.

export type Vec3 = [number, number, number];

export type Anchor = {
  pos: Vec3;
  look: Vec3;
};

export function driveKey(trackSlug: string, driveSlug: string): string {
  return `${trackSlug}/${driveSlug}`;
}

/** Drives with a real-time 3D journey world. Everything else stays 2D. */
export const JOURNEY_DRIVES: ReadonlySet<string> = new Set([
  "bitcoin/what-is",
  "bitcoin/get-paid",
  "bitcoin/send",
  "bitcoin/guard",
  "bitcoin/road-test",
]);

/** Camera anchor per drive + step slug. Missing entries fall back gracefully. */
export const JOURNEY_ANCHORS: Record<string, Record<string, Anchor>> = {
  "bitcoin/what-is": {
    satoshi: { pos: [0, 4.8, 9.6], look: [0, 1.8, 0] },
    scarce: { pos: [14, 4.8, 9.6], look: [14, 1.8, 0] },
    block: { pos: [28, 4.8, 9.6], look: [28, 1.8, 0] },
    halving: { pos: [42, 4.8, 9.6], look: [42, 1.8, 0] },
    sats: { pos: [56, 4.8, 9.6], look: [56, 1.8, 0] },
    cheques: { pos: [70, 4.8, 9.6], look: [70, 1.8, 0] },
    change: { pos: [84, 4.8, 9.6], look: [84, 1.8, 0] },
  },
  "bitcoin/get-paid": {
    address: { pos: [0, 4.8, 9.6], look: [0, 1.8, 0] },
    receipt: { pos: [14, 4.8, 9.6], look: [14, 1.8, 0] },
    explorer: { pos: [28, 4.8, 9.6], look: [28, 1.8, 0] },
  },
  "bitcoin/send": {
    swapped: { pos: [0, 4.8, 9.6], look: [0, 1.8, 0] },
    toll: { pos: [14, 4.8, 9.6], look: [14, 1.8, 0] },
    "no-undo": { pos: [28, 4.8, 9.6], look: [28, 1.8, 0] },
  },
  "bitcoin/guard": {
    key: { pos: [0, 4.8, 9.6], look: [0, 1.8, 0] },
    words: { pos: [14, 4.8, 9.6], look: [14, 1.8, 0] },
  },
  "bitcoin/road-test": {
    support: { pos: [0, 4.8, 9.6], look: [0, 1.8, 0] },
    network: { pos: [14, 4.8, 9.6], look: [14, 1.8, 0] },
    mismatch: { pos: [28, 4.8, 9.6], look: [28, 1.8, 0] },
  },
};

export const FALLBACK_ANCHOR: Anchor = { pos: [0, 4.8, 9.6], look: [0, 1.8, 0] };

export function anchorFor(key: string, stepSlug: string): Anchor {
  const byStep = JOURNEY_ANCHORS[key];
  if (!byStep) return FALLBACK_ANCHOR;
  return (
    byStep[stepSlug] ?? Object.values(byStep)[0] ?? FALLBACK_ANCHOR
  );
}
