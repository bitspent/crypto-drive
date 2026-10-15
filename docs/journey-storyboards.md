# Journey storyboards — immersive drives (3D parked, 2D in production)

> Status: the R3F Glass Observatory build below is parked behind
> `JOURNEY_3D_ENABLED=false` and ships nothing. The CSS toy scenes in
> `src/components/drive-toys.tsx` are the production experience: left
> illustration card bounded by the drive-head width (see the layout contract
> in `solution-architecture.md` §7), verified tease/win in both themes plus
> reduced-motion, mobile, and no-WebGL passes.

Retained as design reference. The 3D stack is not mounted and ships no bytes. Do not modify.

Execution artifact for the R3F journey build, kept for a future realistic-3D
asset pipeline. The CSS v2 toy scenes were the fallback layer and the visual
baseline for these boards.

## Art direction (locked for build)

- **Look:** Glass Observatory — warm miniature dioramas in a glass vitrine,
  "golden-hour valley" in light mode, indigo night in dark mode. The 3D layer
  follows the page theme live (sky, ground, road, lights, glass tint).
- **Light rig (shared):** hemisphere wash + warm key directional + amber rim
  point light, all theme-driven. Fog matched to the sky so background stops
  melt away.
- **Materials:** chunky readable shapes, `meshStandardMaterial` roughness ~0.8,
  no shadow maps (painted blob shadows instead — cheap on phones). Two glass
  tiers: cheap fake glass everywhere, at most ONE true-transmission surface
  per stop (the traveler orb).
- **Type in world:** canvas-texture labels (offline-safe), white text on orange
  for badges, plaques, and seals — same rule as the 2D UI, in both themes.
- **Camera:** perspective 38°, damped glide between stops (~1.2s), gentle idle
  sway on desktop only. On wide screens the look-target shifts +1.4 X so the
  vignette clears the HUD column; on phones the subject stays centered above
  the scrolling sheets. Framing rule: vignette essentials live within ±2.8
  local X of the stop and below y 3.2 at center — outside that is HUD/title
  territory (verified per stop in both themes).
- **Vitrine:** the active stop gets a glass case (dark base, glass walls,
  fixed roof cap). Win reads as light, never moving geometry: the roof glows
  amber and the front glass dissolves, plus sparkles and a status stamp.

## Camera language

- Stop changes are **flights along the road**, eased out with a small settle.
- **Focus** = spotlight cone + fog + vignette scale. Non-current stops stay
  visible but dim and fogged for continuity.
- **Payoffs** = overshoot scale pop + spark burst + badge stamp.
- Reduced motion: jump cuts to static end frames, zero continuous motion.
- No WebGL / SSR: the legacy Split + CSS toy layout renders instead.

## Pilot: bitcoin / what-is (world key `bitcoin/what-is`)

One valley, road along +X, stops every 14 units. Base `x = index * 14`.
Camera anchor per stop: `pos = (x, 4.8, 9.6)`, `look = (x, 1.8, 0)`
(+1.4 X look-shift on wide screens, applied in `CameraDirector`).

| # | Step slug | Vignette | Signals | Win payoff |
|---|-----------|----------|---------|------------|
| 1 | satoshi | Hooded author at desk + portrait easel (left), quill scribbles; paper floats center; node-mesh dome deep behind glass (depth) | `step:win` | Paper flies INTO the dome, mesh glows, `2009 LIVE` badge stamps; whitepaper + open-network links live in the HUD |
| 2 | scarce | Stave barrel on plaza, coins mounded to the rim, `21,000,000` plaque | `step:win` | `+1` coin arcs in and bounces off the rim, `SEALED` badge |
| 3 | block | 4 fee-strata blocks receding over a bridge, link bars, miner with hammer | `step:win` | Hammer strikes, spark burst, tip block flashes, `TIP` seal + `~10:00` chip |
| 4 | halving | 4 shrinking reward bars on terraces, floating `÷2` markers | `step:win` | Past eras dim, current bar rings, `NOW` tag |
| 5 | sats | Big BTC coin on a dais, 100+ instanced sat dots rippling outward | `step:win` | Ripple brightens, `1 BTC = 100,000,000 sats` meter glows |
| 6 | cheques | Depot desk, 3 UTXO cards fanned in the air | `cheques-progress` 0..1, `step:win` | Cards stack as the total is typed, `STACKED` stamp + total emboss |
| 7 | change | Split altar: one fat cheque | `change-spent`, `step:win` | Cheque sinks, `PAY` + `CHANGE` cheques rise |

## Rollout worlds (step 4)

- `bitcoin/get-paid`: plate plaza (address ends light as copied/matched) →
  receipt printer (slip + 3 confirmation stamps).
- `bitcoin/send`: paste shear gate (bad ending shears off) → toll highway
  (slow gate opens, fast lane sirens) → dive platform (coin drops, UNDO cracks).
- `bitcoin/guard`: mailbox (fills, stays green) vs key vault (melts red) →
  word vault (12 slots stamp in order).
- `bitcoin/road-test`: phish bubble → shredder → network doors (ETH rattles,
  BTC opens) → trapdoor (slams shut on stop).

## HUD rules

- Desktop: world open on the left, HUD column right (~380px, liquid-glass
  panels, theme-aware). 3D essentials stay left of the column (see framing
  rule above); only decorative fringe may sit behind the glass.
- Mobile: ~36vh world window on top, content sheets scroll below (solid).
- One primary action per stop, journey-map progress (`STOP i/n`), sticky
  footer bar. Gating, progress POSTs, and cert logic stay exactly as today.
- Validation gotcha: screenshots taken <2s after arrival catch the camera
  mid-flight (~0.8u off). Settle ≥2.8s before judging framing; the committed
  Playwright walk accounts for this.

## Fallbacks

- WebGL unavailable → legacy Split + CSS toys (automatic, same content).
- Reduced motion → static end frames + jump-cut camera.
- SSR / first paint → nothing 3D; worlds load per-drive via `next/dynamic`
  with `ssr: false` and never block content.
