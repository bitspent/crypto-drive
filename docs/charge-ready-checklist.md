# Charge-ready checklist

The final gate between the current state and taking payment. If it is not
in here, it is not a blocker. Bitcoin is content-complete (6 drives,
24 steps, capstone cert); everything below is commerce, hosting, data,
or policy — not curriculum.

Severity: **P0** = cannot charge without it. **P1** = needed before
strangers pay. **P2** = decided or scheduled before launch, not blocking
first charge.

## P0 — cannot charge without these

### 1. Production hosting + URL decided and live
- **File/component:** repo-wide (deploy target); `NEXT_PUBLIC_APP_URL` in README env block
- **Fix:** pick the host (Vercel is the documented default) and the domain, deploy `main`, point DNS
- **Acceptance:** the app loads on the public URL; `/unlock`, one full Certified walk, and `/verify/[id]` all work there

### 2. Gumroad products exist and fulfill licenses
- **File/component:** `src/app/unlock/page.tsx`, `src/app/page.tsx`, `src/components/site-header.tsx` (all hardcode the placeholder `https://gumroad.com/l/crypto-drive`); no webhook route exists under `src/app/api/`
- **Fix:** create the three tier products on Gumroad mirroring `content/tiers/`; add a sale-webhook route that creates student records; verify keys via the Gumroad License API instead of demo keys
- **Acceptance:** a real purchase delivers a working license by email with no manual step; demo keys still work for review

### 3. Durable persistence (file store → managed DB)
- **File/component:** `src/lib/store.ts` (`DATA_DIR` → `.data/store.json`, read-modify-write, single instance)
- **Fix:** move students, sessions, and certificates to Supabase (or equivalent); keep the `store.ts` function signatures so routes don't change
- **Acceptance:** progress and certs survive a redeploy; two concurrent unlocks can't clobber each other; backup/restore documented

### 4. `CERT_HASH_SECRET` rotated in the deploy environment
- **File/component:** `.env.example`; deploy env vars (Vercel project settings or equivalent)
- **Fix:** generate with `openssl rand -hex 32`, set it in the deploy environment only — never commit it. Builds already refuse to boot without it
- **Acceptance:** production boots with the secret set; the value appears nowhere in the repo, logs, or screenshots

## P1 — needed before strangers pay

### 5. VIP fulfillment path works end to end
- **File/component:** `NEXT_PUBLIC_VIP_CALL_URL` / `NEXT_PUBLIC_VIP_QA_URL` (currently `https://calendly.com/` and `#`); VIP `support` block in `content/tiers/vip.json`
- **Fix:** stand up real scheduling + the private Q&A lane; wire the env URLs; define the fulfillment window
- **Acceptance:** a VIP purchase produces a bookable call link and an open Q&A lane within the promised window

### 6. Refund / terms / privacy pages exist
- **File/component:** none — no legal pages exist in `src/app/`
- **Fix:** publish terms, refund policy, and privacy notice; link them from unlock and the Gumroad products
- **Acceptance:** a buyer can read all three before paying; refund path is one email, no account needed

### 7. Rate limiting on unlock + progress + cert APIs
- **File/component:** `src/app/api/unlock/route.ts`, `src/app/api/progress/route.ts`, `src/app/api/complete/route.ts` (no limiting anywhere in `src/`)
- **Fix:** add per-IP rate limits (and per-account progress caps) appropriate for a paid product
- **Acceptance:** brute-forcing licenses and spamming progress writes is impractical; legitimate walks never trip the limits (covered by e2e)

### 8. State of the Union §15 open decisions enumerated
- **File/component:** pointer only — no "Section 15" exists in this repo or in the circulated review text
- **Fix:** the review author pastes the §15 decision list here, or corrects the pointer to wherever it lives
- **Acceptance:** every §15 item is either a row in this doc or explicitly dropped with a reason

## P2 — decided or scheduled, not blocking first charge

### 9. WCAG target decision
- **File/component:** whole frontend (`src/app/`, `src/components/`)
- **Fix:** declare the target (e.g. WCAG 2.2 AA on the learner path) and schedule the audit; keyboard + reduced-motion foundations already ship and are e2e-covered
- **Acceptance:** target written here; audit dated; known gaps listed, not blocking

### 10. Visual source of truth committed
- **File/component:** none — no screenshot pack or Figma link lives in the repo
- **Fix:** commit a screenshot pack per drive (both themes) under `docs/visuals/`, or link the canonical Figma file from the README
- **Acceptance:** a designer can review any shipped screen against the source of truth without running the app

### 11. Error + usage monitoring
- **File/component:** none — no Sentry/PostHog/analytics dependency exists in `src/`
- **Fix:** pick one error tracker and one funnel counter; instrument unlock → capstone → cert
- **Acceptance:** a failed cert issue pages someone; weekly funnel numbers exist

## Done — kept here so the gate stays complete

- **E2E harness committed** (`playwright.config.ts`, `tests/e2e/`, `npm run test:e2e`): full 24-step walk on desktop + mobile, layout contract, keyboard, reduced-motion, no-WebGL. Run: `npm run build`, then `npx playwright test`.
- **Unit suite committed** (`node --test tests/`): practice determinism + grading, content shape, tier flags, redirects, secret gate.
- **Tier flags trimmed** to the three the runtime enforces (`certificate`, `verifyLink`, `liveCall`).
- **Production secret gate**: builds and servers refuse to boot without `CERT_HASH_SECRET`.
- **Wallet sandbox ships fully simulated** (`/wallet`): deterministic practice-seed balances, txids, and confirmations; no chain calls, no private-key handling, play-money disclosure on every screen. No new P0/P1 — covered by the same hosting, persistence, and secret items above.
