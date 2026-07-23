# HumanBond

**The first proof-of-humanity partnership protocol — live on World Chain — giving economic standing to the partner the market has always ignored.**

[![World Chain](https://img.shields.io/badge/World%20Chain-Mainnet-6B4FBB?style=flat-square)](https://worldscan.org)
[![World App](https://img.shields.io/badge/World%20App-Live-00C2FF?style=flat-square)](https://worldapp.world)
[![ETHGlobal Lisbon](https://img.shields.io/badge/ETHGlobal-Lisbon%202026-FF4500?style=flat-square)](https://ethglobal.com/events/lisbon2026)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](./LICENSE)

---

## What Is HumanBond?

HumanBond is a two-person partnership protocol built on the TIME Protocol. Two World ID–verified humans form an on-chain bond — anchored to biometric proof of unique humanity, not just wallet addresses. When either partner earns income through TIME Protocol, a 50/50 split is enforced automatically on-chain: the working partner and the non-market partner — the caregiver, the homemaker, the person whose contribution the formal economy has never recognised — receive equal shares.

**This is not a philosophical gesture. It is a smart contract.**

Beyond the bond itself, HumanBond exposes a **Partnership Registry API** — a verifiable, privacy-preserving on-chain record of partnership status that dating platforms, financial services, and legal systems can query with user consent.

> *"Open World App right now and search HumanBond — it's live on World Chain Mainnet, the first proof-of-humanity partnership protocol ever deployed."*

---

## Live Deployments — World Chain Mainnet

| Contract | Address | Standard |
|---|---|---|
| **HumanBond** | `0x6494daa4e693F748Eb0a16041ECfCEd51392bB13` | Custom |
| **TIME Token** | `0x261f6d89491cbadff7813303363a514f4b226a82` | ERC-20 |
| **VowNFT** | `0xa1650cc531c2780fb8c006f4b8d314018f7f9ac9` | ERC-721 soulbound |
| **MilestoneNFT** | `0x0a2759241d0cb610e3e61db351813ddf8a52f14c` | ERC-721 soulbound |

Contracts authored and deployed by [@leticarolina](https://github.com/leticarolina). Verified on [worldscan.org](https://worldscan.org).

**Mini App:** live in the World App store · search `HumanBond`

---

## ETHGlobal Lisbon 2026 — July 24–26

HumanBond is our submission to **ETHGlobal Lisbon** under the **Continuity Track** — recognising that the most interesting work onchain is sustained, ongoing software with real users, not just 36-hour demos.

**What we're building at the hackathon:**
- Income split feature: `finalizeWorkAndDistribute()` — 50/50 Work TIME split on payment receipt (Leticia)
- Age Grant visualisation UI — showing governance endowment at verification (Franco)
- ENS subname integration — `partner1-partner2.humanbond.eth` shared receiving address (Franco)
- Walrus storage — permanent VowNFT metadata and partnership charter (Franco)
- The Graph subgraph — Partnership Registry queryable by any application

**Prize tracks:**

| Sponsor | Track | Prize |
|---|---|---|
| **World** | Selfie Check Beta | $3,500 |
| **World** | Identity Check (NFC) Beta | $3,500 |
| **ENS** | Best ENS Continuity Integration | $2,000 |
| **Sui / Walrus** | Best existing app integrating Sui stack | $2,000 |
| **The Graph** | Best Composable/Standardized Graph Products | $4,000 |

See [`ETHGLOBAL_LISBON.md`](./ETHGLOBAL_LISBON.md) for full prize track descriptions.

---

## How HumanBond Uses TIME Protocol

HumanBond is the first reference application of [TIME Protocol](https://github.com/herbstephens/TIME-Protocol) — the human-anchoring layer for an AI-dominant economy.

```
TIME Protocol provides:
  ├── Identity Stack (Selfie Check → NFC → World Orb)
  │     └── HumanBond requires both partners to verify
  ├── Issuance Engine (Work TIME ≤ 23/day)
  │     └── HumanBond splits Work TIME 50/50 on payment receipt
  └── Reputation Score (Partnership dimension)
        └── HumanBond VowNFT activity builds Partnership Score
```

See [`docs/time-protocol-integration.md`](./docs/time-protocol-integration.md) for the full integration spec.

---

## Repository Structure

```
Human-Bond/
├── README.md                           ← You are here
├── ETHGLOBAL_LISBON.md                 ← Prize track descriptions
├── PARTNERSHIP_REGISTRY.md             ← B2B API specification
├── contracts/
│   ├── README.md                       ← Contract documentation
│   ├── HumanBond.sol                   ← Core partnership contract (Leticia)
│   ├── VowNFT.sol                      ← Soulbound partnership NFT (Leticia)
│   ├── MilestoneNFT.sol                ← Milestone records (Leticia)
│   └── TIMEToken.sol                   ← ERC-20 TIME token (Leticia)
├── miniapp/
│   ├── README.md                       ← MiniKit frontend documentation
│   └── [Franco's MiniKit source]       ← Frontend code (Franco)
└── docs/
    ├── architecture.md                 ← Full technical architecture
    ├── time-protocol-integration.md    ← TIME Protocol integration spec
    ├── identity-stack.md               ← World identity verification tiers
    ├── income-split.md                 ← 50/50 split mechanics
    └── the-graph-subgraph.md           ← Partnership Registry subgraph
```

---

## The 3-Sentence Pitch

> *"Open World App right now and search HumanBond — it's live on World Chain Mainnet, the first proof-of-humanity partnership protocol ever deployed."*

> *"For the first time in the history of money, the partner who doesn't earn a wage — the caregiver, the homemaker — has the same economic standing as the one who does, enforced automatically by a smart contract."*

> *"Two World ID–verified humans, one soulbound bond, a 50/50 income split on every payment — and a Partnership Registry API that every dating platform and financial institution on earth is going to want."*

---

## Team

**Herb Stephens** — Protocol design, TIME Protocol architecture. Co-founder, Democracy Earth Foundation. herb@democracy.earth

**Franco** — Frontend / MiniKit. Lead developer, HumanBond Mini App. ETHGlobal Lisbon in-person.

**Leticia** — Smart contracts. HumanBond V2 deployed and verified on World Chain Mainnet.

---

## Part of TIME Protocol

HumanBond is a reference application of TIME Protocol. The protocol stack:

- **[TIME Protocol](https://github.com/herbstephens/TIME-Protocol)** — The human-anchoring layer. 1 TIME = 1 verified hour of human existence.
- **HumanBond** — Partnership protocol. 50/50 income split. Partnership Registry.
- **VolunteerPROOF** — Civic contribution credentialing. *(in development)*
- **Governance Agent** — Always-on preference signalling. *(in development — Soroban)*
- **Utility Concierge** — Anti-authoritarian infrastructure. *(specified — Oslo Freedom Forum 2027)*

---

## License

MIT — all code open source.

---

*democracy.earth · timeprotocol.earth · July 2026*
