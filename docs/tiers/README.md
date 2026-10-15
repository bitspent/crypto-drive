# Crypto Drive — Tier packages

Product packaging is **by tier**, not by dumping Modules 1–4 as the storefront. Modules live *inside* each tier as what that license unlocks.

Gumroad sells the tier SKU. The app reads the license → maps to a tier → shows the right path (lessons, milestones, certs, VIP support).

## Comparison

| | **Starter** | **Certified Practitioner** *(recommended)* | **VIP Vault** |
| --- | --- | --- | --- |
| **Who it’s for** | Price-sensitive pros who want the map first | Serious learners who want proof they can drive | Non-tech / high-touch buyers who want a ride-along |
| **Price band** (source) | $29–$49 | $79–$99 | $249–$399 |
| **Gumroad SKU (later)** | `crypto-drive-starter` | `crypto-drive-certified` | `crypto-drive-vip` |
| **Module 1 — Wallet foundations** | Lesson + cheat sheet | Lesson + **interactive** create/receive/send | Same as Certified |
| **Module 2 — Exchange / spot** | Lesson + cheat sheet | Lesson + **simulated** spot checkpoint | Same as Certified |
| **Module 3 — Self-custody** | Lesson + cheat sheet | Lesson + **simulated** seed/address checkpoint | Same as Certified |
| **Module 4 — Risk / hygiene** | Lesson + cheat sheet | Lesson + **simulated** hygiene checkpoint | Same as Certified |
| **Interactive milestones** | No (upgrade CTA) | Yes | Yes |
| **Attestation certificate + `/verify`** | No | Yes (per passed milestone) | Yes |
| **Social share CTAs** | Soft “share that you started” optional | Yes — cert + verify URL | Yes |
| **Support** | Self-paced | Self-paced + cert loop | **30-min onboarding call** + **private Q&A channel** |
| **Coach pitch** | “Learn the lanes before you merge.” | “Prove you can do the move.” | “I’ll sit shotgun for your first miles.” |

Pricing psychology (from source): Certified is the decoy-target mid tier — high perceived value (milestones + cert) for a step up from Starter. VIP seats limited later (ops scarcity).

## Demo license → tier mapping

Until live Gumroad SKUs wire in, mock keys map like this:

| Demo key | Tier |
| --- | --- |
| `CD-DRIVE-STARTER` | Starter |
| `CD-DRIVE-2026` | **Certified** (default demo — matches existing Slice 1 cert loop) |
| `CD-DRIVE-CERTIFIED` | Certified |
| `CD-DRIVE-VIP` | VIP |

Default for “I have a license” demos: **Certified**, so Module 1 interactive → cert → verify still works out of the box.

## Guides in this folder

- [starter.md](./starter.md) — Self-Paced Starter outline
- [certified.md](./certified.md) — Certified Practitioner outline
- [vip.md](./vip.md) — VIP Vault outline

Repo mirror: `content/tiers/` + shared `content/modules/` (what each tier unlocks).

## What’s *not* a tier

Modules are curriculum units, not products. Do not sell “Module 2 alone” on Gumroad in v1. Ads → Gumroad **tier** → unlock → course path for that tier.
