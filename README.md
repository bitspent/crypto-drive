# Crypto Drive

Wallet coaching for professionals — learn to use crypto the way you’d learn to drive.

**Product packaging is by tier** (Starter / Certified Practitioner / VIP). The curriculum spine is **tracks**: Bitcoin (ready) → Ethereum / USDT+networks / Tron / Solana (coming-next scaffolds).

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Course content in `content/tiers/` + `content/tracks/`
- Light + dark theme (CSS variables + toggle)
- `@vercel/og` certificate images (Certified / VIP)
- File-backed demo store (`.data/store.json`) — no Supabase yet
- Gumroad CTA placeholder until live license webhooks land

## Quick start

```bash
npm install
cp .env.example .env.local   # dev works without it (one warning); production builds require CERT_HASH_SECRET
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

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

## Docs

Product and curriculum briefs live in `docs/` (kept in sync with Project Context):

| Doc | What |
| --- | --- |
| [`docs/project-context.md`](docs/project-context.md) | Locked product brief |
| [`docs/course-agenda.md`](docs/course-agenda.md) | Curriculum spine (BTC → ETH → USDT → Solana) |
| [`docs/course-guides/bitcoin.md`](docs/course-guides/bitcoin.md) | Track A as it ships today |
| [`docs/course-guides/bitcoin-first-drive.md`](docs/course-guides/bitcoin-first-drive.md) | Track A rebuild plan (shipped; design history) |
| [`docs/tiers/`](docs/tiers/) | Starter / Certified / VIP packaging |
| [`docs/solution-architecture.md`](docs/solution-architecture.md) | App architecture |
| [`docs/first-slice-plan.md`](docs/first-slice-plan.md) | Slice 1 plan |
| [`docs/crypto-drive.md`](docs/crypto-drive.md) | Source notes / longer brief |

## Content layout

```
content/
  tiers/          # starter | certified | vip (+ index demo map)
  tracks/         # bitcoin first drive (ready) · ethereum · usdt-networks · tron · solana (scaffolds)
```

## Environment

```bash
DEMO_LICENSE_KEY=CD-DRIVE-2026
NEXT_PUBLIC_GUMROAD_URL=https://gumroad.com/l/crypto-drive
NEXT_PUBLIC_APP_URL=http://127.0.0.1:43127
NEXT_PUBLIC_VIP_CALL_URL=https://calendly.com/
NEXT_PUBLIC_VIP_QA_URL=#
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port **43127** |
| `npm run build` | Production build |
| `npm start` | Production server on **43127** |
| `npm run lint` | ESLint |
| `node --test tests/` | Unit tests |
| `npm run test:e2e` | Playwright suite (build first; `test:e2e:ui` for interactive) |

## Loop

Ads (later) → Gumroad **tier** SKU → unlock → Bitcoin drive (6 drives, capstone cert) → one cert (Certified+) → share.
