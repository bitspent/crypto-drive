# Crypto Drive — Project Context

Durable brief distilled from `docs/crypto-drive.md`. Source mixes a banking keynote thread and a buildable education product; **the product to build is the beginner crypto course + attestation platform**.

## Product goal

**Brand (locked): Crypto Drive** — same idea as learning to drive a car or ride a bike today: learn how to *use* a crypto wallet (and the path around it) through practice and milestones, not theory class.

Ship a **zero-jargon crypto learning product** (Bitcoin → Ethereum → stablecoins → self-custody → exchange spot trading) sold **only on Gumroad**, with **per-student milestone attestation certificates** that resist casual piracy and drive social sharing.

**Audience / positioning (locked):** Attract **professionals**. Crypto is getting regulated everywhere — waiting is the risk. Learning to use it is like knowing how to drive. Slogan and a dedicated **ad video** (X / LinkedIn / Instagram) come later; product + cert loop first.

**Acquisition (locked):** paid/organic ads on **X, LinkedIn, and Instagram** → Gumroad checkout → course access. No Stripe storefront.

Banking crypto-custody framing in the source is **talk/slide context**, not the app scope unless later promoted.

## Curriculum spine (locked v2)

**Do not take payment until this is real in-app.** Scaffolding modules are not the product.

Path for non-tech pros: **Bitcoin → Ethereum → USDT/stablecoins (incl. Tron) → Solana**, with address / tx / explorer / deposit QR / withdraw / keys / mnemonic as core skills. Full agenda: `docs/course-agenda.md`. Tiers (Starter / Certified / VIP) package how much practice + support, not a different coin list.

## Teaching style (locked)

**Non-academic “learn to drive” coaching.** Crypto Drive = learning wallet skills the way you’d learn to drive: hands on the controls, short cues, milestones that prove you can do the next move — not lectures, textbooks, or exam energy.

- Core metaphor: **drive / ride → use a crypto wallet** (and related money moves)  
- Show, then let them try; short cues over long explainers  
- Real-world analogies over jargon and theory stacks  
- **Milestones** = “can you do it?” (e.g. set up, send, receive, spot trade safely) not “can you recite it?”  
- Copy, UI, and pacing should feel like a patient coach in the passenger seat

## Users

| Segment | Need |
| --- | --- |
| Absolute beginners | Mental models, no tech jargon |
| Serious learners | Proof of completion, accountability (Tier 2) |
| High-touch / non-tech | Wallet setup help, VIP call (Tier 3) |

## Core features (must-haves)

1. **Sequential curriculum** — 4 modules: Foundations → Exchange/Spot → Self-custody → Risk/hygiene  
2. **Tiered access** — Starter / Certified Practitioner / VIP (pricing psychology: decoy toward mid tier)  
3. **Purchase → license unlock** — Gumroad only (webhook / license key) → unique access tied to email/license  
4. **Interactive milestone checks** — practical challenges, not copyable MCQ-only quizzes  
5. **Personalized attestation certs** — name, date, unique hash, public `/verify/[certId]` page  
6. **Social share + ads loop** — graduate share on X / LinkedIn / Instagram; ads on those same channels drive new Gumroad buyers

## Constraints / non-goals

- **Not** a bank custody, trading, or wallet product  
- **Not** deep cryptography / protocol engineering content  
- Avoid static PDF/video-only delivery (easy to leak)  
- Prefer uniqueness per graduate (cert + verify URL) over DRM theatre  
- No product implementation until scoped; this doc is context only  

## Tech hints (from source)

| Layer | Preference |
| --- | --- |
| App | Next.js (App Router) + TypeScript + Tailwind |
| Host | Vercel |
| DB / auth | Supabase (students, milestones, magic link / license) |
| Payments | Gumroad only (license API / webhooks) — no Stripe |
| Certificates | `@vercel/og` / satori → PNG + `/verify/[id]` |
| Build tool | Cursor (preferred over Google AI Studio for the app) |

Schema sketch: `students` (email, license, name) · `milestones` (student, module, passed_at, certificate_hash).

## Open decisions

- **Milestone rigor:** simulated proofs vs real tx / wallet-sign challenges (and liability of asking for real on-chain actions)  
- **True on-chain attestation** (NFT/badge) vs off-chain hash + verify page only  
- **Content authoring:** where lesson video/text lives (in-app vs Gumroad downloads vs CMS)  
- **VIP fulfillment:** scheduling + private channel tooling  
- Whether banking keynote/slides are a **separate deliverable** or course marketing only  

## Future GTM (not now)

- **Gumroad native affiliates** for influencer / graduate referral deals — no custom referral engine in the app. Enable when there is a live product and a few real buyers; optional “graduates who share get an affiliate link” as an ops/deal workflow on top of Gumroad.

## Suggested first build slice

**Licensed learner loop without real payments:**

1. Next.js app: Module 1 lesson shell + one interactive checkpoint  
2. Mock license / magic-link login (hardcoded or env key)  
3. On pass → generate cert image (`@vercel/og`) + `/verify/[certId]` page  
4. Share CTA (X/LinkedIn intent links)  

Defer: Gumroad webhooks, Supabase persistence (can start in-memory/JSON), Tier 3 VIP, Modules 2–4 content, real wallet/tx verification.
