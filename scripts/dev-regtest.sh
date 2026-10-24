#!/usr/bin/env bash
set -euo pipefail

# 1. Check Nigiri is running
if ! command -v nigiri >/dev/null 2>&1; then
  echo "Nigiri not installed."
  echo "Install: curl https://getnigiri.vulpem.com | bash"
  echo "Then:    nigiri start"
  exit 1
fi

# No `nigiri status` in 0.5.x: probe bitcoind's RPC port instead — it is the
# dependency that actually matters, and it answers 401/405 even unauthenticated.
if ! curl -s -o /dev/null --max-time 3 http://localhost:18443/; then
  echo "Nigiri's bitcoind is not reachable on localhost:18443."
  echo "Start it: nigiri start"
  exit 1
fi

# 2. Check infra-api is up AND ready: a bare 200 lies (/api/health always
# 200s and puts readiness in the flags), so require bitcoind + faucet wallet.
READY=$(curl -s -H "Authorization: Bearer dev" --max-time 3 \
  http://localhost:8081/api/health 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.bitcoind_ready===true&&j.wallet_ready===true?'yes':'no')}catch{console.log('no')}})") || true

if [ "$READY" != "yes" ]; then
  echo "infra-api not ready at http://localhost:8081 (need bitcoind + faucet wallet)"
  echo "Start it: docker compose -f docker-compose.infra-api.yml up -d"
  exit 1
fi

# 3. Run Next.js in regtest mode
export BITCOIN_MODE=regtest
export INFRA_BASE_URL=http://localhost:8081
export INFRA_SHARED_SECRET=dev
export ADMIN_MINE_TOKEN=dev

exec next dev --port 43127
