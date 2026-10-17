# Infra contract — self-hosted Bitcoin regtest

The app calls this contract via `INFRA_BASE_URL`. All routes are HTTPS on port 443.
Auth: `Authorization: Bearer <INFRA_SHARED_SECRET>` on every request.
Rate limit: 60 req/min per IP (Caddy). 429 on exceed.

## GET /api/health

Response 200: `{ ok: true, bitcoind_ready: bool, electrs_ready: bool, wallet_ready: bool, faucet_balance: number }` (`wallet_ready` = faucet wallet loaded; fund+mine 503 without it)

## POST /api/address/fund

Body: `{ address: string (bcrt1...), amountSats: number (max 1000000) }`

Response 200: `{ txid: string (64 hex) }`

Response 400: `{ error: "invalid address" | "amount out of range" }`

Response 503: `{ error: "faucet empty" }`

## GET /api/tx/:txid

Response 200: `{ confirmed: bool, confirmations: number, blockHeight: number | null }`

Response 404: `{ error: "tx not found" }`

## POST /api/mine

Body: `{ blocks: number (1-10, default 1) }`

Header: `X-Admin-Token: <ADMIN_MINE_TOKEN>`

Response 200: `{ height: number }`

Response 403: `{ error: "forbidden" }`

## GET /api/fees

Response 200: `{ fastest: number, halfHour: number, hour: number, economy: number, minimum: number }`
