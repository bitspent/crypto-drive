# Crypto Drive

Wallet coaching for professionals — learn to use crypto the way you’d learn to drive.

**Product packaging is by tier** (Starter / Certified Practitioner / VIP). The curriculum spine is **tracks**: Bitcoin (ready) → Ethereum / USDT+networks / Tron / Solana (coming-next scaffolds).

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Course content in `content/tiers/` + `content/tracks/`
- Light + dark theme (CSS variables + toggle)
- `@vercel/og` certificate images (Certified / VIP)
- Supabase Postgres via Drizzle (`.data/store.json` file fallback in dev only)
- Gumroad webhooks + license verification + Resend emails (live commerce path)
- Bitcoin backends: simulated (default) / signet / regtest (`src/lib/bitcoin/`)

## Quick start

```bash
npm install
cp .env.example .env.local   # dev works without it (one warning); production builds require CERT_HASH_SECRET
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Bitcoin modes in dev

| Command | Backend | Needs |
| --- | --- | --- |
| `npm run dev` | Simulated (play money) | Nothing — no infra, no internet |
| `npm run dev:signet` | Signet (live fees + lookups) | Internet |
| `npm run dev:regtest` | Local regtest via Nigiri | Nigiri + infra-api (below) |

Setup for regtest dev:

```bash
curl https://getnigiri.vulpem.com | bash
npm run boot -- regtest   # checks ports, starts Nigiri + infra-api, boots the app
```

`boot` is the interactive full-stack boot: it verifies tooling, resolves
every port conflict (jump / kill / abort — never kills foreign PIDs without
asking), starts Nigiri and the infra-api when they are down, then execs the
dev server. Flags: `--app-port`, `--infra-port`, `--with-db` (also boot local
Postgres), `--yes` (non-interactive), `--kill-ours`, `--dry-run`, and `-i`
(guided 7-question setup first — mode, ports, db, conflict policy, confirm;
flags you pass become the defaults).
`npm run boot -- --help` prints the full policy. The older
`npm run dev:regtest` still works as a fail-fast variant (it refuses to boot
unless bitcoind answers on `localhost:18443` and the infra-api on
`localhost:8081`, and starts nothing itself).

On a fresh Nigiri start, mine one block so electrs leaves its sync wait (any
`generatetoaddress` call does it). Stop with `nigiri stop` and
`docker compose -f docker-compose.infra-api.yml down`.

**Which mode am I in?** Check the wallet address prefix — `bc1q…` is
simulated, `tb1…` is signet, `bcrt1…` is regtest — or ask the app:
`GET /api/health` returns the live `bitcoin` mode and `db` backend.
Default `npm run dev` is always simulated play money with zero network calls.

See `docs/deployment-modes.md` for when to use each mode.

## Demo licenses → tiers

| Key | Tier |
| --- | --- |
| `CD-DRIVE-STARTER` | Starter (full practice drive; verify link locked) |
| `CD-DRIVE-2026` | **Certified** (default demo — capstone + one cert) |
| `CD-DRIVE-CERTIFIED` | Certified |
| `CD-DRIVE-VIP` | VIP (Certified path + call / Q&A CTAs) |

1. **I have a license** → `/unlock`
2. Enter any email + a demo key above
3. Land on `/course` → open **Bitcoin**
4. Walk the six drives (protocol intro first, capstone last). Certified/VIP: pass the capstone → certify → `/verify/[id]`. Practice address and words are unique to your email + license.

Demo keys work in dev and in the e2e harness only — real production
rejects them, and real buyers unlock with `CD-<TIER>-*` keys from email.

## Docs

Product and curriculum briefs live in `docs/` (kept in sync with Project Context):

| Doc | What |
| --- | --- |
| [`docs/project-context.md`](docs/project-context.md) | Locked product brief |
| [`docs/course-agenda.md`](docs/course-agenda.md) | Curriculum spine (BTC → ETH → USDT → Solana) |
| [`docs/course-guides/bitcoin.md`](docs/course-guides/bitcoin.md) | Track A as it ships today |
| [`docs/course-guides/bitcoin-first-drive.md`](docs/course-guides/bitcoin-first-drive.md) | Track A rebuild plan (shipped; design history) |
| [`docs/tiers/`](docs/tiers/) | Starter / Certified / VIP packaging |
| [`docs/solution-architecture.md`](docs/solution-architecture.md) | App architecture (see its status note) |
| [`docs/deployment-modes.md`](docs/deployment-modes.md) | Simulated / signet / regtest backends |
| [`docs/infra-contract.md`](docs/infra-contract.md) | Self-hosted regtest API contract |
| [`docs/deploy-vercel.md`](docs/deploy-vercel.md) | Production deploy runbook |
| [`docs/charge-ready-checklist.md`](docs/charge-ready-checklist.md) | Pre-launch gate (zero P0s) |
| [`docs/legal-review-checklist.md`](docs/legal-review-checklist.md) | Lawyer review list |
| [`docs/first-slice-plan.md`](docs/first-slice-plan.md) | Slice 1 plan |
| [`docs/crypto-drive.md`](docs/crypto-drive.md) | Source notes / longer brief |

## Content layout

```
content/
  tiers/          # starter | certified | vip (+ index demo map)
  tracks/         # bitcoin first drive (ready) · ethereum · usdt-networks · tron · solana (scaffolds)
```

## Environment

`.env.example` documents every variable with comments — copy it to
`.env.local` for development. Production values live in Vercel, never in
git. The two that gate a production boot are `CERT_HASH_SECRET` (build
refuses without it) and `LICENSE_PEPPER` (license lookups fail closed
without it). `DATABASE_URL` unset means the dev-only file store.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port **43127** (simulated Bitcoin) |
| `npm run dev:signet` | Dev server with live signet fees (needs internet) |
| `npm run dev:regtest` | Dev server on local regtest (needs Nigiri + infra-api) |
| `npm run boot -- [mode]` | Interactive full-stack boot: ports, Nigiri, infra-api, app (`--help` for flags) |
| `bash scripts/check-ports.sh [mode]` | Diagnose port conflicts without changing anything |
| `npm run build` | Production build |
| `npm start` | Production server on **43127** |
| `npm run lint` | ESLint |
| `node --test --test-concurrency=1 tests/` | Unit tests (serial: file-store writers race across files) |
| `npm run test:e2e` | Playwright suite (build first; `test:e2e:ui` for interactive) |
| `npm run db:test-setup` | Apply migrations + truncate (needs `DATABASE_URL`) |

## Ports

| Port | What |
| --- | --- |
| 43127 | The app (`dev`, `start`, e2e default; override with `E2E_PORT`) |
| 5433 | Local Postgres (`crypto-drive-pg` container, e2e pg mode) |
| 8081 | infra-api (regtest dev only) |
| 18443 / 30000 / 5000 | Nigiri bitcoind RPC / electrs / Esplora (regtest dev only) |

If the app misbehaves on 43127, check for a stale server first — the e2e
harness reuses whatever already listens there. `lsof -iTCP:43127 -sTCP:LISTEN`
shows the squatter; use a fresh `E2E_PORT` rather than killing foreign
processes.

## Loop

Ads (later) → Gumroad **tier** SKU → unlock → Bitcoin drive (6 drives, capstone cert) → one cert (Certified+) → share.
