# Crypto Drive — Course agenda (v2)

**Status:** The Bitcoin track is **content-complete** (6 drives, 26 steps, capstone included). Ethereum, USDT/Tron, and Solana remain scaffolds. Charge-readiness requires the checklist in `docs/charge-ready-checklist.md` — this agenda stays the qualitative bar below it.

**Audience:** Non-tech professionals. Coach tone (learn to drive), never academic.

**UI/UX (locked):** Engaging + intuitive. One clear next step always. Short coach cues, big practice surfaces (explorer, QR deposit, withdraw checklist, seed drill). Feels like a driving lesson UI — not Moodle, not a whitepaper. If a non-tech user has to hunt for “what do I do next?”, the screen fails.

**Visuals (locked):** Every major beat needs **image and/or animation** that shows the thing (address vs key, tx flowing, QR deposit, network picker, mnemonic backup). Text alone is not enough. Prefer simple explainer motion + clear diagrams over stock fluff; 2–3 intentional motions per lesson screen where it helps understanding.

**Theme (locked):** **Light and dark mode** are both first-class. Strong contrast, clear hierarchy, CSS variables for surfaces/text/accents. No “dark-only neon” or washed-out light grey. Toggle (or system preference) without breaking practice UIs or diagrams.

**Icons / symbols (locked):** Crypto-feeling visual language — BTC / ETH / USDT / Tron / Sol marks, wallet, key, QR, chain/network, explorer — used as **wayfinding and teaching markers**. Instantly readable for non-tech users; not a sticker bomb of logos.

**Networks / assets path:** Bitcoin first → Ethereum → stablecoins (USDT) → Tron → Solana. Practice is simulated until we explicitly say otherwise.

---

## Honest bar before taking money

Ship only when a non-tech friend can finish Certified and say: “I know what an address is, I can read a tx on an explorer, I can receive/send on an exchange, I know what a seed phrase is and why it matters, and I won’t send USDT on the wrong network.”

Until then: free demo / waitlist only. No paid Gumroad.

---

## Curriculum spine (what everyone learns)

### Track A — Bitcoin (start here)

Hands-on mental model, not history class.

1. What you’re actually holding (coins vs IOUs — plain language)  
2. **Address** — like an account number; public, safe to share for receive  
3. **Transaction** — send value from A → B; fees as “gas for the road”  
4. **Block explorer** — look up an address/tx; confirm it landed  
5. **Deposit** — exchange/wallet deposit, **QR**, copy address, verify network  
6. **Withdrawal** — send out; double-check address + amount + network  
7. **Keys** — private key vs address (car key vs license plate)  
8. **Mnemonic / seed phrase** — 12/24 words; never share; backup drill (simulated)  
9. Common fails — wrong network, phishing, “support” DMs  

**Milestone ideas (Certified+):** find a tx on an explorer · simulate deposit via QR · simulate withdraw checklist · seed backup drill (offline words, no real funds)

### Track B — Ethereum

1. What ETH is for (gas + asset) in one minute  
2. ETH address vs BTC address (don’t mix)  
3. Gas fees — why the “toll” changes  
4. Explorer (Etherscan-style) — same skills as BTC, new site  
5. Wallet setup mental model (extension / mobile) — simulated  
6. Token vs coin — why USDT can live *on* Ethereum  

**Milestones:** read an ETH tx · gas “too low / ok” judgment · receive ETH (sim)

### Track C — Stablecoins (USDT) + networks

1. What a stablecoin is (dollar-ish, still crypto rails)  
2. **USDT is not one road** — Ethereum vs Tron vs others  
3. **Network picker** — the #1 way people lose money  
4. Deposit/withdraw USDT with network check  
5. Tron (TRC-20) — why fees feel different; Tronscan-style explorer  
6. Red flags — fake USDT, wrong chain, memo/tag where needed  

**Milestones:** pick correct network for a USDT deposit · catch a wrong-network scenario · read a USDT transfer on an explorer

### Track D — Solana

1. Solana in one picture (fast / different address style)  
2. SOL for fees  
3. Explorer basics  
4. Receive / send (sim)  
5. When people use Solana vs Tron vs ETH for stables/transfers  

**Milestones:** identify a Solana address vs others · simulate a SOL/USDC-style receive with network check

### Track E — Hygiene (always on)

Phishing, fake apps, seed screenshots, “connect wallet” traps, test-send small first (concept), who to trust. Woven into A–D, plus a short capstone.

---

## How tiers get this content

| | **Starter** | **Certified Practitioner** | **VIP** |
| --- | --- | --- | --- |
| Tracks A–D lessons + cheat cards | Yes | Yes | Yes |
| Interactive milestones + certs | No (upgrade) | Yes | Yes |
| Capstone “wrong network” drill | Lesson only | Graded sim | Graded sim |
| Ride-along | — | — | 30-min call + private Q&A while they do first real deposit/withdraw *on their own accounts* (we never hold funds) |

**Gumroad still sells the tier**, not individual tracks. Ads → tier → unlock path above.

---

## Build order (replace scaffolding)

1. ~~Rewrite **Track A (Bitcoin)** fully in app + Context guides~~ — done (6 drives, 26 steps, capstone cert)  
2. Track B (Ethereum)  
3. Track C (USDT + Tron)  
4. Track D (Solana)  
5. Polish hygiene + Certified certs per major milestone  
6. Only then: live Gumroad — gated by `docs/charge-ready-checklist.md`  

---

## Out of scope for paid v1

- Trading strategies, leverage, DeFi yield farming  
- Protocol/academic cryptography  
- Real mainnet challenges that require user funds (optional later, with heavy warnings)  
- NFT badges  

---

## Decision log

- 2026-10-13: User rejected thin module content as not chargeable; agenda reset to BTC → ETH → USDT/Tron → Solana for non-tech pros.
