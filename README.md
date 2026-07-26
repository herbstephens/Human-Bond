# 💍 HumanBond

**The first proof-of-humanity partnership protocol — live on World Chain — giving economic standing to the partner the market has always ignored.**

[![World Chain](https://img.shields.io/badge/World%20Chain-Mainnet-6B4FBB?style=flat-square)](https://worldscan.org)
[![World App](https://img.shields.io/badge/World%20App-Live-00C2FF?style=flat-square)](https://worldapp.world)
[![ETHGlobal Lisbon](https://img.shields.io/badge/ETHGlobal-Lisbon%202026-FF4500?style=flat-square)](https://ethglobal.com/events/lisbon2026)
[![MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](./LICENSE)

---

## TL;DR for ETHGlobal Lisbon Judges

**HumanBond is a two-person partnership protocol for World ID–verified humans, live on World Chain Mainnet.** Two humans bond on-chain. A soulbound VowNFT is minted. Income is split 50/50 automatically — the working partner and the non-market partner (caregiver, homemaker) receive equal shares. The partnership is represented by three AI agents: one per partner, one for the bond. When partners disagree, agents mediate. When agents agree, hito hardware wallets approve. The Partnership Registry is the first verifiable, privacy-preserving on-chain record of partnership status — queryable by dating platforms and financial institutions with user consent.

Three things that matter for this hackathon:

1. **We are live on World Chain Mainnet.** Four V2 contracts deployed and verified. HumanBond Mini App live in World App store — search `HumanBond` right now. This is production, not a prototype.
2. **Three AI agents.** Each partner has a Human-Backed AI agent (World AgentKit) representing their values — learned from on-chain TIME staking and income history. A Partnership Agent mediates disputes and executes agreements via Hedera, with both partner agents and both hito hardware wallets required to approve. Agent models stored privately on 0G Compute (TEE-sealed).
3. **B2B revenue engine.** The Partnership Registry is a verification API for the $6B dating app industry — one endpoint answers "is this World ID nullifier in an active partnership?" without leaking PII.

---

## What We Built at This Hackathon

| Feature | Builder | Status |
|---|---|---|
| `finalizeWorkAndDistribute()` — 50/50 Work TIME split on payment receipt | Leticia | ✅ Shipped |
| Partner Agent A + Partner Agent B (World AgentKit, 0G Compute) | Franco | ✅ Shipped |
| Partnership Agent — mediator on Hedera, HCS audit trail | Franco | ✅ Shipped |
| Age Grant visualisation — governance endowment at verification | Franco | ✅ Shipped |
| ENS subname registration — `name1-name2.humanbond.eth` | Franco | ✅ Shipped |

---

## The 3-Sentence Pitch

> *"Open World App right now and search HumanBond — it's live on World Chain Mainnet, the first proof-of-humanity partnership protocol ever deployed."*

> *"For the first time in the history of money, the partner who doesn't earn a wage — the caregiver, the homemaker — has the same economic standing as the one who does, enforced automatically by a smart contract."*

> *"Two World ID–verified humans, one soulbound bond, a 50/50 income split on every payment — and a Partnership Registry API that every dating platform and financial institution on earth is going to want."*

---

## Live Contracts — World Chain Mainnet (V2)

| Contract | Address | Standard |
|---|---|---|
| **HumanBond** | [`0x6494daa4e693F748Eb0a16041ECfCEd51392bB13`](https://worldscan.org/address/0x6494daa4e693F748Eb0a16041ECfCEd51392bB13) | Custom |
| **TIME Token** | [`0x261f6d89491cbadff7813303363a514f4b226a82`](https://worldscan.org/address/0x261f6d89491cbadff7813303363a514f4b226a82) | ERC-20 |
| **VowNFT** | [`0xa1650cc531c2780fb8c006f4b8d314018f7f9ac9`](https://worldscan.org/address/0xa1650cc531c2780fb8c006f4b8d314018f7f9ac9) | ERC-721 soulbound |
| **MilestoneNFT** | [`0x0a2759241d0cb610e3e61db351813ddf8a52f14c`](https://worldscan.org/address/0x0a2759241d0cb610e3e61db351813ddf8a52f14c) | ERC-721 soulbound |

Contracts authored and deployed by [@leticarolina](https://github.com/leticarolina). Verified on worldscan.org.

**Mini App:** live in World App store · search `HumanBond`

---

## Prize Tracks

| Sponsor | Track | What we built |
|---|---|---|
| **World** | AgentKit — Human-Backed Agents ($4,000–8,000) | Partner agents anchored to World ID nullifiers. The Partnership Agent can only execute when both Human-Backed Agents agree. Physical hito wallet approval required for spending. |
| **Hedera** | AI & Agentic Payments ($3,000–6,000) | Partnership Agent executes shared spending via Hedera Scheduled Transactions. Mediation log written to Hedera HCS — immutable, auditable, sub-second settlement. |
| **0G** | Best AI Product ($3,000–6,000) | Partner agents run on 0G Compute (TEE-sealed inference — neither partner sees the other's deliberations). Preference models stored encrypted on 0G Storage. |

See [`ETHGLOBAL_LISBON.md`](./ETHGLOBAL_LISBON.md) for full before/after descriptions for each prize track.

---

## The Agent Architecture

```
Partner A (World ID verified)          Partner B (World ID verified)
         │                                      │
    Agent A                               Agent B
 (0G Compute TEE)                     (0G Compute TEE)
 Preference model from                 Preference model from
 TIME staking + income history         TIME staking + income history
 World AgentKit–backed                 World AgentKit–backed
         │                                      │
         └──────────┬───────────────────────────┘
                    │
            Partnership Agent
         (Hedera Agent Kit)
         Neutral mediator — serves the bond, not either partner
         Logs to Hedera HCS — immutable audit trail
         Executes via Hedera Scheduled Transaction
                    │
         Both agents agree
                    │
         ┌──────────┴──────────┐
    hito wallet A          hito wallet B
    (physical approval)    (physical approval)
         └──────────┬──────────┘
                    │
         Hedera executes — sub-second
```

**Why this matters:** couples fight about money. Most AI agents serve the individual. The Partnership Agent serves the bond — it represents the relationship itself, not either partner. No agent can override the other. Neither can any transaction execute without physical hardware wallet approval from both partners.

---

## The Problem

**The most consequential commitment most humans make runs on 19th-century infrastructure.**

- **The non-market partner is economically invisible.** The caregiver who doesn't earn a wage builds no credit, no pension, no financial standing. The formal economy ignores them entirely — until the partnership ends and it's too late.
- **No cryptographic proof of partnership status.** There is no interoperable, privacy-preserving way to prove "I am in a partnership" or "I am not." This gap bleeds into the dating stack as fraud.
- **~30%** of dating app users are in committed relationships. **$300M/year** lost to catfishing. **$1.14B** in romance scam losses (FTC 2023).

---

## The Solution — Four Primitives

| | | |
|---|---|---|
| 🤝 | **Bond** | Two World ID-verified humans verify identity (Selfie Check / NFC Credentials / Orb). VowNFT minted. Bond recorded in Partnership Registry. |
| ⚖️ | **50/50 Split** | `finalizeWorkAndDistribute()` — when either partner earns Work TIME, 50% auto-routes to the non-working partner. Enforced in code. |
| 🤖 | **Agents** | Each partner has a Human-Backed AI agent. Partnership Agent mediates. hito hardware wallets approve spending. All mediation logged to Hedera HCS. |
| 🔍 | **Registry** | Partnership Registry API: `GET /v1/bond-status/{nullifier}` — one query, no PII exposed. Dating platforms verify partnership status without seeing any personal data. |

---

## World Identity Integration

HumanBond uses three World identity credentials — partners choose based on what's available:

| Tier | Protocol | What it proves |
|---|---|---|
| **Tier 3** ★ | World Orb — Proof of Humanity | Iris biometric · ZK uniqueness proof · Full governance weight |
| **Tier 2** | NFC Credentials (World beta) | Reads passport NFC chip · verifies age >18, jurisdiction |
| **Tier 1** | Selfie Check (World beta) | Liveness detection · confirms real person |

Identity tier recorded immutably in VowNFT. Upgradeable — not downgradeable.

**World ID is load-bearing, not cosmetic.** Two separate external nullifiers: `propose-bond` and `accept-bond` are cryptographically distinct. A `propose` proof cannot be replayed as an `accept`.

---

## Partnership Registry API

```
GET /v1/bond-status/{world_id_nullifier}

Response:
{
  "bonded": true,
  "since": "2026-01-15",
  "identityTier": 3,
  "ensSubname": "herb-agatha.humanbond.eth",
  "chain": "worldchain"
}
```

No PII. No names. No wallet addresses. Just status and tier. Every dating platform on earth can integrate this in 30 minutes.

At $0.50–$2 per verification across ~360M global dating app users, 10% penetration = $18M–$72M/year of pure B2B revenue. Couples register voluntarily (for the income split, the agents, the VowNFT). Dating apps get the registry as a byproduct.

See [`PARTNERSHIP_REGISTRY.md`](./PARTNERSHIP_REGISTRY.md) for the full spec.

---

## TIME Protocol Integration

HumanBond is the first reference application of [TIME Protocol](https://github.com/herbstephens/TIME-Protocol) — the human-anchoring layer where **1 TIME = 1 verified hour of human existence**.

- **Identity:** HumanBond requires both partners to verify via TIME Protocol's identity stack
- **Issuance:** `finalizeWorkAndDistribute()` mints Work TIME and splits 50/50 on receipt
- **Reputation:** VowNFT activity feeds the Partnership Score dimension of TIME Protocol's Reputation Score

See [`docs/time-protocol-integration.md`](./docs/time-protocol-integration.md) for the full integration.

---

## Repository Structure

```
Human-Bond/
├── README.md                     ← You are here
├── ETHGLOBAL_LISBON.md           ← Prize track descriptions
├── PARTNERSHIP_REGISTRY.md       ← B2B API specification
├── contracts/
│   ├── README.md                 ← V2 contract documentation
│   ├── HumanBond.sol             ← Core partnership contract (Leticia)
│   ├── VowNFT.sol                ← Soulbound partnership NFT (Leticia)
│   ├── MilestoneNFT.sol          ← Milestone records (Leticia)
│   └── TIMEToken.sol             ← ERC-20 TIME token (Leticia)
├── miniapp/
│   ├── README.md                 ← MiniKit frontend documentation
│   └── [source]                  ← Next.js MiniKit app (Franco)
├── docs/
│   ├── architecture.md           ← Technical architecture + agent flow
│   ├── time-protocol-integration.md
│   ├── identity-stack.md         ← Selfie Check / NFC / Orb
│   ├── income-split.md           ← 50/50 split mechanics
│   └── the-graph-subgraph.md     ← Partnership Registry subgraph
├── brand/                        ← Logos and visual assets
├── deck/                         ← Pitch deck
└── LICENSE
```

---

## Team

| | | |
|---|---|---|
| **Herb Stephens** | Protocol design | Co-founder, Democracy Earth Foundation · Portugal · herb@democracy.earth |
| **Leticia Azevedo** | Smart contracts | HumanBond V2 deployed · [@leticarolina](https://github.com/leticarolina) · Brazil |
| **Franco Amicone** | Frontend / MiniKit | ETHGlobal Lisbon in-person · Argentina |

---

## Links

- **Live app:** World App store → search `HumanBond`
- **GitHub:** https://github.com/herbstephens/Human-Bond
- **TIME Protocol:** https://github.com/herbstephens/TIME-Protocol
- **Website:** https://timeprotocol.earth
- **Contact:** herb@democracy.earth

---

*democracy.earth · timeprotocol.earth · ETHGlobal Lisbon · July 24–26, 2026*
