# Stablecoin track outline (Track C) — approved direction, not yet built

Status: direction approved by owner (see Locked decisions). The Bitcoin
track stays the charge-quality product; this doc scopes what "coming next"
means for `content/tracks/usdt-networks.json`.

## Locked decisions

- **Order:** Track C standalone with a two-step ERC-20 primer folded into
  drive 1. Track B (Ethereum) stays scaffolded.
- **Certificate:** one cert per track, each naming what its exam proved, all
  verifiable at /verify.
- **Wallet:** BTC-only for now (option A — Track C drills are view-only:
  read, inspect, refuse; no wallet changes).
- **ETH infra:** dedicated lightweight localnet to be spiked (see below) —
  Track C content does not wait for it.

## The scaffold's promises (already public copy)

- "USDT is not one road" — Ethereum vs Tron vs others
- "Wrong network is the #1 way people lose stables. We'll drill the picker hard."
- Tron (TRC-20) fee feel + explorer
- One USDT certificate at the end of the road

The outline below keeps all four. Anything less breaks the /course tile copy.

## Proposed shape: 3 drives, ~10 steps

1. **One coin, many roads** (~3 steps) — what USDT is (a dollar IOU on
   someone else's chain, not a chain), the three address alphabets the
   learner must tell apart on sight (0x… ERC-20, T… TRC-20, bc1…/1…/3…
   omni-era legacy), and the one rule: the network is part of the address.
2. **The picker drill** (~4 steps) — deposit/withdraw flows where the
   exchange asks "which network?" and the learner must match it to the
   destination address. Reuses proven action types: `address-check` (first/last
   chars per alphabet), `clipboard-mismatch` (exchange says TRC-20, pasted
   address is 0x…), `fee-room` (Tron energy/bandwidth vs Ethereum gas —
   staged prices, same pedagogy as the toll lesson), `explorer-read`
   (tronscan/etherscan links, same Model A read-the-explorer pattern).
3. **Road test + certificate** (~3 steps) — a wrong-network save (the
   capstone moment: refuse a mismatched withdrawal), a stuck-ERC-20 drill
   (same `stuck-fix` shape, gas instead of sats), and one USDT certificate.

New code needed: one action type at most (`network-pick` if the picker
wants a dedicated scene; otherwise the four reuses above cover it), plus
per-network address fixtures in the practice seed. No new state lib, no 3D.

## The wallet question (needs an answer before content)

The practice wallet is BTC-only: one bech32 address, sats balance, BTC
history. A stablecoin track has three options, cheapest first:

- **A. View-only drills (recommended).** Track C never touches the wallet;
  every drill is read/inspect/refuse, like `verify` and `mismatch`. Zero
  wallet changes. The USDT cert proves recognition, not operation.
- **B. A second sandbox.** A parallel USDT practice balance (per-network
  fake addresses) inside the existing wallet UI. Real work: new state
  shape, new send/deposit paths, new exam proofs.
- **C. Real Liquid USDT on regtest.** Nigiri ships chopsticks precisely for
  this (L-USDT faucet). Most faithful, most infra: new provider backend,
  new faucet plumbing, new explorer links. A project, not a step.

A ships with the outline above. B and C are follow-ups with their own prompts.

## Backend posture: simulated-first, like Bitcoin

Bitcoin launched `BITCOIN_MODE=simulated` with regtest as the enterprise
upgrade. Track C should do the same: staged addresses, fees, and explorer
reads on day one; chain-backed drills only if B/C get approved. No live
mainnet API calls in any mode (the Bitcoin track's rule stands).

## Positioning question for the owner

Crypto Drive's brand already says multi-road ("Bitcoin is the
charge-quality track. ETH / USDT / Tron / Solana are coming-next scaffolds").
Two decisions gate this track:

1. **Order: stables next, or Ethereum next?** The scaffold order says
   Ethereum (Track B) before USDT (Track C) — but the USDT picker drill
   needs only "enough ERC-20 to recognize 0x…", not a full Ethereum track.
   Recommendation: build Track C standalone with a two-step ERC-20 primer
   folded into drive 1, leave Track B scaffolded.
2. **Certificate: one per track, or one brand cert?** The scaffold promises
   "one USDT certificate". Recommendation: keep it — per-track certs, each
   naming what its exam proved, all verifiable at /verify.

## ETH localnet spike (next infra step)

Recommendation: **Anvil** (Foundry), not Ganache. One static binary,
starts in under a second, automines, ships 10 prefunded accounts (the
faucet is just an account), `anvil_setBalance` for top-ups, fork mode for
mainnet state, plain JSON-RPC so ethers/viem work unchanged. Ganache is
heavier (Electron lineage, slower) and Hardhat Network is best in-process
for tests rather than as a sidecar service.

Integration shape mirrors Bitcoin exactly: an `EthProvider` with
`simulated | sepolia | local` modes, Sepolia as the public-testnet analog
of signet, and the local mode pointed at Anvil through the same infra-api
pattern (faucet, tx status, mine, fees). Explorer reads stay Model A
(link out to sepolia.etherscan.io / tronscan — no keys, no self-hosted
Blockscout). Tron gets no private net: TRC-20 drills are recognition-only
(address alphabet + picker), which needs no chain.
