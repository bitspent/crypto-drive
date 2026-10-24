# Charge-ready checklist

The final gate between the current state and taking payment. If it is not
in here, it is not a blocker. Bitcoin is content-complete (6 drives,
26 steps, capstone cert) and USDT is content-complete (3 drives, 10 steps,
capstone cert); everything below is commerce, hosting, data,
or policy — not curriculum.

Severity: **P0** = cannot charge without it. **P1** = needed before
strangers pay. **P2** = decided or scheduled before launch, not blocking
first charge.

## P0 — zero open. All closed.

| # | Item | Closed by | Evidence |
|---|---|---|---|
| 1 | Production hosting config | Prompt 6/6r | `vercel.json` (pinned region, og runtime, webhook `maxDuration`, legacy redirects), `docs/deploy-vercel.md`, `GET /api/health` probe |
| 2 | Durable persistence | Prompt 2 | Supabase Postgres via Drizzle; atomic merges; `23505` retry; idempotent migration; Supabase PITR for backup |
| 3 | Secrets (hash + pepper) | Prompts 2/3.5b | Builds refuse to boot without `CERT_HASH_SECRET`; license lookups fail closed without `LICENSE_PEPPER`; neither appears in the repo |
| 4 | Gumroad fulfillment | Prompts 3/3.5 | Sale webhook provisions idempotently; `CD-<TIER>-*` keys unlock via DB with Gumroad fallback; welcome emails via Resend |
| 5 | Refund/chargeback revocation | Prompt 3.5a | Refund/dispute/cancellation pings revoke students; revoked licenses 401; live sessions 403 and clear |
| 6 | License keys hashed at rest | Prompt 3.5b | `sha256(key + pepper)` only; raw column dropped (0005); idempotent backfill script, proven against live Postgres |
| 7 | Unlock form accepts paid keys | Form fix | Shared `unlockWithLicense` lib used by JSON route and form action alike; proven through the real form UI |
| 8 | Production demo hole | Prompt 6 | `isValidLicense` centrally rejects demo keys in real production (unit + live-form proven) |
| 9 | Rate limiting | Prompts 5/5r | Per-IP unlock/webhook, per-session progress/complete/wallet/faucet; 429 contract; full walk asserted to never 429 |
| 10 | Legal pages (code) | Prompts 4/4r | `/terms`, `/privacy`, `/refund` static + footer + consent line; 7-day window; key-hash copy; 14-day Secure cookie (counsel review: P1) |

**Final P0 count: 0.** What remains before charging is the human launch
sequence below plus P1/P2 items — no code blocks first charge.

## Launch sequence (human, in order)

1. Deploy to Vercel Preview (repo + env per `docs/deploy-vercel.md`).
2. Point the domain (DNS + TLS), redeploy for `NEXT_PUBLIC_*`.
3. Smoke test on Preview: unlock with a real key, walk one step.
4. Register the Gumroad webhook against the production URL.
5. Buy your own product (Certified, $20). Confirm end-to-end.
6. Refund it via the Gumroad dashboard. Confirm `revoked_at` + blocked unlock.
7. Repeat 5–6 for Starter and VIP. Then go live on Gumroad.

## P1 — needed before strangers pay

### VIP fulfillment path works end to end — open (human)
- **File/component:** `NEXT_PUBLIC_VIP_CALL_URL` / `NEXT_PUBLIC_VIP_QA_URL`
  (unset — the course page hides VIP blocks, no placeholder links ship)
- **Fix:** stand up real scheduling + the private Q&A lane; set both URLs
  in Vercel; define the fulfillment window
- **Acceptance:** a VIP purchase produces a bookable call link and an open
  Q&A lane within the promised window

### Legal pages reviewed by counsel — open (human)
- **File/component:** `/terms`, `/privacy`, `/refund`
  (`src/content/legal/*.ts`), `docs/legal-review-checklist.md`
- **Fix:** one hour of a lawyer's time ($300–500): jurisdiction, 7-day
  window + refund enforceability, cookie classification, GDPR DPAs,
  retention periods, marketing claims, certificate framing, under-18 gate
- **Acceptance:** reviewer and date recorded in the checklist;
  `LEGAL_UPDATED` bumped; legal e2e re-run green

### Gumroad product pages link the legal URLs — open (human)
- **File/component:** Gumroad dashboard (three product descriptions), not
  the repo
- **Fix:** add the public `/terms`, `/privacy`, `/refund` URLs to each
  tier listing
- **Acceptance:** a buyer can read all three before paying

### License-verify request shape — resolved 2026-10-25 by live probe
- **File/component:** license verification sends form-encoded `product_id`
- **Evidence:** `POST api.gumroad.com/v2/licenses/verify` with a bogus key
  returns `{"success":false,"message":"That license does not exist..."}` —
  the endpoint, method, and field shape are correct as implemented
- **Fallback (only if needed):** if unlocks fail with "License not
  recognized" on keys Gumroad just issued, switch to `product_permalink`
  (one line); re-confirm during launch step 5

### State of the Union §15 open decisions enumerated — open (human)
- **File/component:** pointer only — no "Section 15" exists in this repo
  or in the circulated review text
- **Fix:** the review author pastes the §15 decision list here, or
  corrects the pointer to wherever it lives
- **Acceptance:** every §15 item is either a row in this doc or explicitly
  dropped with a reason

## P2 — decided or scheduled, not blocking first charge

### WCAG target: 2.2 AA on the learner path — target declared, audit open
- Keyboard nav, reduced-motion pinning, 44px targets, and live-region
  announcements already ship and are e2e-covered
- **Fix:** schedule the audit; log gaps as P1s when found

### Visual source of truth — wallet done, drives open
- `docs/visuals/wallet/` (72 screenshots, dark + light, mobile + desktop);
  no per-drive pack or Figma link yet

### Error + usage monitoring — open
- No Sentry/PostHog/analytics dependency: pick one error tracker and one
  funnel counter; instrument unlock → capstone → cert

### Webhook crash window (record → provision) — open, P2
- **File/component:** `processGumroadSale` (`src/lib/gumroad-webhook.ts`):
  the sale event is recorded *before* the student is provisioned. A crash
  in between makes the retry ack as a quiet duplicate with no account.
- **Fix:** derive the license key deterministically from `sale_id` (HMAC)
  so retries converge, or record the event pending → done. Do not reorder
  naively: re-provisioning mints a *new* random key and invalidates the
  emailed one.
- **Acceptance:** kill -9 between record and provision, re-deliver, buyer
  ends up provisioned exactly once

### Failed welcome email has no self-serve recovery — open, P2
- **File/component:** `sendLicenseEmail` failure path: the student is
  provisioned but the buyer never gets the key, and unlock needs the key.
- **Fix (needs product decision):** support-resend flow (admin endpoint or
  unlock-by-email + Gumroad receipt check)
- **Acceptance:** a buyer whose email bounced can recover the key without
  engineering intervention

## Done — kept here so the gate stays complete

- **E2E harness** (`playwright.config.ts`, `tests/e2e/`): 46 chromium +
  43 mobile + 1 regtest green — full 26-step BTC walk, 10-step USDT walk,
  layout, keyboard, reduced-motion, no-WebGL, wallet flows, legal, health,
  modes. Never run two suites concurrently: they share `.data/store.json`
  and cross-talk flakes results.
- **Unit suite** (`node --test --test-concurrency=1 tests/`, serial, 218
  green): practice, content (BTC + USDT), tiers, redirects, secrets,
  wallet, providers (Bitcoin + ETH), commerce, revocation, hashing,
  unlock, legal, limits, health, container health, status.sh.
- **External liveness** (probed 2026-10-25): bitcoin.org, mempool.space +
  pizza tx + signet fees, blockstream signet, Gumroad license API all
  answer; `NEXT_PUBLIC_GUMROAD_URL` default 404s until the real product
  ships (expected, launch step 7).
- **Track C (USDT)**: 3 drives, 10 steps, `network-pick` drill,
  per-track cert; wallet stays BTC-only.
- **EthProvider spike**: simulated / sepolia / local (Anvil) backends +
  infra `/api/eth/*`; status reads only, no ETH wallet.
- **Tier flags trimmed** to the three the runtime enforces.
- **Wallet sandbox ships fully simulated** (`/wallet`) with play-money
  disclosure throughout; regtest fund/mine live behind `BITCOIN_MODE`.
- **BitcoinProvider**: simulated (launch target), signet, regtest; local
  regtest dev via Nigiri + `api/` infra service (`npm run dev:regtest`).
- **Commerce**: webhook provisioning, license verification, Resend emails,
  revocation on refund/dispute/cancel, hashed keys, shared unlock lib.
- **Legal**: terms, privacy, refund + footer + consent (counsel: P1).
- **Rate limiting**: unlock, progress, complete, webhook, wallet, faucet.
- **Deploy wiring**: `vercel.json`, complete `.env.example`,
  `docs/deploy-vercel.md`, `/api/health`.
