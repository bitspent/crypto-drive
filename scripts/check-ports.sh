#!/usr/bin/env bash
# Preflight: verify every port our stack needs is free — or already held by
# OUR OWN services — before booting. Never kills anything; reports the
# occupant (PID/command or container) and the exact fix instead.
#
# Usage: bash scripts/check-ports.sh [app|regtest|db|all]   (default: all)
#   app      43127 ($APP_PORT) — plain `npm run dev`
#   regtest  app + infra-api + Nigiri ports — `npm run dev:regtest`
#   db       5433 — local Postgres for pg dev/e2e
# Exit 0 when everything needed is free-or-ours, 1 on any hard conflict.
set -uo pipefail

MODE="${1:-all}"
APP_PORT="${APP_PORT:-43127}"
INFRA_PORT="${INFRA_PORT:-8081}"
PG_PORT="${PG_PORT:-5433}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

have() { command -v "$1" >/dev/null 2>&1; }

# Fail closed: without a probe every port reads FREE and the diagnosis lies.
if ! have lsof && ! have ss; then
  echo "cannot probe listeners: install lsof (macOS) or iproute2/ss (Linux)" >&2
  exit 1
fi

# Portable listener lookup: prints "PID|COMMAND" per listener, empty when free.
listeners() {
  local port=$1
  if have lsof; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
      echo "$pid|$(ps -o command= -p "$pid" 2>/dev/null | head -c 80)"
    done
  elif have ss; then
    ss -ltn "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 |
      while read -r pid; do
        echo "$pid|$(ps -o comm= -p "$pid" 2>/dev/null)"
      done
  else
    echo "no-probe|lsof and ss both missing" >&2
    return 1
  fi
}

# Is this listener one of OUR containers? Prints container name or nothing.
# Compose names derive from the checkout directory, so our own services match
# by compose service label — hardcoded names miss a renamed checkout.
our_container_on() {
  local port=$1
  have docker || return 1
  docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Label "com.docker.compose.service"}}' 2>/dev/null |
    while read -r line; do
      # Real docker prints name\tports\tlabel; space-separated legacy
      # lines parse too. Split accordingly.
      case "$line" in
        *$'\t'*)
          name="${line%%$'\t'*}"
          mid="${line#*$'\t'}"
          ports="${mid%$'\t'*}"
          svc="${line##*$'\t'}" ;;
        *)
          name="${line%% *}"
          ports="${line#* }"
          svc="" ;;
      esac
      # Match single ports (:8081->, :8081,) and range ends (:18443-, -18444->).
      case "$ports" in
        *":$port->"*|*":$port,"*|*":$port-"*|*"-$port->"*)
          case "$name" in
            bitcoin|electrs|electrum-ws|chopsticks|esplora|crypto-drive-pg|crypto-drive-infra-api-1|crypto-drive-esplora-ui-1)
              echo "$name" ;;
          esac
          case "$svc" in
            infra-api|esplora-ui) echo "$name" ;;
          esac ;;
      esac
    done
}

FAIL=0
WARN=0
line() { printf '  %-6s %-28s %s\n' "$1" "$2" "$3"; }

# check <port> <owner-label> <hard|soft> [hint]
check() {
  local port=$1 label=$2 severity=$3 hint=${4:-}
  local found
  found=$(listeners "$port")
  if [ -z "$found" ]; then
    line "FREE" ":$port ($label)" "will boot clean"
    return 0
  fi
  local ours
  ours=$(our_container_on "$port" | head -1)
  if [ -n "$ours" ]; then
    line "OURS" ":$port ($label)" "container $ours already up"
    return 0
  fi
  local who pid cwd
  who=$(echo "$found" | head -1 | tr '|' ' ')
  # Own-app holder? A listener whose cwd is this repo is our previous boot,
  # not a foreign squatter — say so so the operator stops the right thing.
  pid=$(echo "$found" | head -1 | cut -d'|' -f1)
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  if [ -n "$cwd" ] && [ "$cwd" = "$REPO" ]; then
    hint="our own previous boot (cwd is this repo) — stop it, then boot"
  fi
  if [ "$severity" = "soft" ]; then
    WARN=1
    line "WARN" ":$port ($label)" "held by $who — $hint"
  else
    FAIL=1
    line "BUSY" ":$port ($label)" "held by $who — $hint"
  fi
}

echo "Ports for mode: $MODE"
case "$MODE" in
  app) check "$APP_PORT" "app" hard "stop it or pick another port" ;;
  db) check "$PG_PORT" "crypto-drive-pg" hard "stop it or remap -p" ;;
  regtest | all)
    check "$APP_PORT" "app" hard "stop it or pick another port"
    check "$INFRA_PORT" "infra-api" hard "docker compose -f docker-compose.infra-api.yml down, or find the squatter"
    check 18443 "bitcoind RPC" hard "another bitcoind/Nigiri? 'nigiri stop' if ours"
    check 18444 "bitcoind P2P" hard "another bitcoind/Nigiri? 'nigiri stop' if ours"
    check 30000 "electrs HTTP" hard "another electrs? 'nigiri stop' if ours"
    check 50000 "electrs P2P" hard "another electrs? 'nigiri stop' if ours"
    check 50003 "electrum-ws" hard "another electrum-ws? 'nigiri stop' if ours"
    check 3000 "chopsticks" soft "only chopsticks fails; nothing in our path uses it"
    check "${ESPLORA_PORT:-5001}" "esplora-ui" soft "boot.sh jumps it automatically"
    if [ "$MODE" = "all" ]; then
      check "$PG_PORT" "crypto-drive-pg" hard "stop it or remap -p"
    fi
    ;;
  *)
    echo "unknown mode: $MODE (app|regtest|db|all)" >&2
    exit 1
    ;;
esac

if [ "$FAIL" -ne 0 ]; then
  echo "RESULT: blocked — free the BUSY ports above, then boot."
  exit 1
elif [ "$WARN" -ne 0 ]; then
  echo "RESULT: bootable with warnings (see WARN above)."
else
  echo "RESULT: all clear."
fi
