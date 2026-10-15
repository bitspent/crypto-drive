# E2E tests

Browser specs for the full learner journey, ported from the operator-local
validation scripts into `@playwright/test` format. No screenshots are
compared; every spec asserts on DOM state, URLs, geometry, or computed style.

## Specs

| File | What it proves |
| --- | --- |
| `walk.spec.ts` | Unlock → all 24 steps → certificate issue → verify page, with zero console/page/network errors, plus the layout contract on every prove-it step |
| `layout.spec.ts` | Left column and illustration card stay within the drive-head width, desktop + mobile viewports, both themes |
| `keyboard.spec.ts` | ArrowRight advances, ArrowLeft goes back, Up/Down rove focus, arrows never hijack typing |
| `reduced-motion.spec.ts` | Under `prefers-reduced-motion`, no animation runs and end poses pin |
| `no-webgl.spec.ts` | With the GPU fully disabled, the 2D path renders and no `<canvas>` appears |
| `mobile.spec.ts` | A step renders the 2D illustration card on a mobile viewport |

Projects: `chromium` (1440×900, everything except `mobile.spec.ts`) and `mobile`
(390×844, `layout.spec.ts` + `mobile.spec.ts` + `walk.spec.ts`, so the capstone
layout contract is covered at both viewports). Runs are serial (`workers: 1`)
because the app keeps sessions in a file-backed store.

## Run locally

```sh
npm ci
npx playwright install chromium   # once per machine
npm run build                     # webServer serves `next start`
npm run test:e2e                  # or: npm run test:e2e:ui
```

To run against an already-running server instead (e.g. `npm run dev`), start it
on the same port first — it is reused automatically outside CI. Use a different
port with `E2E_PORT=xxxx npm run test:e2e` (start your server on that port too).

## Run in CI

```sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

`CI=true` forces a fresh `next start` on the default port (43127). Traces are
kept only for failed tests (`trace: retain-on-failure`); open one with
`npx playwright show-report`.

## Notes

- Specs unlock with the demo license (`CD-DRIVE-2026`) and a unique email per
  run, so parallel machines never share a student.
- No absolute paths: the app URL comes from `baseURL` (see
  `playwright.config.ts`), which defaults to `http://127.0.0.1:43127`.
