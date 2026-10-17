#!/usr/bin/env bash
# Full-stack visibility: one report for the app, Nigiri's containers,
# infra-api, Postgres, and the file store — with the cross-checks Docker
# Desktop cannot show (chain heights in sync? app mode matches infra?
# faucet solvent? who holds the dev lock?).
#
# Read-only: probes, never starts/stops/kills anything. Exit 0 always —
# state is in the output, not the code.
#
# Usage: bash scripts/status.sh [options]
#   --app-port PORT     app port (default: $APP_PORT or 43127)
#   --infra-port PORT   infra-api port (default: 8081)
#   --json              machine-readable report on stdout
#   --watch SEC         clear + re-report every SEC seconds (Ctrl-C stops)
#   -h, --help          this text
set -uo pipefail

APP_PORT="${APP_PORT:-43127}"
INFRA_PORT="8081"
JSON=0
WATCH=0
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
INFRA_SECRET="dev" # dev default, same as docker-compose.infra-api.yml

usage() { sed -n '2,/^set -uo pipefail$/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --app-port) APP_PORT="${2:?--app-port needs a value}"; shift 2 ;;
    --app-port=*) APP_PORT="${1#--app-port=}"; shift ;;
    --infra-port) INFRA_PORT="${2:?--infra-port needs a value}"; shift 2 ;;
    --infra-port=*) INFRA_PORT="${1#--infra-port=}"; shift ;;
    --json) JSON=1; shift ;;
    --watch) WATCH="${2:?--watch needs seconds}"; shift 2 ;;
    --watch=*) WATCH="${1#--watch=}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1 (see --help)" >&2; exit 2 ;;
  esac
done
case "$WATCH" in
  ''|*[!0-9]*) echo "--watch needs a positive number of seconds" >&2; exit 2 ;;
esac

have() { command -v "$1" >/dev/null 2>&1; }

# ── probes (all read-only, all failure-proof) ──────────────────────────

APP_UP=0; APP_MODE=""; APP_DB=""; APP_PID=""; APP_AGE=""; LOCK_PID=""; LOCK_PORT=""
BITCOIND_CONTAINER="unknown"; BITCOIND_SINCE=""; BITCOIND_RESTARTS=""; BITCOIND_HEIGHT=""
ELECTRS_CONTAINER="unknown"; ELECTRS_SINCE=""; ELECTRS_TIP=""
CHOP_CONTAINER="unknown"; ESPLORA_CONTAINER="unknown"; ESPLORA_NIGIRI="unknown"; ESPLORA_URL=""; ESPLORA_UP=0
INFRA_CONTAINER="unknown"; INFRA_SINCE=""; INFRA_UP=0; INFRA_BC=""; INFRA_EL=""; FAUCET=""
PG_CONTAINER="unknown"; PG_SINCE=""; PG_READY=""; PG_MIGRATED=""
PG_STUDENTS=""; PG_SESSIONS=""; PG_CERTS=""; PG_WEBHOOKS=""
FS_PRESENT=0; FS_BYTES=""; FS_STUDENTS=""
ERR_BC=""; ERR_EL=""; ERR_INFRA=""; ERR_PG=""
WARNINGS=""

warn() { WARNINGS="${WARNINGS}${WARNINGS:+$'\n'}$1"; }

container_state() {
  # container_state <name>: "status|started|restarts" or "missing" / "unknown".
  local name=$1
  have docker || { echo "unknown"; return 0; }
  docker inspect "$name" --format '{{.State.Status}}|{{.State.StartedAt}}|{{.RestartCount}}' 2>/dev/null || echo "missing"
}

probe_app() {
  local body pid
  body=$(curl -s -m 3 "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null) || body=""
  if [ -n "$body" ]; then
    APP_UP=1
    APP_MODE=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).bitcoin)}catch{}})" 2>/dev/null)
    APP_DB=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).db)}catch{}})" 2>/dev/null)
  fi
  if have lsof; then
    pid=$(lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1)
    if [ -n "$pid" ]; then
      APP_PID="$pid"
      APP_AGE=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
    fi
  fi
  local lock="$REPO/.next/dev/lock"
  if [ -f "$lock" ] && have node; then
    local info
    info=$(node -e 'const fs=require("fs");try{const l=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log(l.pid+"|"+l.port)}catch{}' "$lock" 2>/dev/null)
    LOCK_PID="${info%%|*}"
    LOCK_PORT="${info##*|}"
  fi
}

probe_chain() {
  local st
  st=$(container_state bitcoin); BITCOIND_CONTAINER="${st%%|*}"
  if [[ "$st" == *"|"* ]]; then BITCOIND_SINCE=$(echo "$st" | cut -d'|' -f2 | cut -c1-16 | tr 'T' ' '); BITCOIND_RESTARTS=$(echo "$st" | cut -d'|' -f3); fi
  st=$(container_state electrs); ELECTRS_CONTAINER="${st%%|*}"
  if [[ "$st" == *"|"* ]]; then ELECTRS_SINCE=$(echo "$st" | cut -d'|' -f2 | cut -c1-16 | tr 'T' ' '); fi
  CHOP_CONTAINER=$(container_state chopsticks | cut -d'|' -f1)
  # Our UI first (self-discovers its jumped port); Nigiri's :5000 otherwise.
  ESPLORA_CONTAINER=$(container_state crypto-drive-esplora-ui-1 | cut -d'|' -f1)
  ESPLORA_NIGIRI=$(container_state esplora | cut -d'|' -f1)
  if [ "$ESPLORA_CONTAINER" = "running" ]; then
    local eport
    eport=$(docker port crypto-drive-esplora-ui-1 5000 2>/dev/null | head -1 | sed 's/.*://')
    case "$eport" in
      ''|*[!0-9]*) ESPLORA_URL="" ;;
      *)
        ESPLORA_URL="http://localhost:${eport}"
        if curl -s -o /dev/null -m 3 "${ESPLORA_URL}/" 2>/dev/null; then ESPLORA_UP=1; fi
        ;;
    esac
  fi
  # Dev-only Nigiri RPC credentials (defaults, also in docker-compose.infra-api.yml).
  BITCOIND_HEIGHT=$(curl -s -m 4 --user admin1:123 --data-binary '{"jsonrpc":"1.0","method":"getblockcount","params":[]}' -H 'content-type: text/plain' http://127.0.0.1:18443/ 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s).result;if(Number.isInteger(r))process.stdout.write(String(r))}catch{}})" 2>/dev/null)
  ELECTRS_TIP=$(curl -s -m 4 http://127.0.0.1:30000/blocks/tip/height 2>/dev/null | tr -cd '0-9')
}

probe_infra() {
  local st body
  st=$(container_state crypto-drive-infra-api-1); INFRA_CONTAINER="${st%%|*}"
  if [[ "$st" == *"|"* ]]; then INFRA_SINCE=$(echo "$st" | cut -d'|' -f2 | cut -c1-16 | tr 'T' ' '); fi
  body=$(curl -s -m 3 -H "Authorization: Bearer $INFRA_SECRET" "http://127.0.0.1:${INFRA_PORT}/api/health" 2>/dev/null) || body=""
  if [ -n "$body" ]; then
    INFRA_UP=1
    INFRA_BC=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(String(JSON.parse(s).bitcoind_ready))}catch{}})" 2>/dev/null)
    INFRA_EL=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(String(JSON.parse(s).electrs_ready))}catch{}})" 2>/dev/null)
    FAUCET=$(echo "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const f=JSON.parse(s).faucet_balance;if(Number.isInteger(f))process.stdout.write(String(f))}catch{}})" 2>/dev/null)
  fi
}

probe_pg() {
  local st
  st=$(container_state crypto-drive-pg); PG_CONTAINER="${st%%|*}"
  if [[ "$st" == *"|"* ]]; then PG_SINCE=$(echo "$st" | cut -d'|' -f2 | cut -c1-16 | tr 'T' ' '); fi
  if [ "$PG_CONTAINER" != "running" ]; then return 0; fi
  if docker exec crypto-drive-pg pg_isready -U postgres -q 2>/dev/null; then
    PG_READY="yes"
  else
    PG_READY="no"
    return 0
  fi
  local t n ok=1
  for t in students sessions certificates webhook_events; do
    n=$(docker exec -e PGPASSWORD=postgres crypto-drive-pg psql -U postgres -d postgres -tAc "SELECT count(*) FROM $t" 2>/dev/null | tr -cd '0-9')
    if [ -z "$n" ]; then ok=0; n=""; fi
    case "$t" in
      students) PG_STUDENTS="$n" ;;
      sessions) PG_SESSIONS="$n" ;;
      certificates) PG_CERTS="$n" ;;
      webhook_events) PG_WEBHOOKS="$n" ;;
    esac
  done
  [ "$ok" = 1 ] && PG_MIGRATED="yes" || PG_MIGRATED="no"
}

probe_filestore() {
  local f="$REPO/.data/store.json"
  if [ -f "$f" ] && have node; then
    FS_PRESENT=1
    FS_BYTES=$(wc -c < "$f" | tr -d ' ')
    FS_STUDENTS=$(node -e 'const fs=require("fs");try{const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log(Object.keys(s.students||{}).length)}catch{}' "$f" 2>/dev/null)
  fi
}

probe_errors() {
  # probe_errors <var> <container>: count of error-ish log lines in 10m.
  local var=$1 name=$2 n
  if [ "$(container_state "$name" | cut -d'|' -f1)" != "running" ]; then
    printf -v "$var" '%s' "-"
    return 0
  fi
  n=$(docker logs --since 10m "$name" 2>&1 | grep -aciE 'error|exception|unauthorized|failed|panic' 2>/dev/null || true)
  printf -v "$var" '%s' "${n:-0}"
}

crosscheck() {
  if [ "$APP_UP" = 0 ]; then
    warn "app is DOWN on :$APP_PORT (nothing answers /api/health)"
  elif [ "$APP_MODE" = "regtest" ] && [ "$INFRA_UP" = 0 ]; then
    warn "app is regtest but infra-api is DOWN on :$INFRA_PORT — wallet calls will 503"
  elif [ "$APP_MODE" != "regtest" ] && [ "$INFRA_UP" = 1 ]; then
    warn "app is $APP_MODE while infra-api is up — infra idle (fine, or boot regtest)"
  fi
  if [ -n "$LOCK_PID" ]; then
    if ! kill -0 "$LOCK_PID" 2>/dev/null; then
      warn "dev lock points at dead pid $LOCK_PID — stale, next boot ignores it"
    elif [ "$LOCK_PID" != "$APP_PID" ]; then
      warn "dev lock pid $LOCK_PID != listener pid $APP_PID — a stale boot may linger"
    fi
  fi
  if [ -n "$BITCOIND_HEIGHT" ] && [ -n "$ELECTRS_TIP" ]; then
    if [ "$ELECTRS_TIP" -lt "$BITCOIND_HEIGHT" ]; then
      warn "electrs tip $ELECTRS_TIP lags bitcoind $BITCOIND_HEIGHT — still syncing"
    fi
  elif [ "$BITCOIND_CONTAINER" = "running" ] && [ -z "$BITCOIND_HEIGHT" ]; then
    warn "bitcoind runs but RPC is silent — wrong credentials or still starting"
  fi
  if [ -n "$FAUCET" ] && [ "$FAUCET" -lt 1000000 ]; then
    warn "faucet low ($FAUCET sats) — top up via the infra-api mine route"
  fi
  if [ "$CHOP_CONTAINER" != "running" ]; then
    warn "chopsticks is $CHOP_CONTAINER (:3000 taken?) — soft, nothing in our path uses it"
  fi
  if [ "$ESPLORA_UP" = 1 ]; then
    : # ours answers — links work, nothing to say
  elif [ "$ESPLORA_CONTAINER" = "running" ]; then
    warn "our esplora-ui runs but ${ESPLORA_URL:-its port} is silent — wallet links may fail"
  else
    warn "our esplora-ui is $ESPLORA_CONTAINER (nigiri's is $ESPLORA_NIGIRI; :5000 is macOS AirPlay) — wallet links fall back to :5000"
  fi
  if [ "$PG_CONTAINER" = "running" ] && [ "$PG_MIGRATED" = "no" ]; then
    warn "postgres runs but tables are missing — run npm run db:test-setup"
  fi
  if [ "$APP_DB" = "file" ] && [ "$FS_PRESENT" = 0 ]; then
    warn "app uses the file store but .data/store.json does not exist yet (first unlock creates it)"
  fi
}

# ── rendering ─────────────────────────────────────────────────────────

mark() {
  # mark <state>: [up] / [DOWN] / [warn], colored on a TTY.
  if [ -t 1 ]; then
    case "$1" in
      up) printf '\033[32m[up]\033[0m' ;;
      down) printf '\033[31m[DOWN]\033[0m' ;;
      *) printf '\033[33m[warn]\033[0m' ;;
    esac
  else
    case "$1" in up) printf '[up]' ;; down) printf '[DOWN]' ;; *) printf '[warn]' ;; esac
  fi
}

btc() {
  # btc <sats>: 89996998590 -> "899.96998590", "" -> "".
  [ -z "$1" ] && return 0
  node -e 'console.log((Number(process.argv[1])/1e8).toFixed(8).replace(/0+$/,"").replace(/\.$/,".0"))' "$1" 2>/dev/null
}

emit_human() {
  local lag=""
  if [ -n "$BITCOIND_HEIGHT" ] && [ -n "$ELECTRS_TIP" ]; then
    if [ "$ELECTRS_TIP" -lt "$BITCOIND_HEIGHT" ]; then lag=" (syncing, -$((BITCOIND_HEIGHT - ELECTRS_TIP)))"; else lag=" (in sync)"; fi
  fi
  echo "crypto-drive status — $(date '+%Y-%m-%d %H:%M:%S')"
  printf 'app        %s  :%s' "$(mark "$([ "$APP_UP" = 1 ] && echo up || echo down)")" "$APP_PORT"
  [ -n "$APP_PID" ] && printf ' pid %s%s' "$APP_PID" "$([ -n "$APP_AGE" ] && echo " up $APP_AGE" || true)"
  [ -n "$APP_MODE" ] && printf ' mode=%s db=%s' "$APP_MODE" "$APP_DB"
  echo
  if [ -n "$LOCK_PID" ]; then
    if [ "$LOCK_PID" = "$APP_PID" ]; then
      echo "  lock: pid $LOCK_PID port $LOCK_PORT (match)"
    else
      echo "  lock: pid $LOCK_PID port $LOCK_PORT (MISMATCH — see warnings)"
    fi
  else
    echo "  lock: none"
  fi
  printf 'bitcoind   %s  container %s' "$(mark "$([ "$BITCOIND_CONTAINER" = "running" ] && echo up || echo down)")" "$BITCOIND_CONTAINER"
  [ -n "$BITCOIND_SINCE" ] && printf ' since %s' "$BITCOIND_SINCE"
  [ -n "$BITCOIND_RESTARTS" ] && [ "$BITCOIND_RESTARTS" != "0" ] && printf ' restarts=%s' "$BITCOIND_RESTARTS"
  [ -n "$BITCOIND_HEIGHT" ] && printf ' height %s' "$BITCOIND_HEIGHT"
  echo
  printf 'electrs    %s  container %s' "$(mark "$([ "$ELECTRS_CONTAINER" = "running" ] && echo up || echo down)")" "$ELECTRS_CONTAINER"
  [ -n "$ELECTRS_SINCE" ] && printf ' since %s' "$ELECTRS_SINCE"
  [ -n "$ELECTRS_TIP" ] && printf ' tip %s%s' "$ELECTRS_TIP" "$lag"
  echo
  printf 'chopsticks %s  container %s\n' "$(mark "$([ "$CHOP_CONTAINER" = "running" ] && echo up || echo warn)")" "$CHOP_CONTAINER"
  if [ "$ESPLORA_UP" = 1 ]; then
    printf 'esplora    %s  ours %s answers (nigiri: %s)\n' "$(mark up)" "$ESPLORA_URL" "$ESPLORA_NIGIRI"
  else
    printf 'esplora    %s  ours=%s nigiri=%s\n' "$(mark warn)" "$ESPLORA_CONTAINER" "$ESPLORA_NIGIRI"
  fi
  printf 'infra-api  %s  container %s' "$(mark "$([ "$INFRA_UP" = 1 ] && echo up || echo down)")" "$INFRA_CONTAINER"
  [ -n "$INFRA_SINCE" ] && printf ' since %s' "$INFRA_SINCE"
  if [ "$INFRA_UP" = 1 ]; then
    printf ' bitcoind=%s electrs=%s' "${INFRA_BC:-?}" "${INFRA_EL:-?}"
    [ -n "$FAUCET" ] && printf ' faucet %s sats (%s BTC)' "$FAUCET" "$(btc "$FAUCET")"
  else
    printf ' :%s silent' "$INFRA_PORT"
  fi
  echo
  printf 'postgres   %s  container %s' "$(mark "$([ "$PG_CONTAINER" = "running" ] && [ "$PG_READY" = "yes" ] && echo up || ([ "$PG_CONTAINER" = "missing" ] && echo warn || echo down))")" "$PG_CONTAINER"
  [ -n "$PG_SINCE" ] && printf ' since %s' "$PG_SINCE"
  if [ "$PG_READY" = "yes" ]; then
    if [ "$PG_MIGRATED" = "yes" ]; then
      printf ' students=%s sessions=%s certs=%s webhooks=%s' "$PG_STUDENTS" "$PG_SESSIONS" "$PG_CERTS" "$PG_WEBHOOKS"
    else
      printf ' reachable, tables missing (unmigrated)'
    fi
  elif [ "$PG_CONTAINER" = "running" ]; then
    printf ' not ready yet'
  fi
  echo
  if [ "$FS_PRESENT" = 1 ]; then
    printf 'filestore  [up]  .data/store.json %s bytes students=%s\n' "$FS_BYTES" "${FS_STUDENTS:-?}"
  else
    printf 'filestore  %s  no .data/store.json\n' "$(mark warn)"
  fi
  echo "errors-10m bitcoind=${ERR_BC:-?} electrs=${ERR_EL:-?} infra-api=${ERR_INFRA:-?} postgres=${ERR_PG:-?}"
  if [ -n "$WARNINGS" ]; then
    echo "warnings:"
    echo "$WARNINGS" | while IFS= read -r w; do echo "  ! $w"; done
  else
    echo "warnings: none"
  fi
}

jstr() {
  # jstr <value>: "quoted" or null.
  if [ -z "$1" ]; then printf 'null'; else printf '"%s"' "$(echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; fi
}
jnum() {
  # jnum <value>: digits or null.
  case "$1" in ''|*[!0-9]*) printf 'null' ;; *) printf '%s' "$1" ;; esac
}
jbool() {
  case "$1" in 1|true|yes) printf 'true' ;; 0|false|no) printf 'false' ;; *) printf 'null' ;; esac
}

emit_json() {
  local lock_match="null"
  if [ -n "$LOCK_PID" ] && [ -n "$APP_PID" ]; then
    [ "$LOCK_PID" = "$APP_PID" ] && lock_match="true" || lock_match="false"
  fi
  local lag="null"
  if [ -n "$BITCOIND_HEIGHT" ] && [ -n "$ELECTRS_TIP" ]; then
    lag=$((BITCOIND_HEIGHT - ELECTRS_TIP))
  fi
  {
    printf '{"time":%s,' "$(jstr "$(date -u '+%Y-%m-%dT%H:%M:%SZ')")"
    printf '"app":{"up":%s,"port":%s,"pid":%s,"age":%s,"mode":%s,"db":%s,' "$(jbool "$APP_UP")" "$(jnum "$APP_PORT")" "$(jnum "$APP_PID")" "$(jstr "$APP_AGE")" "$(jstr "$APP_MODE")" "$(jstr "$APP_DB")"
    printf '"lock":{"pid":%s,"port":%s,"match":%s}},' "$(jnum "$LOCK_PID")" "$(jnum "$LOCK_PORT")" "$lock_match"
    printf '"bitcoind":{"container":%s,"since":%s,"restarts":%s,"height":%s},' "$(jstr "$BITCOIND_CONTAINER")" "$(jstr "$BITCOIND_SINCE")" "$(jnum "$BITCOIND_RESTARTS")" "$(jnum "$BITCOIND_HEIGHT")"
    printf '"electrs":{"container":%s,"since":%s,"tip":%s,"lag":%s},' "$(jstr "$ELECTRS_CONTAINER")" "$(jstr "$ELECTRS_SINCE")" "$(jnum "$ELECTRS_TIP")" "$lag"
    printf '"chopsticks":{"container":%s},' "$(jstr "$CHOP_CONTAINER")"
    printf '"esplora":{"container":%s,"nigiri":%s,"url":%s,"up":%s},' "$(jstr "$ESPLORA_CONTAINER")" "$(jstr "$ESPLORA_NIGIRI")" "$(jstr "$ESPLORA_URL")" "$(jbool "$ESPLORA_UP")"
    printf '"infraApi":{"container":%s,"since":%s,"up":%s,"bitcoindReady":%s,"electrsReady":%s,"faucetSats":%s},' "$(jstr "$INFRA_CONTAINER")" "$(jstr "$INFRA_SINCE")" "$(jbool "$INFRA_UP")" "$(jbool "$INFRA_BC")" "$(jbool "$INFRA_EL")" "$(jnum "$FAUCET")"
    printf '"postgres":{"container":%s,"since":%s,"ready":%s,"migrated":%s,' "$(jstr "$PG_CONTAINER")" "$(jstr "$PG_SINCE")" "$(jbool "$PG_READY")" "$(jbool "$PG_MIGRATED")"
    printf '"students":%s,"sessions":%s,"certificates":%s,"webhooks":%s},' "$(jnum "$PG_STUDENTS")" "$(jnum "$PG_SESSIONS")" "$(jnum "$PG_CERTS")" "$(jnum "$PG_WEBHOOKS")"
    printf '"filestore":{"present":%s,"bytes":%s,"students":%s},' "$(jbool "$FS_PRESENT")" "$(jnum "$FS_BYTES")" "$(jnum "$FS_STUDENTS")"
    printf '"errors10m":{"bitcoind":%s,"electrs":%s,"infraApi":%s,"postgres":%s},' "$(jnum "$ERR_BC")" "$(jnum "$ERR_EL")" "$(jnum "$ERR_INFRA")" "$(jnum "$ERR_PG")"
    printf '"warnings":['
    if [ -n "$WARNINGS" ]; then
      echo "$WARNINGS" | while IFS= read -r w; do jstr "$w"; echo; done | paste -sd "," -
    fi
    printf ']}\n'
  }
}

report_once() {
  probe_app
  probe_chain
  probe_infra
  probe_pg
  probe_filestore
  probe_errors ERR_BC bitcoin
  probe_errors ERR_EL electrs
  probe_errors ERR_INFRA crypto-drive-infra-api-1
  probe_errors ERR_PG crypto-drive-pg
  crosscheck
  if [ "$JSON" = 1 ]; then emit_json; else emit_human; fi
}

if [ "$WATCH" = 0 ]; then
  report_once
else
  while true; do
    if have clear; then clear; else printf '\033c'; fi
    report_once
    sleep "$WATCH"
  done
fi
