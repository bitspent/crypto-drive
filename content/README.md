# Course content

Tier packages are the product. **Tracks** are the curriculum spine each tier unlocks.

- `tiers/` — Starter, Certified Practitioner, VIP (+ `index.json` demo license map)
- `tracks/` — Bitcoin (ready) → Ethereum / USDT+networks / Tron / Solana (coming-next scaffolds)

The Next.js app loads these JSON files via `src/lib/content.ts`. Do not hardcode lesson copy in page components.

**Charge bar:** only Bitcoin is built to teaching quality. Other tracks stay scaffold until they match.
