# Deployment modes — which Bitcoin backend the app talks to

`BITCOIN_MODE` (default `simulated`) selects the `BitcoinProvider`
implementation (`src/lib/bitcoin/`). Route handlers program to the interface;
only genuinely different behavior (local sim ticks vs. remote polling)
branches on `provider.network`.

## simulated (launch target)

- Everything is deterministic play money from the practice seed: `bc1q…`
  addresses, fixed 500k-sat deposits, local 0/3→3/3 ticks, static fee tiers
  (1/5/15 sat/vB).
- No network calls, no secrets beyond the app's own. Works offline.
- Use for: public launch, all learner traffic, all e2e.
- `/api/wallet/regtest/*` returns 404 in this mode.

## signet (live look, simulated transfers)

- Live fee rates from mempool.space/signet (60s cache, blockstream.info
  fallback) mapped onto the same three fee tiers; live tx lookups via
  `getTxStatus`.
- Addresses use HRP `tb`. Funding/mining throw `not supported`: deposits and
  ticks stay simulated because the app has no signet faucet.
- Needs: outbound HTTPS to mempool.space + blockstream.info. No secrets.
- Use for: demos that show real fee markets without running infra.

## regtest (enterprise upgrade)

- Wallet addresses use HRP `bcrt`. Deposits fund the real address from the
  infra faucet (`POST /api/address/fund`); ticks poll real confirmations
  (`GET /api/tx/:txid`); `/api/wallet/regtest/mine` mines blocks so txs
  confirm; fees come from `GET /api/fees`. Sends stay recorded-never-broadcast
  in every mode — the app holds no keys.
- Needs: `INFRA_BASE_URL`, `INFRA_SHARED_SECRET`, `ADMIN_MINE_TOKEN` (see
  `.env.example`) and the stack from `docs/infra-contract.md`.
- Infra unreachable (or env missing) → the wallet shows "Regtest
  infrastructure is offline. Try again in a moment." Every failure is logged
  as structured JSON (`infra.request.*`). Nothing crashes.
- Use for: enterprise cohorts where each learner drives a real (valueless)
  chain.

## Reaching the infra from Vercel

The regtest stack is self-hosted; Vercel only needs outbound HTTPS to
`INFRA_BASE_URL`. Two supported ways to expose it:

- **Cloudflare Tunnel**: `cloudflared` on the infra host publishes
  `https://<your-url>`; no inbound firewall rules. Set that URL as
  `INFRA_BASE_URL`. Recommended for production previews.
- **Tailscale**: run the infra host on your tailnet and use its MagicDNS name.
  Works for team/enterprise use; requires every operator (not Vercel) to be
  on the tailnet — Vercel itself cannot join, so prefer the tunnel when the
  app must reach the infra from hosted Preview/Production deploys.

Verify from a Preview deploy with `BITCOIN_MODE=regtest`: unlock, create a
wallet (expect a `bcrt1…` address), open Receive, and confirm a faucet tx
appears pending; mine 3+ blocks and confirm it confirms.
