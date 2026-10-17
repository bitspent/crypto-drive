# Deploy to Vercel

Step-by-step from this repo to a live production deploy. The app is a
standard Next.js project; these steps assume Vercel.

## Prerequisites

- Vercel Pro account (Hobby forbids commercial use)
- Supabase project created
- Gumroad products created (3 tiers)
- Resend account + verified sending domain
- Domain DNS access

## Steps

1. **Create the Supabase project, run migrations, get the pooler string.**
   Apply `db/migrations/*.sql` in order against the new database (Supabase
   SQL editor or psql). If the database already holds raw `license_key`
   values (pre-3.5b staging data), run `scripts/hash-licenses.mjs` between
   0004 and 0005 — see the 0004 header. Fresh databases apply all files
   together. Copy the transaction pooler connection string (port 6543).

2. **Connect the GitHub repo to Vercel.** Import `bitspent/crypto-drive`,
   framework Next.js, root `./`, defaults for build/output. Do not deploy
   yet.

3. **Set every env var** in Project Settings → Environment Variables
   (Production + Preview; never in git). The full list with comments is
   `.env.example`: `CERT_HASH_SECRET` (`openssl rand -hex 32`),
   `LICENSE_PEPPER` (`openssl rand -hex 32`), `DATABASE_URL` (step 1),
   `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GUMROAD_URL`, `NEXT_PUBLIC_VIP_*`
   (when fulfillment exists), `GUMROAD_*` (5), `RESEND_*` (2),
   `BITCOIN_MODE=simulated`. Do **not** set `ALLOW_DEMO_LICENSES`
   anywhere — it re-enables demo keys.

4. **Set the custom domain; wait for DNS + TLS.** Then redeploy:
   `NEXT_PUBLIC_*` values bake in at build time.

5. **Run first migration against the production DB** (if step 1 targeted a
   staging database): same files, same order, same 0004/0005 caution.

6. **Deploy.** The build fails loudly without `CERT_HASH_SECRET`, so a
   misconfigured deploy cannot slip through silently.

7. **Smoke test: `/unlock` with a real license key.** Walk one step,
   confirm progress saves and survives a reload. Open `/terms`, `/privacy`,
   `/refund` on desktop and mobile widths.

8. **Register the Gumroad webhook URL:**
   `https://<domain>/api/webhooks/gumroad?secret=<GUMROAD_WEBHOOK_SECRET>`
   (Gumroad → Settings → Advanced → Ping).

9. **Send a Gumroad test ping; confirm 200 in Vercel logs**, then check the
   database: one row in `webhook_events` per ping. No row → the URL or
   secret is wrong.

10. **Buy your own product; confirm end-to-end.** Certified tier ($20):
    webhook 200 → `students` row with a populated `license_key_hash` →
    Resend email → unlock with the emailed key through the form → progress
    and wallet persist. Repeat for Starter and VIP. Then refund it via the
    Gumroad dashboard and confirm the student row shows `revoked_at` and
    unlock is refused.

## Rollback

- Vercel → Deployments → previous → Promote.
- DB migrations are forward-only; roll back the app first, then the DB
  manually if the schema changed. Migrations in this repo are additive
  (0005 drops a column the new code no longer reads), so old code keeps
  working against the current schema in every case so far.

## Health checks

- `GET /api/health` → `{"ok":true,"db":"postgres","bitcoin":"simulated"}`.
  `"db":"file"` means `DATABASE_URL` is unset; `"db":"unreachable"` (503)
  means the pooler URL, password, or network is wrong.
- Put an uptime monitor on `/unlock` (200, no session needed).
- After any regtest infra change (enterprise path, Preview only):
  unlock the preview and fund the wallet; expect a txid, not the offline
  message. Leave Production on `simulated`.
