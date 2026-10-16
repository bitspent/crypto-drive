# Deploy to Vercel

Step-by-step from this repo to a live production deploy. Vercel is the
documented default host; the app is a standard Next.js project and will run
anywhere Next.js runs, but these steps assume Vercel.

## 0. Before you start

- The P0 rows in `docs/charge-ready-checklist.md` that are marked **code**
  are done; the rows marked **human** below are not — most of this doc is
  executing them.
- You need: a Vercel account, a Supabase project (pooler URL + password), a
  Gumroad account with three tier products, a Resend API key, and a domain.
- Launch target: `BITCOIN_MODE=simulated`. Regtest is an enterprise upgrade;
  nothing below requires the self-hosted infra except step 6, which is
  optional for launch.

## 1. Connect the repo

1. Push `main` (it should already be there — every prompt ships pushed).
2. Vercel → Add New → Project → Import `bitspent/crypto-drive`.
3. Framework preset: Next.js. Root directory: `./`. Build command and output
   directory: leave the defaults (`next build`).
4. Do **not** deploy yet — set environment variables first (step 2).

## 2. Set environment variables

Project Settings → Environment Variables. Set each for **Production** and
**Preview** unless noted. Never commit real values — `.env.example`
documents every variable with comments.

| Variable | Where from | Notes |
|---|---|---|
| `CERT_HASH_SECRET` | `openssl rand -hex 32` | Required: builds refuse to boot without it. Production and Preview can share or differ; Rotation invalidates practice seeds and cert hashes. |
| `DATABASE_URL` | Supabase → Connect → Transaction pooler (port 6543) | Required in production. Unset means the `.data/` file store — local dev only, data lost on redeploy. |
| `NEXT_PUBLIC_APP_URL` | Your domain, e.g. `https://crypto-drive.example.com` | Baked into the client at build time. Email links, legal contacts, canonicals. |
| `NEXT_PUBLIC_GUMROAD_URL` | Your Gumroad storefront link | Placeholder fallback is `gumroad.com/l/crypto-drive` — replace before launch. |
| `NEXT_PUBLIC_VIP_CALL_URL` | Scheduling link (e.g. Cal.com) | No fallback; VIP blocks hide when unset. |
| `NEXT_PUBLIC_VIP_QA_URL` | Private Q&A lane | No fallback; VIP blocks hide when unset. |
| `GUMROAD_WEBHOOK_SECRET` | Gumroad Settings → Advanced → Ping | Register the Ping URL as `https://<domain>/api/webhooks/gumroad?secret=<value>` (step 7). |
| `GUMROAD_PRODUCT_STARTER` | Gumroad product id | Env-only, never in git. |
| `GUMROAD_PRODUCT_CERTIFIED` | Gumroad product id | |
| `GUMROAD_PRODUCT_VIP` | Gumroad product id | |
| `GUMROAD_ACCESS_TOKEN` | Gumroad (optional) | Bearer for the license-verify fallback; the endpoint also answers unauthenticated. |
| `RESEND_API_KEY` | resend.com | Without it, sales still provision; the email step logs and continues. |
| `RESEND_FROM_EMAIL` | e.g. `Crypto Drive <hello@yourdomain.com>` | Must be a verified sender in Resend. |
| `BITCOIN_MODE` | `simulated` | Launch target. `signet` for live fees; `regtest` only with infra (step 6). |
| `INFRA_BASE_URL` | Your infra URL | Regtest only. |
| `INFRA_SHARED_SECRET` | `openssl rand -hex 32` | Regtest only. |
| `ADMIN_MINE_TOKEN` | `openssl rand -hex 32` | Regtest mining + the rate-limit admin bypass header. |

Do **not** set `ALLOW_DEMO_LICENSES` anywhere in Vercel. It exists only for
the Playwright harness. A stray Preview value would re-enable demo keys.

## 3. Configure the domain

1. Vercel → Settings → Domains → add your domain, point DNS at Vercel.
2. Set `NEXT_PUBLIC_APP_URL` to the apex domain (step 2) and redeploy —
   `NEXT_PUBLIC_*` values bake in at build time, so domain changes need a
   rebuild.
3. Confirm `https://<domain>/unlock` loads.

## 4. Confirm Supabase works from Vercel

After the first deploy, before anything else:

```bash
curl -s https://<domain>/api/health
# {"ok":true,"db":"postgres","bitcoin":"simulated"}
```

- `"db":"postgres"` — the pooler connection works from Vercel. Proceed.
- `"db":"file"` — `DATABASE_URL` is unset or empty in this environment.
  Fix it; never run production on the file store.
- `"db":"unreachable"` (HTTP 503) — the URL is set but wrong, the pooler
  is down, or the password rotated. Check the Supabase dashboard.

## 5. Set `CERT_HASH_SECRET` (if you skipped it)

`openssl rand -hex 32`, paste into Production + Preview, redeploy. The build
fails loudly without it, so you cannot deploy past this step by accident —
but confirm the value appears nowhere in the repo, logs, or screenshots.

## 6. Regtest reachability (optional for launch)

Only if you run the self-hosted infra (`docs/infra-contract.md`):

1. In a **Preview** deploy, set `BITCOIN_MODE=regtest` plus the three
   `INFRA_*` / `ADMIN_*` vars.
2. Unlock the preview, then:
   ```bash
   curl -s -X POST https://<preview>/api/wallet/regtest/fund \
     -H "Cookie: cd_session=<session>" -d '{"amountSats":500000}'
   ```
3. Expect a `txid`. If the wallet shows "Regtest infrastructure is
   offline", the app cannot reach `INFRA_BASE_URL` from Vercel — check the
   tunnel (Cloudflare Tunnel or Tailscale notes in
   `docs/deployment-modes.md`).
4. Leave Production on `simulated` until the Preview path is green twice.

## 7. Register the Gumroad webhook

1. Gumroad → Settings → Advanced → Ping → URL:
   `https://<domain>/api/webhooks/gumroad?secret=<GUMROAD_WEBHOOK_SECRET>`.
2. Send Gumroad's test ping. Then check the database:
   ```sql
   SELECT id, source, processed_at FROM webhook_events ORDER BY processed_at DESC LIMIT 1;
   ```
   One row per ping. No row → the URL or secret is wrong.
3. Buy your own Certified tier with a real card ($20). Confirm: 200 on the
   webhook, one `students` row with a populated `license_key`, one email in
   Resend, unlock with the emailed key works, progress and wallet persist.
4. Repeat for Starter and VIP. See the commerce rows in
   `docs/charge-ready-checklist.md` — the manual verification is a launch
   gate, not a suggestion.

## 8. Smoke test after the first deploy

1. Unlock (paid key after step 7, demo key only on Preview-with-override —
   never Production).
2. Walk one full step; confirm progress saves and survives a reload.
3. Receive a test webhook event (step 7) and confirm the student row.
4. Open `/terms`, `/privacy`, `/refund` on desktop and mobile widths.
5. Confirm `https://<domain>/api/health` still reports `postgres`.

## Rollback

Every deploy is a Vercel deployment: Instant Rollback in the dashboard
reverts code in one click. Data is never rolled back (Supabase is outside
Vercel) — migrations under `db/migrations/` are additive, so old code
keeps working against the current schema.
