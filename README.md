<h1 align="center">💍 HumanBond</h1>

<p align="center">
  <b>Relationship infrastructure for the verified human internet.</b><br/>
  Two World-ID-verified humans. One cryptographic bond.<br/>
  Soulbound Vow NFT · yearly Milestone NFTs · daily TIME yield · clean-exit divorce.
</p>

<p align="center">
  <a href="https://worldscan.org/address/0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63"><img src="https://img.shields.io/badge/World%20Chain-Mainnet-1A1D3A?style=flat-square" alt="World Chain Mainnet"/></a>
  <a href="#multi-chain-status"><img src="https://img.shields.io/badge/Ethereum-Satellite-627EEA?style=flat-square" alt="Ethereum"/></a>
  <a href="#multi-chain-status"><img src="https://img.shields.io/badge/NEAR-Satellite-00C08B?style=flat-square" alt="NEAR"/></a>
  <a href="#"><img src="https://img.shields.io/badge/World%20Build%203-Finalist-E63946?style=flat-square" alt="World Build 3 Finalist"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="MIT"/></a>
</p>

<p align="center">
  <a href="deck/HumanBond_WorldBuild3.pptx"><b>📊 Pitch Deck</b></a> ·
  <a href="docs/TIME_PROTOCOL_TIEIN.md"><b>⏱ TIME Integration</b></a> ·
  <a href="docs/ARCHITECTURE.md"><b>🏗 Architecture</b></a> ·
  <a href="docs/DATING_APP_API.md"><b>💍 Registry API</b></a> ·
  <a href="docs/DEMO_SCRIPT.md"><b>🎬 Demo</b></a> ·
  <a href="contracts/"><b>🔐 Contracts</b></a>
</p>

---

## TL;DR for World Build 3 Judges

**HumanBond is a two-person DAO for World-ID-verified humans.** Two humans propose and accept on-chain. A deterministic marriage ID is generated. Two soulbound Vow NFTs are minted. The couple earns **1 TIME token per day together**, claimable anytime, split 50/50. Each year, they can mint a soulbound Milestone NFT. Either partner can initiate divorce — pending yield auto-distributes, history is preserved, and after a 30-day cooldown both parties can remarry.

Three things that matter for this hackathon:

1. **World ID is load-bearing, not cosmetic.** HumanBond is definitionally impossible without proof of personhood. We use two separate external nullifiers (`propose-bond` and `accept-bond`), Orb-only (Group ID 1), with replay-proof indexing. Every bond = two unique humans, verified.
2. **We are already live on World Chain mainnet.** Four contracts deployed and verified by [@leticarolina](https://github.com/leticarolina). **TIME is minting right now.** This isn't a roadmap — it's production.
3. **There's a hidden B2B revenue engine.** The marriage registry is a verification API for the $6B dating app industry — solving the $300M/year catfishing-and-secretly-married fraud problem with a single `GET /v1/bond-status/{nullifier}` endpoint. See the [Registry API spec](docs/DATING_APP_API.md).

---

## What's Live On-Chain — World Chain Mainnet

| Contract | Purpose | Address |
|---|---|---|
| **HumanBond** | Core engine (propose, accept, yield, milestones, divorce) | [`0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63`](https://worldscan.org/address/0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63) |
| **VowNFT** | Dynamic soulbound NFT minted at marriage | [`0x8c64c304854F9284ddb976918dF37Bd4f5949F22`](https://worldscan.org/address/0x8c64c304854F9284ddb976918dF37Bd4f5949F22) |
| **MilestoneNFT** | Yearly anniversary soulbound NFTs | [`0x566c4a366625F08A714dd092f8bD2F0E86f906f5`](https://worldscan.org/address/0x566c4a366625F08A714dd092f8bD2F0E86f906f5) |
| **TIME Token** | ERC-20 relationship-longevity yield | [`0x39e629681a9db65D9352961d8dCD4C96C4A1169a`](https://worldscan.org/address/0x39e629681a9db65D9352961d8dCD4C96C4A1169a) |

Full source in [`contracts/`](contracts/). Canonical author: [@leticarolina](https://github.com/leticarolina/worldid-marriage-protocol).

---

## The Problem

**Marriage — the most consequential contract most humans sign — runs on 19th-century infrastructure.**

- **Financial opacity.** Joint finances require trust that cannot be verified, enforced, or audited. Most couples never see shared books.
- **Exit costs.** The average US divorce costs **$15,000–$20,000** and takes **12+ months**. Lawyers are the largest beneficiary of every broken contract.
- **No cryptographic proof.** There is no interoperable, privacy-preserving way to prove "I am married" or "I am not married." This gap bleeds into the dating stack as fraud.

And the dating stack itself is bleeding:

- **~30%** of users on major dating apps are married or in relationships
- **~$300M/year** lost to catfishing on dating platforms
- **$1.14B** in romance-scam losses reported by the FTC in 2023

The verified-human internet doesn't just want better matching. It wants **cryptographic proof of relationship status.**

---

## The Solution — Four Primitives

| | | |
|---|---|---|
| 🤝 | **Bond** | Two World IDs co-sign. Deterministic `marriageId = keccak256(sortedAddresses)`. Two soulbound Vow NFTs minted. 1 TIME each as a welcome. |
| ⏱ | **Daily Yield** | 1 TIME per day together, claimable anytime, split 50/50. Simple, legible, on-chain proof of time shared. |
| 🏆 | **Milestones** | Soulbound Milestone NFT every year. Catch-up minting supported — the couple never loses a year. Upgradeable art registry per year. |
| ⚖️ | **Clean-Exit Divorce** | Either partner initiates. Pending yield auto-splits. History preserved (no deletion). 30-day cooldown. No lawyers. |

Everything cascades from one foundation: **two unique humans, proven by World ID.**

---

## Why World ID Is Load-Bearing

Most hackathon projects bolt World ID on. HumanBond **cannot exist without it.**

- **One human, one active bond.** World ID's nullifier prevents the same human from bonding to two partners simultaneously. Wallet addresses can't do this — a wallet is cheap; a verified human is unique.
- **No sybil couples.** A rug-pull "marriage" between the same person and a fresh wallet is structurally impossible.
- **Two separate external nullifiers** — `propose-bond` and `accept-bond` are cryptographically distinct action domains. A `propose` proof cannot be replayed as an `accept`, and vice versa.
- **Orb-only (Group ID 1).** We do not accept Device-level verification. This is a legal-adjacent commitment; we want the strongest available proof of personhood.

World ID isn't a feature of HumanBond. It's the foundation.

---

## Multi-Chain Status

**World Chain is the canonical registry.** All marriage state, nullifier records, and TIME yield originate here. Ethereum and NEAR deployments are satellites — they mirror the registry for interop and liquidity, with day-scoped chain-agnostic nullifiers preventing double-mint of TIME across chains.

| Chain | Role | Status |
|---|---|---|
| **World Chain** | Canonical registry + World ID verification | ✅ **Mainnet, live** |
| **Ethereum** | Satellite registry + liquidity venue for TIME | 🟡 Deployed, syncing |
| **NEAR** | Satellite registry + cheap read access | 🟡 Deployed, syncing |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full multi-chain model.

---

## The Business — Dual Revenue Engine

### B2C · Wealth coordination for couples
Subscription for premium treasury features (auto-budget, tax exports, inheritance routing). Integration fees with wealth managers via the [Lineal](https://github.com/herbstephens) RIA channel. Soulbound Vow and Milestone NFTs create irreplaceable sentiment + lock-in.

### B2B · Verification API for dating apps
**This is the slide we want judges to remember.**

The dating app industry did **$6B in revenue in 2024**, projected to reach **$25B by 2032**. Its largest unsolved problem is identity fraud. HumanBond is the first cryptographic registry that can answer *"is this person currently bonded?"* without leaking any PII.

One endpoint:

```http
GET /v1/bond-status/{world_id_nullifier}
→ { "bonded": true, "since": "2024-03-14", "chain": "worldchain" }
```

At **$0.50–$2 per verification** across **~360M global dating-app users**, even **10% penetration** yields **$18M–$72M/year** of pure B2B revenue — without changing the couple-facing product. See [`docs/DATING_APP_API.md`](docs/DATING_APP_API.md) for the full spec, pricing tiers, and integration SDK.

**The genius of the flywheel:** couples register *voluntarily* (for wealth coordination, insurance, inheritance, the sentimental Vow NFT). Dating apps then get access to a real registry as a byproduct. Every new bond compounds the value for every dating app that queries.

---

## TIME Protocol Tie-In

HumanBond ships with the **first live deployment of the TIME token** — the economic primitive where **1 TIME = 1 hour of verified human existence**, targeting a January 1, 2034 Schelling point.

**Shipped today:** every active bond mints **1 TIME per day together**, split 50/50 on claim. This is the relationship-longevity flavor of TIME — time shared, proven on-chain.

**Roadmap (post-Seoul):** bonds become the vehicle for the broader TIME thesis. When a bonded couple earns income through labor, they can submit a **WorkNFT** attesting to hours contributed, and the HumanBond contract mints proportional TIME into the couple's shared balance. See [`docs/TIME_PROTOCOL_TIEIN.md`](docs/TIME_PROTOCOL_TIEIN.md) for the simplified architecture and the full roadmap.

Why this matters for World Build 3: HumanBond and TIME together turn a verified human's *time* — the one thing every person has equally — into a liquid, cross-chain economic asset. The bond is the vehicle that aggregates, witnesses, and distributes it.

---

## Traction Snapshot

- ✅ **4 contracts live** on World Chain mainnet, verified on worldscan
- ✅ **TIME token actively minting** — 1 TIME/day per active bond
- ✅ **Soulbound Vow NFTs** with dynamic on-chain metadata (no IPFS failure risk for core data)
- ✅ **Milestone NFT registry** with upgradeable per-year art
- ✅ **Multi-chain satellites:** Ethereum + NEAR deployed, syncing to World Chain canonical
- ✅ **Mini App prototype** running in World App ([live URL](https://tim-edao-marriage-proof.vercel.app), rebranding from marriagePROOF)
- ✅ Evolved from ETHGlobal Buenos Aires 2025 ([Marriage-DAO](https://github.com/herbstephens/Marriage-DAO)) → Leticia's production V2 refactor
- 🎯 Targeting: Seoul Build Week (May 10–18) → 3-month virtual program → SF Demo Day

---

## Team

| | | |
|---|---|---|
| **Herb Stephens** | Founder & Product | Co-founder, Democracy Earth Foundation · author of *The Lie of Investing* · `herbstephens.eth` |
| **Leticia Azevedo** | Lead Smart Contracts | Deployed all 4 World Chain contracts · [@leticarolina](https://github.com/leticarolina) · [@letiweb3](https://x.com/letiweb3) · Brazil |
| **Franco Amicone** | Front-end | Mini App lead · Next.js · MiniKit 2.0 · Argentina |

| **Santi Siri** | Full-stack | Co-founder Democracy.Earth | Advisor · Argentina |
| **Axel Ország-Krisz** | Full-stack | Cross-chain infrastructure · team member at ETH Global Buenos Aires v1 · Hungary |

---

## Repository Map

```
humanbond-worldbuild3/
├── README.md                     ← you are here
├── deck/
│   └── HumanBond_WorldBuild3.pptx
├── docs/
│   ├── TIME_PROTOCOL_TIEIN.md    ← simplified TIME integration
│   ├── ARCHITECTURE.md           ← multi-chain technical architecture
│   ├── DATING_APP_API.md         ← B2B verification API spec
│   ├── DEMO_SCRIPT.md            ← 2-minute demo walkthrough
│   └── ROADMAP.md                ← post-hackathon plan
├── contracts/                    ← Solidity (authored by Leticia)
│   ├── src/                      ← HumanBond, VowNFT, MilestoneNFT, TimeToken
│   ├── script/Deploy.s.sol
│   ├── test/                     ← Foundry tests
│   ├── metadata/                 ← IPFS NFT metadata
│   └── foundry.toml
├── miniapp/                      ← World App Mini App (WIP)
└── brand/                        ← logos, colors, visual assets
```

---

## Quick Links for Judges

- 📊 **[Pitch Deck (PPTX)](deck/HumanBond_WorldBuild3.pptx)**
- 🎬 **[Demo Script (2 min)](docs/DEMO_SCRIPT.md)**
- ⏱ **[TIME Protocol Integration](docs/TIME_PROTOCOL_TIEIN.md)**
- 🏗 **[Technical Architecture](docs/ARCHITECTURE.md)**
- 💍 **[Dating App Registry API](docs/DATING_APP_API.md)**
- 🗺 **[Post-Hackathon Roadmap](docs/ROADMAP.md)**
- 🔐 **[Contracts & Deployment](contracts/)**
- 🔗 **[Leticia's canonical contract repo](https://github.com/leticarolina/worldid-marriage-protocol)**

---

<p align="center">
  <i>Built for World Build 3 · April 2026 · by humans, for humans.</i>
</p>
