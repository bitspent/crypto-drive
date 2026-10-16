# Charge-ready checklist

The final gate between the current state and taking payment. If it is not
in here, it is not a blocker. Bitcoin is content-complete (6 drives,
24 steps, capstone cert); everything below is commerce, hosting, data,
or policy — not curriculum.

Severity: **P0** = cannot charge without it. **P1** = needed before
strangers pay. **P2** = decided or scheduled before launch, not blocking
first charge.

Status: **done (code)** = shipped and tested. **open (human)** = needs a
person with keys, a card, or a calendar — no agent can close it.

## P0 — cannot charge without these

### 1. Production hosting + URL decided and live — open (human)
- **File/component:** `vercel.json`, `docs/deploy-vercel.md` (both ship in
  Prompt 6); no Vercel project or domain exists yet
- **Fix:** follow `docs/deploy-vercel.md` steps 1–5: import the repo, set
  every env var, attach the domain, confirm `/api/health` reports postgres
- **Acceptance:** the app loads on the public URL; `/unlock`, one full
  Certified walk, and `/verify/[id]` all work there

### 2. Gumroad commerce verified end to end — code done, verification open (human)
- **File/component:** `src/app/api/webhooks/gumroad/route.ts`,
  `src/app/api/unlock/route.ts`, `src/lib/email.ts` (all shipped, Prompt 3);
  three Gumroad products; Resend sender identity
- **Fix:** create the three tier products mirroring `content/tiers/`;
  register the Ping URL; run the manual verification in
  `docs/deploy-vercel.md` step 7 (test ping → $20 self-purchase on
  Certified → repeat for Starter and VIP)
- **Acceptance:** a real purchase delivers a working license by email with
  no manual step; unlock with the emailed key works; progress and wallet
  persist across sessions
- **Open question the purchase resolves:** the license-verify call sends
  `product_id`; if unlocks fail with "License not recognized" on keys
  Gumroad just issued, the API wants `product_permalink` instead (one-line
  fix in `src/lib/gumroad.ts`)

### 3. Unlock form accepts paid keys — open (code, P0 follow-up)
- **File/component:** `src/app/unlock/actions.ts` validates via
  `isValidLicense`, which only knows demo keys — a `CD-CERTIFIED-*` key
  from a real purchase fails the form. Only the JSON route
  (`POST /api/unlock`) handles paid keys, and no UI calls it
- **Fix:** extract the licensed-key path (DB lookup → Gumroad fallback →
  provision → session) into a shared lib used by both the route and the
  action; e2e-prove a paid-key unlock through the form in dev
- **Acceptance:** the emailed key from item 2 unlocks through the form UI,
  not just via curl; must land **before** the $20 purchase, which would
  otherwise fail at the form

### 4. Durable persistence — done (code)
- **File/component:** `src/lib/store.ts` (Drizzle internals, same 14
  exports), `db/migrations/`, `src/lib/db/`
- **Done in:** Prompt 2 — Supabase Postgres via Drizzle; atomic `jsonb ||`
  progress merges; `23505` retry on concurrent unlock; idempotent
  file→DB migration script, verified against a live database
- **Acceptance:** progress and certs survive a redeploy; concurrent
  unlocks can't clobber (unit-proven); Supabase PITR covers backup

### 5. `CERT_HASH_SECRET` set in the deploy environment — open (human)
- **File/component:** Vercel Project Settings (Production + Preview)
- **Fix:** `openssl rand -hex 32`, paste, redeploy. Builds already refuse
  to boot without it, so this cannot be skipped by accident
- **Acceptance:** production boots with the secret set; the value appears
  nowhere in the repo, logs, or screenshots

## P1 — needed before strangers pay

### 6. VIP fulfillment path works end to end — open (human)
- **File/component:** `NEXT_PUBLIC_VIP_CALL_URL` / `NEXT_PUBLIC_VIP_QA_URL`
  (unset — the course page hides VIP blocks, no placeholder links ship)
- **Fix:** stand up real scheduling + the private Q&A lane; set both URLs
  in Vercel; define the fulfillment window
- **Acceptance:** a VIP purchase produces a bookable call link and an open
  Q&A lane within the promised window

### 7. Legal pages reviewed by counsel — code done, review open (human)
- **File/component:** `/terms`, `/privacy`, `/refund`
  (`src/content/legal/*.ts`), shared footer, `docs/legal-review-checklist.md`
- **Done in:** Prompt 4 — full draft copy, consent line on unlock, lawyer
  checklist with ten confirm items and contact routing
- **Fix:** one hour of a lawyer's time ($300–500): jurisdiction, refund
  enforceability, cookie classification, `Secure` flag + `SameSite`
  sufficiency, GDPR DPAs, retention periods, marketing claims, certificate
  framing, under-18 gate
- **Acceptance:** reviewer and date recorded in the checklist; `LEGAL_UPDATED`
  bumped; legal e2e re-run green

### 8. Rate limiting on unlock + progress + cert APIs — done (code)
- **File/component:** `src/lib/rate-limit.ts` (lru-cache, fixed windows),
  wired into unlock route + unlock action, progress, complete, webhook
- **Done in:** Prompt 5 — 10/5min unlock, 60/5min progress, 3/hr complete,
  100/min webhook; 429 + `Retry-After` contract; demo-key and admin-token
  exemptions; full walk e2e-asserted to never 429

### 9. Gumroad product pages link the legal URLs — open (human)
- **File/component:** Gumroad dashboard (three product descriptions), not
  the repo
- **Fix:** add the public `/terms`, `/privacy`, `/refund` URLs to each
  tier listing
- **Acceptance:** a buyer can read all three before paying

### 10. State of the Union §15 open decisions enumerated — open (human)
- **File/component:** pointer only — no "Section 15" exists in this repo
  or in the circulated review text
- **Fix:** the review author pastes the §15 decision list here, or
  corrects the pointer to wherever it lives
- **Acceptance:** every §15 item is either a row in this doc or explicitly
  dropped with a reason

## P2 — decided or scheduled, not blocking first charge

### 11. WCAG target: 2.2 AA on the learner path — target declared, audit open
- **File/component:** whole frontend (`src/app/`, `src/components/`)
- **Target (declared here):** WCAG 2.2 AA on unlock → drives → wallet →
  cert → verify. Keyboard nav, reduced-motion pinning, 44px targets, and
  live-region announcements already ship and are e2e-covered
- **Fix:** schedule the audit; log gaps as P1s when found
- **Acceptance:** audit dated; known gaps listed, not blocking

### 12. Visual source of truth — wallet done, drives open
- **File/component:** `docs/visuals/wallet/` (72 screenshots, dark + light,
  mobile + desktop — committed); no per-drive pack or Figma link yet
- **Fix:** commit a screenshot pack per drive (both themes) under
  `docs/visuals/`, or link the canonical Figma file from the README
- **Acceptance:** a designer can review any shipped screen against the
  source of truth without running the app

### 13. Error + usage monitoring — open
- **File/component:** none — no Sentry/PostHog/analytics dependency exists
  in `src/`
- **Fix:** pick one error tracker and one funnel counter; instrument
  unlock → capstone → cert
- **Acceptance:** a failed cert issue pages someone; weekly funnel numbers
  exist

## Done — kept here so the gate stays complete

- **E2E harness committed** (`playwright.config.ts`, `tests/e2e/`):
  full 24-step walk on desktop + mobile, layout contract, keyboard,
  reduced-motion, no-WebGL, wallet flows, legal pages, health. 66 specs,
  green in file and Postgres modes.
- **Unit suite committed** (`node --test tests/`): practice determinism +
  grading, content shape, tier flags, redirects, secret gate, wallet math,
  providers, commerce, legal content, rate limits, health, demo gate.
- **Tier flags trimmed** to the three the runtime enforces (`certificate`,
  `verifyLink`, `liveCall`).
- **Production secret gate**: builds and servers refuse to boot without
  `CERT_HASH_SECRET`.
- **Wallet sandbox ships fully simulated** (`/wallet`): deterministic
  practice-seed balances, txids, and confirmations; no chain calls, no
  private-key handling, play-money disclosure on every screen.
- **BitcoinProvider abstraction**: simulated (launch target), signet, and
  regtest backends behind one interface; regtest routes 404 unless enabled.
- **Gumroad webhook + license verification + Resend**: sale pings
  provision students idempotently; `CD-<TIER>-*` keys unlock via DB with
  Gumroad-API fallback; welcome emails carry the key and unlock link.
- **Legal pages**: terms, privacy, refund as static routes with a shared
  footer and unlock consent line (counsel review still open, item 7).
- **Rate limiting**: unlock, progress, complete, and webhook capped with a
  documented Redis migration path.
- **Deploy wiring**: `vercel.json` (og runtime, legacy module redirects),
  complete `.env.example` (every variable the code reads),
  `docs/deploy-vercel.md`, `GET /api/health` deploy probe.
- **Production demo hole closed**: `isValidLicense` centrally rejects
  demo keys in real production (unit-proven); previously the form action
  would have minted certified sessions for the public demo key.
