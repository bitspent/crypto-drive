# Crypto Drive — First slice plan

Build the licensed learner loop with coach tone. Defer slogan, ad video, and live Gumroad until the loop feels right.

## Positioning (product copy)

- Professionals who see regulation coming and don’t want to be the ones who never learned to drive
- Not academic; not “crypto Twitter.” Coach in the passenger seat
- Slogan + ad video: later workstream for X / LinkedIn / Instagram

## Slice goal

A professional can unlock Module 1 (mock license), practice one hands-on wallet milestone, earn a personalized cert, open a public verify page, and hit share CTAs.

## In scope

1. **Next.js app** (App Router, TS, Tailwind) — Crypto Drive brand, drive/wallet metaphor
2. **Landing** — short pitch → “Get the course on Gumroad” (placeholder URL) + “I have a license” entry
3. **Unlock** — mock license / access key (env or hardcoded demo key); real Gumroad webhook later
4. **Module 1 shell** — short coach cues + one interactive checkpoint (simulated wallet practice)
5. **Cert** — name + date + unique id; `@vercel/og` (or equivalent) image
6. **`/verify/[id]`** — public attestation page
7. **Share** — X / LinkedIn / Instagram intent or copy links

## Out of scope (this slice)

- Live Gumroad products / webhooks  
- Real on-chain txs or NFT badges  
- Modules 2–4 full content  
- VIP / Tier 3  
- Ad creative and video  
- Final slogan lock  

## Defaults (confirm or override)

| Topic | Default for slice |
| --- | --- |
| Milestone rigor | **Simulated** practice (safe, no real funds) |
| Attestation | **Off-chain** hash + verify page (no NFT) |
| Content home | **In-app** Module 1 (Gumroad = purchase + license) |
| Persistence | Local/demo store OK; Supabase when Gumroad goes live |
| Tiers | One path for now; tier packaging later |

## Success check

- Demo license → Module 1 → pass checkpoint → cert image → verify URL works when shared  
- Copy reads as pro-facing coach, not classroom  

## How Gumroad publishing works (proposal)

**Gumroad = storefront + license. Crypto Drive app = the course.**

Ads (X / LinkedIn / Instagram) → landing or straight to Gumroad → buyer pays → Gumroad issues a **license key** → buyer opens the app → enters email + license → unlocks modules and milestones → earns cert / verify URL.

### What you list on Gumroad

| Gumroad product | What buyer gets after checkout |
| --- | --- |
| **Crypto Drive — Starter** (v1 can ship one product first) | License key + link to `cryptodrive.app` (or whatever domain) + short “how to unlock” note |
| Later: Certified / VIP as separate products or variants | Same unlock path; app reads tier from Gumroad product/SKU |

Do **not** put the full interactive course as a static Gumroad PDF/zip. Gumroad can host a thin welcome PDF if you want; the real product lives in the app so milestones and certs stay unique per student.

### Technical glue (after first slice)

1. Create the Gumroad product(s) with **license keys enabled**  
2. App endpoint: Gumroad sale / ping webhook → create or update `student` (email, license, tier)  
3. Unlock UI: verify license via Gumroad License API (or our DB after webhook)  
4. Landing CTA: “Get the course” → Gumroad URL; “I already bought” → unlock form  

### This slice vs live Gumroad

- **Now:** mock license so we can build Module 1 → milestone → cert without a live product  
- **Next:** create the Gumroad product, paste real URL, wire webhook + license check  

## After this slice

Wire live Gumroad product + licenses → harden persistence → Modules 2–4 → ad video + slogan creative for X / LinkedIn / Instagram.
