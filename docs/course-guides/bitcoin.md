# Bitcoin track guide (Track A)

**Status:** First drive is what ships. Five locked stops, one screen at a time, one certificate at the road test. Practice values are unique per license. ETH / USDT / Tron / Solana remain scaffolds. Do not charge yet.

**Audience:** Non-tech professionals. Coach tone (“learn to drive”), never academic.

**App route:** `/track/bitcoin` (after unlock). Content source: `content/tracks/bitcoin.json`.

**Promise:** By the end you know what Bitcoin is, you can receive it, prove it arrived, and send a small amount without giving your keys away. About 35 minutes. Play money only.

---

## The road

| Stop | Route | What they do |
| --- | --- | --- |
| 1 · What Bitcoin is | `/track/bitcoin/what-is/…` | Satoshi, 21M, blocks, halving, sats, unspent cheques, change |
| 2 · Get paid | `/track/bitcoin/get-paid/…` | Copy *their* address, check the ends, wait until the receipt says landed, then read a famous real tx on mempool.space |
| 3 · Send a little | `/track/bitcoin/send/…` | Reject a swapped ending, leave room for the toll, send a tiny test |
| 4 · Guard the car | `/track/bitcoin/guard/…` | Share the address vs the key, write and recall *their* 12 words |
| 5 · Road test | `/track/bitcoin/road-test/…` | Close a fake support chat, switch off Ethereum, stop a bad send |

The next stop stays locked until the current one is done. Earlier stops stay open for review. Someone who finished an older Bitcoin road is sent through stop 1 first; later stops they already passed stay passed.

**Play money for personal drills** — no real funds, no funded-mainnet challenges. Address, receipt, fees, cheques, and seed words are derived from the learner’s email + license. The get-paid **explorer** step is different: deep-link to a verified famous mainnet tx on mempool.space (Model A; no live API). Quiet “Play money — not real Bitcoin” tag on get-paid / send / guard / road-test (not on what-is).

---

## Tier gating

Flags in `content/tiers/*.json`: `certificate`, `verifyLink`, `liveCall`. All tiers walk every step; only the certificate is gated.

| | Starter | Certified / VIP |
| --- | --- | --- |
| All six drives, all steps | Yes | Yes |
| Capstone certificate + `/verify` | No (upgrade at the end) | Yes (`certificate` + `verifyLink`). Asking again opens the same one. |
| VIP live call | No | VIP only (`liveCall`) |

Demo keys: `CD-DRIVE-STARTER` · `CD-DRIVE-2026` (Certified) · `CD-DRIVE-VIP`.

---

## How to demo

1. Open the app → **I have a license**
2. Email any + `CD-DRIVE-2026`
3. Course map → **Continue Bitcoin**
4. Walk stop 1 (protocol), then get paid → send → guard → road test
5. Certify once. Unlock again with a different email and confirm a different address / word list
6. Starter smoke: unlock with `CD-DRIVE-STARTER` → every screen works → the road test offers an upgrade instead of a certificate

---

## Still scaffolding

- Track B Ethereum, Track C USDT+networks, Track D Tron, Track E Solana (each gets one certificate when built)
- Live Gumroad webhooks / Supabase persistence
- VIP call scheduling fulfillment
