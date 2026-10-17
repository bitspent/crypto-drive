#!/usr/bin/env bash
# Full local boot: checks every dependency, resolves every port conflict
# (jump / kill / abort), starts Nigiri + infra-api (+ Postgres on request),
# then execs the Next.js dev server. Prompts on conflict; --yes for CI,
# -i for a guided questionnaire first.
#
# Probing here deliberately overlaps scripts/check-ports.sh: that script only
# diagnoses (never kills, never starts), this one resolves and boots.
#
# Usage: bash scripts/boot.sh [MODE] [options]
#   MODE                       simulated | signet | regtest (default: simulated)
#   --mode MODE                same as positional
#   --app-port PORT            app port, jumps on conflict (default: $APP_PORT or 43127)
#   --infra-port PORT          infra-api host port, regtest only (default: 8081)
#   --pg-port PORT             postgres host port with --with-db, jumps on
#                              conflict (default: 5433)
#   --esplora-port PORT        our Esplora UI host port, regtest only, always
#                              auto-jumps (default: 5001; Nigiri's own :5000
#                              is AirPlay on macOS)
#   --with-db                  also ensure crypto-drive-pg :5433 and run the app on Postgres
#   --wait SEC                 how long to wait for services (default: 60)
#   --yes, -y                  non-interactive: auto-jump, auto-start, never kill
#   --kill-ours                with --yes: also kill OUR OWN stale app instead of jumping
#   -i, --interactive          guided questionnaire first (mode, ports, db,
#                              conflict policy), then boot. Flags you already
#                              passed become the defaults. Needs a TTY.
#   --dry-run                  probe + print the plan, start/kill/exec nothing
#   -h, --help                 this text
#
# Port policy:
#   app + infra-api + postgres ports can JUMP (+1 until free) — except
#   onto/away from our own `next dev`, which holds a repo lock
#   (.next/dev/lock): a second dev server in this repo refuses to start on
#   ANY port, so that case is restart-or-abort, never jump. Nigiri's ports
#   are fixed (Nigiri owns them) — free them or abort. Chopsticks :3000 is
#   soft: only chopsticks fails when it is taken, nothing in our path uses
#   it. Chopsticks cannot jump (Nigiri owns the mapping), so the remedy is
#   free-it-and-start-it, skip (the default), or abort; declines skip.
#   When a DOCKER container holds a port, the offer is `docker stop <name>`
#   (killing the backend PID would be wrong); foreign containers are stopped
#   only after asking, never with --yes.
# Kill policy: our own stale app (cwd is this repo) may be restarted after
# asking; anything foreign is only killed after an explicit second confirm,
# and never with --yes. Safety rule: no prompt kills/stops on its DEFAULT
# (Enter/EOF always lands on jump or abort), and unrecognized input re-asks
# instead of falling through to anything destructive.
set -uo pipefail

MODE="simulated"
APP_PORT="${APP_PORT:-43127}"
INFRA_PORT="8081"
PG_PORT="5433"
ESPLORA_PORT="5001"
# Explicit user value (self-hosted UI) always wins for links; otherwise the
# boot points links at our own UI when it answers, :5000 if not.
if [ -n "${ESPLORA_PUBLIC_URL:-}" ]; then
  ESPLORA_AUTO=0
else
  ESPLORA_PUBLIC_URL="http://localhost:5000"
  ESPLORA_AUTO=1
fi
WITH_DB=0
WAIT_SECS=60
YES=0
KILL_OURS=0
DRY_RUN=0
INTERACTIVE=0
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
JUMPED_APP=0
JUMPED_INFRA=0
JUMPED_PG=0
CHOP_FIX=""

usage() { sed -n '2,/^set -uo pipefail$/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    simulated|signet|regtest) MODE="$1"; shift ;;
    --mode) MODE="${2:?--mode needs a value}"; shift 2 ;;
    --mode=*) MODE="${1#--mode=}"; shift ;;
    --app-port) APP_PORT="${2:?--app-port needs a value}"; shift 2 ;;
    --app-port=*) APP_PORT="${1#--app-port=}"; shift ;;
    --infra-port) INFRA_PORT="${2:?--infra-port needs a value}"; shift 2 ;;
    --infra-port=*) INFRA_PORT="${1#--infra-port=}"; shift ;;
    --pg-port) PG_PORT="${2:?--pg-port needs a value}"; shift 2 ;;
    --pg-port=*) PG_PORT="${1#--pg-port=}"; shift ;;
    --esplora-port) ESPLORA_PORT="${2:?--esplora-port needs a value}"; shift 2 ;;
    --esplora-port=*) ESPLORA_PORT="${1#--esplora-port=}"; shift ;;
    --with-db) WITH_DB=1; shift ;;
    --wait) WAIT_SECS="${2:?--wait needs seconds}"; shift 2 ;;
    --wait=*) WAIT_SECS="${1#--wait=}"; shift ;;
    --yes|-y) YES=1; shift ;;
    --kill-ours) KILL_OURS=1; shift ;;
    -i|--interactive) INTERACTIVE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1 (see --help)" >&2; exit 2 ;;
  esac
done
case "$MODE" in
  simulated|signet|regtest) ;;
  *) echo "bad --mode: $MODE (simulated|signet|regtest)" >&2; exit 2 ;;
esac
if [ "$INTERACTIVE" = 1 ] && [ "$YES" = 1 ]; then
  echo "-i/--interactive and --yes contradict each other (guided vs non-interactive)" >&2
  exit 2
fi

step() { echo "── [$1] $2 ──"; }
say() { echo "   $1"; }
ok() { echo "   ok: $1"; }
warn() { echo "   warn: $1"; }
die() { echo "   ABORT: $1" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# ── guided questionnaire (-i) ─────────────────────────────────────────
# Runs before everything else. Flags already passed on the command line
# become the defaults, so `boot.sh regtest -i` only asks the rest.

questionnaire() {
  step "0/6" "guided setup"
  say "7 questions, then the boot. Defaults are in [brackets] — Enter accepts."
  local ans

  # Q1 — mode (BITCOIN_MODE seeds the default when it names a valid mode).
  local def_mode="$MODE"
  case "${BITCOIN_MODE:-}" in
    simulated|signet|regtest)
      def_mode="$BITCOIN_MODE"
      say "default mode comes from BITCOIN_MODE=$BITCOIN_MODE"
      ;;
  esac
  local def_letter=s
  case "$def_mode" in signet) def_letter=g ;; regtest) def_letter=r ;; esac
  while true; do
    ans=$(ask "Q1/7 — mode: (s)imulated play money, si(g)net live testnet, (r)egtest local stack" "$def_letter") || exit 1
    case "$ans" in
      s*|simulated) MODE=simulated; break ;;
      g*|signet) MODE=signet; break ;;
      r*|regtest) MODE=regtest; break ;;
      *) say "answer s, g, or r (or the full mode name)" ;;
    esac
  done
  say "→ mode=$MODE"

  # Q2 — app port.
  while true; do
    ans=$(ask "Q2/7 — app port" "$APP_PORT") || exit 1
    case "$ans" in
      ''|*[!0-9]*|0*) say "a port is a number 1–65535 — try again" ;;
      *) APP_PORT="$ans"; break ;;
    esac
  done
  say "→ app on :$APP_PORT"

  # Q3 — infra port (regtest only).
  if [ "$MODE" = "regtest" ]; then
    while true; do
      ans=$(ask "Q3/7 — infra-api port (jumped automatically if taken)" "$INFRA_PORT") || exit 1
      case "$ans" in
        ''|*[!0-9]*|0*) say "a port is a number 1–65535 — try again" ;;
        *) INFRA_PORT="$ans"; break ;;
      esac
    done
    say "→ infra-api on :$INFRA_PORT"
  fi

  # Q4 — postgres (+ host port when yes).
  local def_db=n
  [ "$WITH_DB" = 1 ] && def_db=y
  ans=$(ask "Q4/7 — also boot local Postgres and run the app on it? (y)es / (n)o, file store otherwise" "$def_db") || exit 1
  case "$ans" in y*) WITH_DB=1 ;; *) WITH_DB=0 ;; esac
  if [ "$WITH_DB" = 1 ]; then
    while true; do
      ans=$(ask "Q4/7 — postgres host port (jumped automatically if taken)" "$PG_PORT") || exit 1
      case "$ans" in
        ''|*[!0-9]*|0*) say "a port is a number 1–65535 — try again" ;;
        *) PG_PORT="$ans"; break ;;
      esac
    done
    say "→ Postgres on :$PG_PORT"
  else
    say "→ file store (.data/store.json)"
  fi

  # Q5 — wait budget.
  while true; do
    ans=$(ask "Q5/7 — seconds to wait for each service to come up" "$WAIT_SECS") || exit 1
    case "$ans" in
      ''|*[!0-9]*|0*) say "a positive number of seconds — try again" ;;
      *) WAIT_SECS="$ans"; break ;;
    esac
  done
  say "→ wait ${WAIT_SECS}s per service"

  # Q6 — conflict policy.
  local def_pol=a
  if [ "$YES" = 1 ]; then
    if [ "$KILL_OURS" = 1 ]; then def_pol=k; else def_pol=f; fi
  fi
  while true; do
    ans=$(ask "Q6/7 — when a port is busy or a service is down: (a)sk each time, auto-(f)ix without killing, auto-fix + (k)ill our own" "$def_pol") || exit 1
    case "$ans" in
      a*) YES=0; KILL_OURS=0; break ;;
      f*) YES=1; KILL_OURS=0; break ;;
      k*) YES=1; KILL_OURS=1; break ;;
      *) say "answer a, f, or k" ;;
    esac
  done
  if [ "$YES" = 1 ]; then
    [ "$KILL_OURS" = 1 ] && say "→ auto-fix, may restart our own processes" || say "→ auto-fix, never kills"
  else
    say "→ ask each time"
  fi

  # Q6b — chopsticks fix, offered only in auto modes (ask mode gets the menu
  # at step 2 instead) and only when :3000 is actually foreign-held. The
  # typed confirm here IS the consent: step 2 then acts without re-asking.
  if [ "$YES" = 1 ] && [ "$MODE" = "regtest" ]; then
    local cfound cours cpid ccmd cforeign
    cfound=$(listeners 3000)
    cours=$(our_container_on 3000 | head -1)
    if [ -n "$cfound" ] && [ -z "$cours" ]; then
      cpid=$(echo "$cfound" | head -1 | cut -d'|' -f1)
      ccmd=$(echo "$cfound" | head -1 | cut -d'|' -f2)
      cforeign=$(foreign_container_on 3000 | head -1)
      if [ -n "$cforeign" ]; then
        say "Q6b — :3000 is held by FOREIGN container $cforeign (chopsticks can't start)"
      else
        say "Q6b — :3000 is held by FOREIGN process (pid $cpid $ccmd) (chopsticks can't start)"
      fi
      while true; do
        ans=$(ask "Q6b — free :3000 for chopsticks? (f)ree it / (s)kip" "s") || exit 1
        case "$ans" in
          f*) break ;;
          s*) say "→ skipping chopsticks"; break ;;
          *) say "answer f or s" ;;
        esac
      done
      if [[ "$ans" == f* ]]; then
        if [ -n "$cforeign" ]; then
          ans=$(ask "really stop FOREIGN container $cforeign? type 'stop' to confirm" "no") || exit 1
          if [ "$ans" = "stop" ]; then CHOP_FIX="container:$cforeign"; say "→ will stop $cforeign for chopsticks"; else say "→ skipping chopsticks"; fi
        else
          ans=$(ask "really kill FOREIGN pid $cpid ($ccmd)? type 'kill' to confirm" "no") || exit 1
          if [ "$ans" = "kill" ]; then CHOP_FIX="pid:$cpid"; say "→ will free :3000 for chopsticks"; else say "→ skipping chopsticks"; fi
        fi
      fi
    fi
  fi

  # Q7 — confirm.
  echo "   ── plan ──"
  echo "   mode=$MODE app-port=$APP_PORT$([ "$MODE" = "regtest" ] && echo " infra-port=$INFRA_PORT" || true)$([ "$WITH_DB" = 1 ] && echo " +postgres:$PG_PORT" || true) policy=$([ "$YES" = 1 ] && ([ "$KILL_OURS" = 1 ] && echo "auto+kill-ours" || echo "auto") || echo "ask")$([ -n "$CHOP_FIX" ] && echo " +chopfix" || true)"
  while true; do
    ans=$(ask "Q7/7 — boot with this plan? (y)es / (d)ry-run instead / (a)bort" "y") || exit 1
    case "$ans" in
      y*) say "→ booting"; break ;;
      d*) DRY_RUN=1; say "→ dry run (nothing will start)"; break ;;
      a*) die "aborted by you" ;;
      *) say "answer y, d, or a" ;;
    esac
  done
}

# NOTE: the questionnaire *call* lives just before step 1, not here — bash
# executes streaming, so calling it here would run before ask() is defined.

# ── listeners / ownership probes ──────────────────────────────────────

# listeners <port>: "pid|command" per LISTEN holder, "" when free.
listeners() {
  local port=$1
  if have lsof; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fp -Fc 2>/dev/null | awk '
      /^p/ { pid = substr($0, 2) }
      /^c/ { print pid "|" substr($0, 2); pid = "" }'
  else
    echo "no-probe|lsof missing" >&2
    return 1
  fi
}

# our_container_on <port>: container name when one of OUR services holds it.
our_container_on() {
  local port=$1
  have docker || return 1
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | while read -r name ports; do
    case "$ports" in
      *":$port->"*|*":$port,"*|*":$port-"*|*"-$port->"*)
        case "$name" in
          bitcoin|electrs|electrum-ws|chopsticks|esplora|crypto-drive-infra-api-1|crypto-drive-esplora-ui-1|crypto-drive-pg)
            echo "$name" ;;
        esac ;;
    esac
  done
}

# foreign_container_on <port>: any container publishing this port, ours or
# not. Callers check our_container_on first, so a hit here is someone else's.
foreign_container_on() {
  local port=$1
  have docker || return 1
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | while read -r name ports; do
    case "$ports" in
      *":$port->"*|*":$port,"*|*":$port-"*|*"-$port->"*) echo "$name" ;;
    esac
  done
}

# resolve_esplora_port: our Esplora UI auto-jumps from :5001 — it is
# auxiliary, so it never prompts and never kills; worst case it moves, and
# if nothing nearby is free the wallet links fall back to :5000.
resolve_esplora_port() {
  local found ours target
  found=$(listeners "$ESPLORA_PORT")
  if [ -z "$found" ]; then
    ok ":$ESPLORA_PORT (esplora-ui) is free"
    return 0
  fi
  ours=$(our_container_on "$ESPLORA_PORT" | head -1)
  if [ -n "$ours" ]; then
    ok ":$ESPLORA_PORT (esplora-ui) is ours already (container $ours) — reusing"
    return 0
  fi
  target=$(next_free_port "$ESPLORA_PORT") || {
    warn ":$ESPLORA_PORT (esplora-ui) is taken and nothing nearby is free — links fall back to :5000"
    ESPLORA_PORT=""
    return 0
  }
  say ":$ESPLORA_PORT (esplora-ui) is taken — ours will use :$target"
  ESPLORA_PORT="$target"
}

esplora_ui_up() {
  [ -n "$ESPLORA_PORT" ] || return 1
  curl -s -o /dev/null --max-time 3 "http://localhost:${ESPLORA_PORT}/" 2>/dev/null
}

point_links_at_ours() {
  if [ "$ESPLORA_AUTO" = 1 ]; then
    ESPLORA_PUBLIC_URL="http://localhost:${ESPLORA_PORT}"
  else
    say "keeping explicit ESPLORA_PUBLIC_URL=$ESPLORA_PUBLIC_URL for links"
  fi
}

# follow_pg_mapping: an existing crypto-drive-pg keeps its own host mapping
# (a previous jump may have moved it) — PG_PORT follows the container, so
# step 2 resolves the port we will actually use. No container: no-op.
follow_pg_mapping() {
  local state mapped
  state=$(docker inspect crypto-drive-pg --format '{{.State.Running}}' 2>/dev/null || echo "missing")
  if [ "$state" != "true" ] && [ "$state" != "false" ]; then return 0; fi
  mapped=$(docker port crypto-drive-pg 5432 2>/dev/null | head -1 | sed 's/.*://')
  case "$mapped" in
    ''|*[!0-9]*) say "crypto-drive-pg has no 5432 mapping — keeping :$PG_PORT" ;;
    *)
      if [ "$mapped" != "$PG_PORT" ]; then
        say "crypto-drive-pg is mapped to :$mapped — following the container (not :$PG_PORT)"
        PG_PORT="$mapped"
      fi
      ;;
  esac
}

# is_own_pid <pid>: true when the process runs with cwd == this repo.
is_own_pid() {
  local pid=$1 cwd
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  [ -n "$cwd" ] && [ "$cwd" = "$REPO" ]
}

# own_dev_lock: "pid|port" of OUR repo's live `next dev` (from the same
# .next/dev/lock Next itself checks), or nothing when absent/stale/foreign.
own_dev_lock() {
  local lock="$REPO/.next/dev/lock"
  [ -f "$lock" ] || return 1
  local info pid port
  info=$(node -e 'const fs=require("fs");const l=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log(l.pid+"|"+l.port)' "$lock" 2>/dev/null) || return 1
  pid="${info%%|*}"
  port="${info##*|}"
  kill -0 "$pid" 2>/dev/null || return 1
  # The lock pid is the next-server child ("next-server (v16.4.0)" carries no
  # repo path in its args), so ownership is proven by cwd, not argv.
  is_own_pid "$pid" || return 1
  echo "$pid|$port"
}

next_free_port() {
  local port=$1 i
  for i in $(seq 1 20); do
    port=$((port + 1))
    if [ -z "$(listeners "$port")" ] && [ -z "$(our_container_on "$port" | head -1)" ]; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

# ask <prompt> <default>: interactive choice. Prints the (lowercased) answer.
# Returns 1 when stdin is not a TTY — callers MUST use `ans=$(ask …) || exit 1`
# because `exit` inside a command substitution would only kill the subshell.
ask() {
  local prompt=$1 default=$2 ans
  if [ ! -t 0 ]; then
    echo "   ABORT: no TTY for '$prompt' — answer on a terminal, or re-run with --yes" >&2
    return 1
  fi
  printf '   %s [%s]: ' "$prompt" "$default" >&2
  read -r ans || ans=""
  ans="${ans:-$default}"
  echo "$ans" | tr '[:upper:]' '[:lower:]'
}

kill_pid() {
  local pid=$1 desc=$2 i
  if [ "$DRY_RUN" = 1 ]; then
    say "would kill $desc"
    return 0
  fi
  say "killing ${desc}…"
  kill "$pid" 2>/dev/null || die "could not signal $desc"
  for i in $(seq 1 5); do
    kill -0 "$pid" 2>/dev/null || { ok "$desc stopped"; return 0; }
    sleep 1
  done
  die "$desc survived SIGTERM — run 'kill -9 $pid' yourself, then re-run boot"
}

stop_container() {
  local name=$1 i state
  if [ "$DRY_RUN" = 1 ]; then
    say "would run: docker stop $name"
    return 0
  fi
  say "stopping container ${name}…"
  docker stop "$name" >/dev/null 2>&1 || die "'docker stop $name' failed"
  for i in $(seq 1 15); do
    state=$(docker inspect "$name" --format '{{.State.Running}}' 2>/dev/null || echo missing)
    if [ "$state" != "true" ]; then ok "container $name stopped"; return 0; fi
    sleep 1
  done
  die "container $name would not stop — 'docker kill $name' yourself, then re-run boot"
}

# ── port resolution ───────────────────────────────────────────────────
# resolve_jumpable <port-var> <label>: free/ours/jump/kill/abort. Sets the
# variable to the final port. Returns 0, or dies on abort.

resolve_jumpable() {
  local var=$1 label=$2
  local port found ours pid cmd ans target
  port="${!var}"
  found=$(listeners "$port")
  if [ -z "$found" ]; then
    ok ":$port ($label) is free"
    return 0
  fi
  ours=$(our_container_on "$port" | head -1)
  if [ -n "$ours" ]; then
    ok ":$port ($label) is ours already (container $ours) — reusing"
    return 0
  fi
  pid=$(echo "$found" | head -1 | cut -d'|' -f1)
  cmd=$(echo "$found" | head -1 | cut -d'|' -f2)
  target=$(next_free_port "$port") || die ":$port ($label) busy and no free port nearby"

  if is_own_pid "$pid"; then
    # Our own `next dev` holds the repo lock: jumping cannot help (the new
    # server would refuse to start on any port), so this is restart-or-abort.
    if [ "$label" = "app" ] && [ -n "${DEVLOCK_PID:-}" ] && [ "$pid" = "$DEVLOCK_PID" ]; then
      warn ":$port ($label) is held by OUR OWN dev server (pid $pid) — it holds the repo lock"
      if [ "$YES" = 1 ]; then
        if [ "$KILL_OURS" = 1 ]; then
          say "--yes --kill-ours: restarting our own dev server"
          kill_pid "$pid" "pid $pid ($cmd)"
          DEVLOCK_PID=""; DEVLOCK_PORT=""
          return 0
        fi
        die "our own dev server holds the repo lock — re-run with --kill-ours or stop pid $pid"
      fi
      while true; do
        ans=$(ask ":$port busy (our dev server) — (r)estart it, (a)bort" "a") || exit 1
        case "$ans" in
          r*) say "restarting our own dev server"; kill_pid "$pid" "pid $pid ($cmd)"; DEVLOCK_PID=""; DEVLOCK_PORT=""; return 0 ;;
          a*) die "aborted by you" ;;
          *) say "answer r or a" ;;
        esac
      done
    fi
    warn ":$port ($label) is held by OUR OWN previous boot (pid $pid $cmd)"
    if [ "$YES" = 1 ]; then
      if [ "$KILL_OURS" = 1 ]; then
        say "--yes --kill-ours: restarting our own $label"
        kill_pid "$pid" "pid $pid ($cmd)"
        return 0
      fi
      say "--yes: jumping our stale $label :$port → :$target"
    else
      while true; do
        ans=$(ask ":$port busy (ours) — (r)estart it, (j)ump to :$target, (a)bort" "j") || exit 1
        case "$ans" in
          r*) say "restarting our own $label"; kill_pid "$pid" "pid $pid ($cmd)"; return 0 ;;
          j*) say "jumping :$port → :$target"; break ;;
          a*) die "aborted by you" ;;
          *) say "answer r, j, or a" ;;
        esac
      done
    fi
  else
    local foreign
    foreign=$(foreign_container_on "$port" | head -1)
    if [ -n "$foreign" ]; then
      # A container holds it: `docker stop` is the clean kill — never signal
      # the backend PID. Foreign containers are stopped only after asking.
      warn ":$port ($label) is held by FOREIGN container $foreign"
      if [ "$YES" = 1 ]; then
        say "--yes: never touches foreign containers — jumping :$port → :$target"
      else
        while true; do
          ans=$(ask ":$port busy (container $foreign) — (j)ump to :$target, (s)top container, (a)bort" "j") || exit 1
          case "$ans" in
            s*)
              ans=$(ask "really stop FOREIGN container $foreign? type 'stop' to confirm" "no") || exit 1
              [ "$ans" = "stop" ] || die "aborted by you"
              stop_container "$foreign"
              return 0
              ;;
            j*) say "jumping :$port → :$target"; break ;;
            a*) die "aborted by you" ;;
            *) say "answer j, s, or a" ;;
          esac
        done
      fi
    else
      warn ":$port ($label) is held by a FOREIGN process (pid $pid $cmd)"
      if [ "$YES" = 1 ]; then
        say "--yes: never kills foreign PIDs — jumping :$port → :$target"
      else
        while true; do
          ans=$(ask ":$port busy (foreign) — (j)ump to :$target, (k)ill pid $pid, (a)bort" "j") || exit 1
          case "$ans" in
            k*)
              ans=$(ask "really kill FOREIGN pid $pid ($cmd)? type 'kill' to confirm" "no") || exit 1
              [ "$ans" = "kill" ] || die "aborted by you"
              kill_pid "$pid" "pid $pid ($cmd)"
              return 0
              ;;
            j*) say "jumping :$port → :$target"; break ;;
            a*) die "aborted by you" ;;
            *) say "answer j, k, or a" ;;
          esac
        done
      fi
    fi
  fi
  printf -v "$var" '%s' "$target"
  case "$var" in
    APP_PORT) JUMPED_APP=1 ;;
    INFRA_PORT) JUMPED_INFRA=1 ;;
    *) JUMPED_PG=1 ;;
  esac
}

# resolve_fixed <port> <label> <hint>: Nigiri/PG ports cannot jump.
resolve_fixed() {
  local port=$1 label=$2 hint=$3
  local found ours pid cmd ans
  found=$(listeners "$port")
  if [ -z "$found" ]; then
    ok ":$port ($label) is free"
    return 0
  fi
  ours=$(our_container_on "$port" | head -1)
  if [ -n "$ours" ]; then
    ok ":$port ($label) is ours already (container $ours) — reusing"
    return 0
  fi
  pid=$(echo "$found" | head -1 | cut -d'|' -f1)
  cmd=$(echo "$found" | head -1 | cut -d'|' -f2)
  local foreign
  foreign=$(foreign_container_on "$port" | head -1)
  if [ -n "$foreign" ]; then
    warn ":$port ($label) is held by FOREIGN container $foreign — this port is FIXED ($hint)"
    if [ "$YES" = 1 ]; then
      die "--yes never touches foreign containers — 'docker stop $foreign' to free :$port, then re-run"
    fi
    while true; do
      ans=$(ask ":$port fixed (container $foreign) — (s)top container, (a)bort" "a") || exit 1
      case "$ans" in
        s*)
          ans=$(ask "really stop FOREIGN container $foreign? type 'stop' to confirm" "no") || exit 1
          [ "$ans" = "stop" ] || die "aborted by you"
          stop_container "$foreign"
          return 0
          ;;
        a*) die "aborted by you (hint: $hint)" ;;
        *) say "answer s or a" ;;
      esac
    done
  fi
  warn ":$port ($label) is held by pid $pid ($cmd) — this port is FIXED ($hint)"
  if [ "$YES" = 1 ]; then
    die "--yes never kills, and :$port cannot jump — free it and re-run"
  fi
  while true; do
    ans=$(ask ":$port fixed — (k)ill pid $pid, (a)bort" "a") || exit 1
    case "$ans" in
      k*)
        ans=$(ask "really kill pid $pid ($cmd)? type 'kill' to confirm" "no") || exit 1
        [ "$ans" = "kill" ] || die "aborted by you"
        kill_pid "$pid" "pid $pid ($cmd)"
        return 0
        ;;
      a*) die "aborted by you (hint: $hint)" ;;
      *) say "answer k or a" ;;
    esac
  done
}

# resolve_chopsticks: :3000 is Nigiri-fixed (it cannot jump — the mapping
# lives in Nigiri's own compose files), so the remedy is free-it-and-start
# it, or skip. Chopsticks is soft: a declined confirm or a failed start
# degrades to skip + continue; only an explicit (a)bort — or a confirmed
# kill/stop that fails — aborts. --yes and non-TTY always skip.
resolve_chopsticks() {
  local port=3000 label="chopsticks"
  local found ours pid cmd foreign ans
  found=$(listeners "$port")
  if [ -z "$found" ]; then
    ok ":$port ($label) is free"
    start_chopsticks
    return 0
  fi
  ours=$(our_container_on "$port" | head -1)
  if [ -n "$ours" ]; then
    ok ":$port ($label) is ours already (container $ours) — reusing"
    return 0
  fi
  pid=$(echo "$found" | head -1 | cut -d'|' -f1)
  cmd=$(echo "$found" | head -1 | cut -d'|' -f2)
  foreign=$(foreign_container_on "$port" | head -1)
  if [ -n "$foreign" ]; then
    warn ":$port ($label) is held by FOREIGN container $foreign — chopsticks can't start (and can't jump: Nigiri owns the mapping)"
  else
    warn ":$port ($label) is held by FOREIGN process (pid $pid $cmd) — chopsticks can't start (and can't jump: Nigiri owns the mapping)"
  fi
  say "chopsticks is optional: nothing in our path uses it"
  if [ "$YES" = 1 ]; then
    if [ -n "$CHOP_FIX" ]; then
      say "guided fix confirmed at Q6b — freeing :3000"
      case "$CHOP_FIX" in
        container:*) stop_container "${CHOP_FIX#container:}" ;;
        pid:*) kill_pid "${CHOP_FIX#pid:}" "pid ${CHOP_FIX#pid:} ($cmd)" ;;
      esac
      start_chopsticks
      return 0
    fi
    say "--yes: skipping chopsticks"
    return 0
  fi
  if [ ! -t 0 ]; then
    say "no TTY to ask on: skipping chopsticks"
    return 0
  fi
  while true; do
    ans=$(ask ":$port busy — (f)ree it and start chopsticks, (s)kip, (a)bort" "s") || exit 1
    case "$ans" in
      f*) break ;;
      s*) say "skipping chopsticks"; return 0 ;;
      a*) die "aborted by you" ;;
      *) say "answer f, s, or a" ;;
    esac
  done
  if [ -n "$foreign" ]; then
    ans=$(ask "really stop FOREIGN container $foreign? type 'stop' to confirm" "no") || exit 1
    if [ "$ans" != "stop" ]; then say "skipping chopsticks"; return 0; fi
    stop_container "$foreign"
  else
    ans=$(ask "really kill FOREIGN pid $pid ($cmd)? type 'kill' to confirm" "no") || exit 1
    if [ "$ans" != "kill" ]; then say "skipping chopsticks"; return 0; fi
    kill_pid "$pid" "pid $pid ($cmd)"
  fi
  start_chopsticks
}

# start_chopsticks: bring the container up now :3000 is free. Soft: warn
# and continue on any failure.
start_chopsticks() {
  if [ "$DRY_RUN" = 1 ]; then
    say "would run: docker start chopsticks"
    return 0
  fi
  if ! have docker; then say "no docker: skipping chopsticks"; return 0; fi
  if docker start chopsticks >/dev/null 2>&1; then
    local i
    for i in $(seq 1 15); do
      if curl -s -o /dev/null --max-time 2 http://localhost:3000/ 2>/dev/null; then
        ok "chopsticks is up on :3000"
        return 0
      fi
      sleep 1
    done
    warn "chopsticks started but :3000 never answered — continuing without it"
  else
    warn "'docker start chopsticks' failed (container missing?) — 'nigiri stop && nigiri start' rebuilds it; continuing without it"
  fi
}

# ── [1/6] tooling ─────────────────────────────────────────────────────

if [ "$INTERACTIVE" = 1 ]; then
  questionnaire
fi

echo "crypto-drive boot — mode=$MODE app-port=$APP_PORT$([ "$DRY_RUN" = 1 ] && echo " (DRY RUN)" || true)"
echo "repo: $REPO"

step "1/6" "tooling"
have node || die "node not found — install Node 20+ first"
have npm || die "npm not found"
say "node $(node --version), npm $(npm --version)"
if [ "$MODE" = "regtest" ] || [ "$WITH_DB" = 1 ]; then
  have docker || die "docker not found — needed for mode=$MODE / --with-db"
  docker ps >/dev/null 2>&1 || die "docker daemon is not reachable — start Docker Desktop"
  ok "docker daemon answers"
fi
if [ "$MODE" = "regtest" ]; then
  if have nigiri; then
    ok "nigiri found ($(nigiri --version 2>/dev/null | head -1 || echo version unknown))"
  else
    echo "   Nigiri not installed."
    echo "   Install: curl https://getnigiri.vulpem.com | bash  (needs sudo for /usr/local/bin;"
    echo "            or fetch the binary into ~/.local/bin and add it to PATH)"
    echo "   Then:    nigiri start"
    die "nigiri missing"
  fi
fi

# ── [2/6] ports ───────────────────────────────────────────────────────

step "2/6" "ports"
DEVLOCK="$(own_dev_lock || true)"
DEVLOCK_PID="${DEVLOCK%%|*}"
DEVLOCK_PORT="${DEVLOCK##*|}"
if [ -z "$DEVLOCK" ]; then DEVLOCK_PID=""; DEVLOCK_PORT=""; fi
resolve_jumpable APP_PORT "app"
# A live dev server on ANY other port still blocks us via the repo lock.
if [ -n "$DEVLOCK_PID" ] && [ "$DEVLOCK_PORT" != "$APP_PORT" ]; then
  warn "our own dev server runs on :$DEVLOCK_PORT (pid $DEVLOCK_PID, repo lock) — next dev on :$APP_PORT would refuse to start"
  if [ "$YES" = 1 ]; then
    if [ "$KILL_OURS" = 1 ]; then
      say "--yes --kill-ours: restarting our own dev server on :$APP_PORT"
      kill_pid "$DEVLOCK_PID" "pid $DEVLOCK_PID (dev server :$DEVLOCK_PORT)"
      DEVLOCK_PID=""; DEVLOCK_PORT=""
    else
      die "our own dev server holds the repo lock — re-run with --kill-ours or stop pid $DEVLOCK_PID"
    fi
  else
    while true; do
      ans=$(ask "dev server on :$DEVLOCK_PORT — (r)estart it on :$APP_PORT, (a)bort" "a") || exit 1
      case "$ans" in
        r*)
          say "restarting our own dev server on :$APP_PORT"
          kill_pid "$DEVLOCK_PID" "pid $DEVLOCK_PID (dev server :$DEVLOCK_PORT)"
          DEVLOCK_PID=""; DEVLOCK_PORT=""
          break
          ;;
        a*) die "aborted by you" ;;
        *) say "answer r or a" ;;
      esac
    done
  fi
fi
if [ "$MODE" = "regtest" ]; then
  resolve_jumpable INFRA_PORT "infra-api"
  resolve_fixed 18443 "bitcoind RPC" "Nigiri owns this port"
  resolve_fixed 18444 "bitcoind P2P" "Nigiri owns this port"
  resolve_fixed 30000 "electrs HTTP" "Nigiri owns this port"
  resolve_fixed 50000 "electrs P2P" "Nigiri owns this port"
  resolve_fixed 50003 "electrum-ws" "Nigiri owns this port"
  resolve_chopsticks
  resolve_esplora_port
  if [ -n "$ESPLORA_PORT" ]; then
    say ":5000 (Nigiri Esplora) is skipped — macOS AirPlay owns it; ours runs on :$ESPLORA_PORT (see step 4)"
  else
    say ":5000 (Nigiri Esplora) is skipped — macOS AirPlay owns it; no free port for ours, links use :5000"
  fi
fi
if [ "$WITH_DB" = 1 ]; then
  follow_pg_mapping
  resolve_jumpable PG_PORT "postgres"
fi

# ── [3/6] nigiri ──────────────────────────────────────────────────────

nigiri_up() {
  curl -s -o /dev/null --max-time 3 http://localhost:18443/ 2>/dev/null
}

if [ "$MODE" = "regtest" ]; then
  step "3/6" "nigiri (bitcoind + electrs)"
  if nigiri_up; then
    ok "bitcoind RPC answers on :18443 — Nigiri already running, reusing"
  else
    say "bitcoind RPC is silent — Nigiri needs a start"
    if [ "$DRY_RUN" = 1 ]; then
      say "would run: nigiri start"
    else
      if [ "$YES" = 0 ]; then
        while true; do
          ans=$(ask "start Nigiri now? (y)es / (a)bort" "y") || exit 1
          case "$ans" in
            y*) break ;;
            a*) die "aborted by you" ;;
            *) say "answer y or a" ;;
          esac
        done
      else
        say "--yes: starting Nigiri"
      fi
      export PATH="$HOME/.local/bin:$PATH"
      nigiri start || die "'nigiri start' failed"
      say "waiting for bitcoind RPC (up to ${WAIT_SECS}s)…"
      for _ in $(seq 1 "$WAIT_SECS"); do
        nigiri_up && break
        sleep 1
      done
      nigiri_up || die "bitcoind never answered — check 'docker ps' and Nigiri logs"
      ok "bitcoind RPC answers"
    fi
  fi
fi

# ── [4/6] infra-api ───────────────────────────────────────────────────

infra_ready() {
  # A bare 200 lies: /api/health always 200s and puts readiness in the
  # flags. fund+mine need bitcoind AND the faucet wallet (electrs stays
  # soft — a fresh chain needs a mined block before it leaves sync wait).
  curl -s -H "Authorization: Bearer dev" --max-time 3 \
    "http://localhost:${INFRA_PORT}/api/health" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.exit(j.bitcoind_ready===true&&j.wallet_ready===true?0:1)}catch{process.exit(1)}})"
}

if [ "$MODE" = "regtest" ]; then
  step "4/6" "infra-api (:$INFRA_PORT)"
  if infra_ready; then
    faucet=$(curl -s -H "Authorization: Bearer dev" --max-time 3 \
      "http://localhost:${INFRA_PORT}/api/health" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).faucet_balance)}catch{console.log('?')}})")
    ok "infra-api already healthy (faucet $faucet sats) — reusing"
  else
    say "infra-api is not healthy on :$INFRA_PORT — it needs a (re)start"
    if [ "$DRY_RUN" = 1 ]; then
      say "would run: INFRA_API_PORT=$INFRA_PORT docker compose -f docker-compose.infra-api.yml up -d --build infra-api"
    else
      if [ "$YES" = 0 ]; then
        while true; do
          ans=$(ask "start infra-api now? (y)es / (a)bort" "y") || exit 1
          case "$ans" in
            y*) break ;;
            a*) die "aborted by you" ;;
            *) say "answer y or a" ;;
          esac
        done
      else
        say "--yes: starting infra-api"
      fi
      (
        cd "$REPO" || exit 1
        INFRA_API_PORT="$INFRA_PORT" docker compose -f docker-compose.infra-api.yml up -d --build infra-api || exit 1
      ) || die "infra-api compose failed"
      say "waiting for infra-api health (up to ${WAIT_SECS}s)…"
      for _ in $(seq 1 "$WAIT_SECS"); do
        infra_ready && break
        sleep 1
      done
      infra_ready || die "infra-api never turned healthy — 'docker logs crypto-drive-infra-api-1'"
      ok "infra-api healthy on :$INFRA_PORT"
    fi
  fi
  # Our Esplora UI (soft): the wallet links regtest txs here. Any failure
  # keeps the :5000 fallback — the boot never aborts over the explorer.
  if [ -z "$ESPLORA_PORT" ]; then
    say "no port for our Esplora UI — wallet links use :5000"
  elif esplora_ui_up; then
    ok "esplora-ui already answers on :$ESPLORA_PORT — reusing"
    point_links_at_ours
  elif [ "$DRY_RUN" = 1 ]; then
    say "would run: ESPLORA_PORT=$ESPLORA_PORT docker compose -f docker-compose.infra-api.yml up -d esplora-ui"
    point_links_at_ours
  else
    (
      cd "$REPO" || exit 1
      ESPLORA_PORT="$ESPLORA_PORT" docker compose -f docker-compose.infra-api.yml up -d esplora-ui || exit 1
    ) || warn "esplora-ui compose failed — wallet links use :5000"
    if esplora_ui_up; then
      ok "esplora-ui answers on :$ESPLORA_PORT"
      point_links_at_ours
    else
      say "waiting for esplora-ui (up to 30s)…"
      for _ in $(seq 1 30); do
        esplora_ui_up && break
        sleep 1
      done
      if esplora_ui_up; then
        ok "esplora-ui answers on :$ESPLORA_PORT"
        point_links_at_ours
      else
        warn "esplora-ui never answered — wallet links use :5000"
      fi
    fi
  fi
fi

# ── [5/6] postgres ────────────────────────────────────────────────────

if [ "$WITH_DB" = 1 ]; then
  step "5/6" "postgres (crypto-drive-pg :$PG_PORT)"
  state=$(docker inspect crypto-drive-pg --format '{{.State.Running}}' 2>/dev/null || echo "missing")
  if [ "$state" = "true" ]; then
    ok "crypto-drive-pg already running on :$PG_PORT — reusing"
  elif [ "$state" = "false" ]; then
    say "crypto-drive-pg exists but is stopped"
    if [ "$DRY_RUN" = 1 ]; then
      say "would run: docker start crypto-drive-pg"
    else
      docker start crypto-drive-pg >/dev/null || die "'docker start crypto-drive-pg' failed"
      ok "crypto-drive-pg started on :$PG_PORT"
    fi
  else
    say "crypto-drive-pg does not exist — creating it (recipe from tests/e2e/README.md)"
    if [ "$DRY_RUN" = 1 ]; then
      say "would run: docker run -d --name crypto-drive-pg -p $PG_PORT:5432 --health-cmd='pg_isready -U postgres' -e POSTGRES_PASSWORD=postgres postgres:16"
    else
      docker run -d --name crypto-drive-pg -p "$PG_PORT:5432" \
        --health-cmd="pg_isready -U postgres" --health-interval=10s --health-timeout=5s --health-retries=3 --health-start-period=15s \
        -e POSTGRES_PASSWORD=postgres postgres:16 >/dev/null || die "postgres container failed to start"
      ok "crypto-drive-pg created and running on :$PG_PORT"
    fi
  fi
fi

# ── [6/6] app ─────────────────────────────────────────────────────────

step "6/6" "app"
export APP_PORT
export BITCOIN_MODE="$MODE"
if [ "$MODE" = "regtest" ]; then
  export INFRA_BASE_URL="http://localhost:${INFRA_PORT}"
  export INFRA_SHARED_SECRET=dev
  export ADMIN_MINE_TOKEN=dev
  export ESPLORA_PUBLIC_URL
fi
if [ "$WITH_DB" = 1 ]; then
  export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres"
fi
echo "   env: BITCOIN_MODE=$MODE APP_PORT=$APP_PORT$([ "$MODE" = "regtest" ] && echo " INFRA_BASE_URL=$INFRA_BASE_URL ESPLORA_PUBLIC_URL=$ESPLORA_PUBLIC_URL" || true)$([ "$WITH_DB" = 1 ] && echo " DATABASE_URL=pg:$PG_PORT" || true)"
[ "$JUMPED_APP" = 1 ] && warn "app port jumped — the app will NOT be on :43127"
[ "$JUMPED_INFRA" = 1 ] && warn "infra-api port jumped — INFRA_BASE_URL points at :$INFRA_PORT"
[ "$JUMPED_PG" = 1 ] && warn "postgres port jumped — DATABASE_URL points at :$PG_PORT"
echo "   open:  http://localhost:${APP_PORT}/wallet   (after unlock at /unlock)"
if [ "$DRY_RUN" = 1 ]; then
  say "would exec: next dev --port $APP_PORT"
  echo "DRY RUN complete — nothing was started, killed, or jumped."
  exit 0
fi
cd "$REPO" || die "cannot cd to $REPO"
say "exec: next dev --port $APP_PORT"
exec npx next dev --port "$APP_PORT"
