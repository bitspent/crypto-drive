# E2E tests

Browser specs for the full learner journey in `@playwright/test` format. No
screenshots are compared; every spec asserts on DOM state, URLs, geometry,
or computed style.

## Specs

| File | What it proves |
| --- | --- |
| `walk.spec.ts` | Unlock → all 26 steps → certificate issue → verify page, zero console/page/network errors, zero 429s, layout contract on every prove-it step |
| `usdt-walk.spec.ts` | Unlock → all 10 USDT steps → certificate issue → verify page, zero console/page/network errors, zero 429s |
| `layout.spec.ts` | Left column and illustration card stay within the drive-head width, desktop + mobile viewports, both themes |
| `keyboard.spec.ts` | ArrowRight advances, ArrowLeft goes back, Up/Down rove focus, arrows never hijack typing |
| `reduced-motion.spec.ts` | Under `prefers-reduced-motion`, no animation runs and end poses pin |
| `no-webgl.spec.ts` | With the GPU fully disabled, the 2D path renders and no `<canvas>` appears |
| `mobile.spec.ts` | A step renders the 2D illustration card on a mobile viewport |
| `wallet-setup.spec.ts` | Wallet setup: empty state → seed reveal → 3/7/11 confirm → ready |
| `wallet-deposit.spec.ts` | Receive sheet → incoming tx → 0/3→confirmed ticks |
| `wallet-send.spec.ts` | Send form → review sheet → checkbox gate → confirmed send |
| `wallet-backup.spec.ts` | Backup, restore (right + wrong words), reset |
| `bitcoin-modes.spec.ts` | Regtest routes 404 in simulated mode; static fee tiers resolve |
| `legal.spec.ts` | Terms/privacy/refund reachable from the unlock footer, render clean, link home, no horizontal scroll |
| `health.spec.ts` | `GET /api/health` reports ok with db backend + bitcoin mode |
| `cert-gate.spec.ts` | Direct POST to `/api/complete` with no exam pass fails closed |
| `wallet-details.spec.ts` | Tx details sheet: rows, txid copy, focus return, simulated block |
| `wallet-modal.spec.ts` | In-course wallet dialog: drag, resize, sheets, trap, drawer sheet |
| `regtest-deposit.spec.ts` | Regtest faucet deposit links to the explorer (regtest project only) |

Projects: `chromium` (1440×900, everything except `mobile.spec.ts` and
`regtest-*`) and `mobile` (390×844: `layout`, `legal`, `mobile`, `walk`,
`wallet-*`, `bitcoin-modes`, `keyboard`). The `regtest` project lives in
`playwright.regtest.config.ts` (own server + stub infra, see below). Runs
are serial (`workers: 1`) because specs share one app server and database.

## Run locally (file store)

```sh
npm ci
npx playwright install chromium   # once per machine
CERT_HASH_SECRET=e2e npm run build   # webServer serves `next start`
npm run test:e2e                  # or: npm run test:e2e:ui
```

`next build` runs in production mode, which refuses to boot without a
signing secret — the `CERT_HASH_SECRET=e2e` prefix is required, not
optional. Any value works here; it signs disposable test data only.

To run against an already-running server instead (e.g. `npm run dev`), start
it on the same port first — it is reused automatically outside CI. Use a
different port with `E2E_PORT=xxxx npm run test:e2e` (start your server on
that port too). If results look stale, check for a squatter on the port
before debugging the app: `lsof -iTCP:43127 -sTCP:LISTEN`.

## Run locally (Postgres)

The suite also runs against Postgres; both modes must stay green.

```sh
docker run -d --name crypto-drive-pg -p 5433:5432 \
  --health-cmd="pg_isready -U postgres" --health-interval=10s \
  --health-timeout=5s --health-retries=3 --health-start-period=15s \
  -e POSTGRES_PASSWORD=postgres postgres:16   # once; keep it running
export E2E_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres
DATABASE_URL=$E2E_DATABASE_URL npm run db:test-setup   # migrate + truncate
E2E_DATABASE_URL=$E2E_DATABASE_URL npm run test:e2e
```

Re-run `db:test-setup` whenever migrations change. The unit suite follows
the same two modes: `node --test --test-concurrency=1 tests/` (file) and
`DATABASE_URL=... node --test --test-concurrency=1 tests/` (Postgres,
serial — file-store writers race across files otherwise).

## Run in CI

`.github/workflows/ci.yml` runs the fast gates on every push and PR: lint,
unit (`npm run test:unit`), and `next build` with a throwaway secret. The
browser suite stays manual (runners need browsers + minutes); to run it in
CI yourself:

```sh
npm ci
npx playwright install --with-deps chromium
CERT_HASH_SECRET=ci npm run build
npm run test:e2e
```

`CI=true` forces a fresh `next start` on the default port (43127). Traces are
kept only for failed tests (`trace: retain-on-failure`); open one with
`npx playwright show-report`.

## Regtest link spec

`regtest-deposit.spec.ts` needs `BITCOIN_MODE=regtest`, so it runs under its
own config with its own app server (default port 43207) and a stub infra-api
the spec boots itself on 127.0.0.1:43981 (fixed port, fails fast with the
squatter hunt command when taken):

```sh
CERT_HASH_SECRET=e2e npm run build   # same artifact, runtime-switched mode
npm run test:e2e:regtest
```

It proves the full on-chain path — faucet fund → `onChain: true` deposit →
explorer link in tx details — without Nigiri. Override the app port with
`E2E_PORT=xxxx` (start nothing yourself; the config boots the server).

## Notes

- Specs unlock with the demo license (`CD-DRIVE-2026`) and a unique email per
  run, so parallel machines never share a student. The harness sets
  `ALLOW_DEMO_LICENSES=1` because it boots `next start` (production mode);
  never set that in a real deploy.
- No absolute paths: the app URL comes from `baseURL` (see
  `playwright.config.ts`), which defaults to `http://127.0.0.1:43127`.
- Rate limits are tuned so the full walk never 429s; `walk.spec.ts`
  asserts zero 429 responses explicitly.
