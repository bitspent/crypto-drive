# Infra contract — self-hosted Bitcoin regtest

The app calls this contract via `INFRA_BASE_URL`. All routes are HTTPS on port 443.
Auth: `Authorization: Bearer <INFRA_SHARED_SECRET>` on every request.
Rate limit: 60 req/min per IP (Caddy). 429 on exceed.

## Environment (infra-api service)

| Var | Required | Notes |
| --- | --- | --- |
| `INFRA_SHARED_SECRET` | yes | Bearer auth on every route. `openssl rand -hex 32`. |
| `ADMIN_MINE_TOKEN` | yes | `X-Admin-Token` for mine routes. `openssl rand -hex 32`. |
| `BITCOIN_RPC_URL` / `_USER` / `_PASSWORD` | yes | bitcoind RPC (Nigiri dev: `http://host.docker.internal:18443`, `admin1` / `123`). |
| `ELECTRS_HTTP_URL` | yes | electrs HTTP (Nigiri dev: `http://host.docker.internal:30000`). |
| `ESPLORA_URL` | no | Esplora for fee estimates; unset = nominal 1 sat/vB everywhere. |
| `ANVIL_RPC_URL` | no | Anvil devnet; unset = `/api/eth/*` 503. Compose sets `http://anvil:8545`. |
| `PORT` | no | Default `8081`. |

Dev values live in `docker-compose.infra-api.yml` (secret `dev`, plain HTTP).
Production wraps the same service in Caddy + TLS with fresh secrets.

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

## ETH appendix — Anvil local devnet (spike)

Same service, same Bearer auth. All `/api/eth/*` routes 503 with
`{ error: "eth devnet not configured" }` when `ANVIL_RPC_URL` is unset
(BTC-only deploys never set it). Amounts are decimal wei strings; fees in
gwei. Anvil chain 31337, worthless coins.

## GET /api/eth/status

Response 200: `{ ok: true, chainId: number, blockNumber: number, gasPriceGwei: number }`

Response 503: `{ error: "eth devnet unreachable" }`

## POST /api/eth/address/fund

Anvil-native faucet (`anvil_setBalance`): no signing, no txid exists.

Body: `{ address: string (0x + 40 hex), amountWei: string (decimal, max 10 ETH) }`

Response 200: `{ balanceWei: string }`

Response 400: `{ error: "invalid address" | "amount out of range" }`

Response 503: `{ error: "faucet failed" }`

## GET /api/eth/tx/:hash

Response 200: `{ confirmed: bool, confirmations: number, blockNumber: number | null }`

Response 404: `{ error: "tx not found" }`

## POST /api/eth/mine

Body: `{ blocks: number (1-10, default 1) }`

Header: `X-Admin-Token: <ADMIN_MINE_TOKEN>`

Response 200: `{ height: number }`

Response 403: `{ error: "forbidden" }`

## GET /api/eth/fees

`eth_feeHistory` percentiles mapped to tiers; `eth_gasPrice` backstop.

Response 200: `{ slow: number, standard: number, fast: number }`

Response 503: `{ error: "fees unavailable" }`
