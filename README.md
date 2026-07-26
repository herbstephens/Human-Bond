# 💍 HumanBond

**The first proof-of-humanity partnership protocol — live on World Chain — giving economic standing to the partner the market has always ignored.**

[![World Chain](https://img.shields.io/badge/World%20Chain-Mainnet-6B4FBB?style=flat-square)](https://worldscan.org)
[![World App](https://img.shields.io/badge/World%20App-Live-00C2FF?style=flat-square)](https://worldapp.world)
[![ETHGlobal Lisbon](https://img.shields.io/badge/ETHGlobal-Lisbon%202026-FF4500?style=flat-square)](https://ethglobal.com/events/lisbon2026)
[![MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](./LICENSE)

---

## TL;DR for ETHGlobal Lisbon Judges

**HumanBond is a two-person partnership protocol for World ID–verified humans, live on World Chain Mainnet and in the World App store.** Two humans bond on-chain. A soulbound VowNFT is minted. Work TIME income is split 50/50 automatically — the working partner and the non-market partner (caregiver, homemaker) receive equal shares.

**New at ETHGlobal Lisbon:** each partner has their own Human-Backed AI agent (World AgentKit), anchored to their World ID nullifier and representing their values — learned from on-chain TIME staking and income history. A Partnership Agent mediates disputes between them. When agents agree on a spending decision, both partners must explicitly approve. Agent preference models run on 0G Compute (TEE-sealed — neither partner can see the other's deliberations) and are stored on 0G Storage. Partnership names are registered as ENS subnames: `partner1-partner2.humanbond.eth`.

Three things that matter:

1. **Already live.** Four V2 contracts on World Chain Mainnet. Mini App in World App store — search `HumanBond` right now.
2. **Three AI agents.** Human-Backed Partner Agents (World AgentKit) + a neutral Partnership Agent. Private inference on 0G. Agent identities on ENS.
3. **B2B registry.** The Partnership Registry answers "is this World ID nullifier in an active partnership?" without leaking any PII — queryable by dating platforms and financial institutions.

---

## What We Built at This Hackathon

| Feature | Builder | Description |
|---|---|---|
| `finalizeWorkAndDistribute()` | Leticia | 50/50 Work TIME split on payment receipt — mints TIME and distributes to both partners atomically |
| Partner Agent A + Partner Agent B | Franco | Human-Backed AI agents (World AgentKit), running on 0G Compute (TEE), stored on 0G Storage |
| Partnership Agent | Franco | Neutral mediator agent — reads VowNFT data + TIME history, brokers agreements between agents |
| World NFC Credentials | Franco | Reads passport NFC chip during bond formation — verifies age >18 and jurisdiction. VowNFT records verified attributes. (World Identity Check Beta) |
| Age Grant visualisation | Franco | Shows governance endowment (Age × 365 TIME) and Liquidity Ladder unlock progress |
| ENS subname registration | Franco | `partner1-partner2.humanbond.eth` registered during bond formation; agent ENS identities |

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

### 🤖 World — AgentKit: Human-Backed Agents

Partner Agents are anchored to World ID nullifiers via World AgentKit. Each agent acts exclusively on behalf of its verified human — it can be told apart from a bot because it carries a cryptographic World ID proof. The Partnership Agent can only execute when both Human-Backed Agents consent. This is the core access/authorization model: two verified humans, two agents, one agreement required before any action.

**Why it qualifies:** World AgentKit enables services to tell the difference between "a bot" and "an agent acting on behalf of a real, unique human." Our agents change authorization (Partnership Agent gated on both), economic terms (agent-negotiated spending decisions), and accountability (agreements require sign-off from both World ID–verified humans).

### 🔵 ENS — AI Agent Integration

Three on-chain ENS identities — two partner agents and one partnership agent — registered as subnames under `humanbond.eth`:

- `partner1-agent.humanbond.eth` — Agent A identity
- `partner2-agent.humanbond.eth` — Agent B identity
- `partner1-partner2.humanbond.eth` — Partnership shared address + agent identity

ENS text records store: World ID tier, 0G Storage endpoint for agent memory, agent capabilities, VowNFT pointer. Agents are discoverable and trust-attributed on-chain. Any application can resolve `partner1-partner2.humanbond.eth` to reach the partnership's shared economic identity.

### 🧠 0G — Best AI Product

Each Partner Agent is a private Digital Twin running on 0G Compute (TEE-sealed inference). Neither partner can see the other agent's deliberations — only the output. The preference model is stored encrypted on 0G Storage and evolves over time as the partner's on-chain governance staking and income split history updates. The Partnership Agent's mediation logic also runs on 0G. Every AI action is verifiable on-chain via TEE attestation.

---

## The Agent Architecture

```
Partner A (World ID verified)          Partner B (World ID verified)
         │                                      │
    Agent A                               Agent B
 (0G Compute — TEE sealed)            (0G Compute — TEE sealed)
 Preference model: TIME staking,       Preference model: TIME staking,
 income history, VowNFT milestones     income history, VowNFT milestones
 World AgentKit–backed                 World AgentKit–backed
 ENS: partner1-agent.humanbond.eth     ENS: partner2-agent.humanbond.eth
         │                                      │
         └──────────┬───────────────────────────┘
                    │
            Partnership Agent
         Neutral — serves the bond, not either partner
         Reads: VowNFT data + TIME history from both
         Brokers compromise between Agent A and Agent B
         ENS: partner1-partner2.humanbond.eth
                    │
         Both agents agree
                    │
         ┌──────────┴──────────┐
     Partner A approves        Partner B approves
     (explicit sign-off)       (explicit sign-off)
         └──────────┬──────────┘
                    │
         Transaction executes on World Chain
```

**Why this reduces fighting:** couples fight about money because neither partner feels fully heard. Each partner's agent represents their actual values from on-chain data — not what they claim to want, but what they consistently chose. The Partnership Agent doesn't take sides. It finds the overlap. No execution without explicit consent from both.

---

## The Problem

**The most consequential commitment most humans make runs on 19th-century infrastructure.**

- **The non-market partner is economically invisible.** The caregiver who doesn't earn a wage builds no credit, no pension, no financial record. The formal economy ignores them until the partnership ends.
- **No cryptographic proof of partnership status.** There is no interoperable, privacy-preserving way to verify "I am in a partnership." This gap enables fraud.
- **~30%** of dating app users are in committed relationships. **$300M/year** lost to catfishing. **$1.14B** in romance scam losses reported by the FTC in 2023.

---

## The Solution — Four Primitives

| | | |
|---|---|---|
| 🤝 | **Bond** | Two World ID–verified humans verify (Selfie Check / NFC Credentials / Orb). VowNFT minted soulbound. Bond recorded in Partnership Registry. |
| ⚖️ | **50/50 Split** | `finalizeWorkAndDistribute()` — payment received → Work TIME minted → 50% to worker + 50% to partner. Automatic. No trust required. |
| 🤖 | **Agents** | Human-Backed AI agents (World AgentKit) represent each partner. Partnership Agent mediates. both partners approve spending. Private inference on 0G. |
| 🔍 | **Registry** | `GET /v1/bond-status/{nullifier}` — one query, no PII. Dating platforms verify partnership status without receiving any personal data. |

---

## World Identity Stack

| Tier | Protocol | What it proves |
|---|---|---|
| **Tier 3** ★ | World Orb — Proof of Humanity | Iris biometric · ZK uniqueness · Full governance weight |
| **Tier 2** | NFC Credentials (World beta) | Passport NFC chip · age >18 · jurisdiction |
| **Tier 1** | Selfie Check (World beta) | Liveness detection · confirms real person |

Two separate external nullifiers: `propose-bond` and `accept-bond`. A propose proof cannot be replayed as an accept. World ID is load-bearing — HumanBond cannot exist without it.

---

## Income Split — `finalizeWorkAndDistribute()`

```solidity
// Called when payment is received for verified work
// Mints Work TIME and splits 50/50 between partners
function finalizeWorkAndDistribute(
    bytes32 workerNullifier,
    uint256 workAmount,
    address payerAddress
) external {
    // Verify worker is in active partnership
    // Calculate: workerShare = workAmount * splitBps / 10000
    // Mint TIME to worker wallet (50%)
    // Mint TIME to partner wallet (50%)
    // Record IncomeEvent on-chain
    // Emit IncomeSplit event
}
```

The non-market partner receives TIME automatically — no claim required, no trust required, no asking. See [`docs/income-split.md`](./docs/income-split.md) for full spec.

---

## Partnership Registry API

```
GET /v1/bond-status/{world_id_nullifier}

{
  "bonded": true,
  "since": "2026-01-15",
  "identityTier": 3,
  "ensSubname": "herb-agatha.humanbond.eth"
}
```

No PII. No names. No wallet addresses. Status and tier only. Dating platform integration: 30 minutes. At $0.50–$2 per verification across ~360M global dating app users, 10% penetration = $18M–$72M/year pure B2B revenue. See [`PARTNERSHIP_REGISTRY.md`](./PARTNERSHIP_REGISTRY.md) for full spec.

---

## Repository Structure

```
Human-Bond/
├── README.md                          ← You are here
├── ETHGLOBAL_LISBON.md                ← Prize track descriptions
├── PARTNERSHIP_REGISTRY.md            ← B2B API specification
├── contracts/
│   ├── README.md                      ← Contract documentation
│   └── [Leticia's contracts]          ← HumanBond, VowNFT, MilestoneNFT, TIMEToken
├── miniapp/
│   ├── README.md                      ← Frontend documentation
│   └── [Franco's MiniKit source]      ← Next.js World App Mini App
├── docs/
│   ├── architecture.md
│   ├── time-protocol-integration.md
│   ├── identity-stack.md
│   ├── income-split.md
│   └── agent-architecture.md
├── brand/
└── deck/
```

---

## Team

| | | |
|---|---|---|
| **Herb Stephens** | Protocol design | Co-founder, Democracy Earth Foundation · Portugal · herb@democracy.earth |
| **Leticia Azevedo** | Smart contracts | V2 contracts deployed + income split · [@leticarolina](https://github.com/leticarolina) · Brazil |
| **Franco Amicone** | Frontend + Agents | MiniKit + World AgentKit + 0G + ENS · ETHGlobal Lisbon in-person · Argentina |
| **Francesca** | Culture & Quality | Team cohesion, creative direction, and quality standards · the reason we shipped |
| **Mikhail (Misha)** | Advisor | Founder, hito hardware wallet · hardware wallet infrastructure |
| **Leon** | Project Manager | Operations and coordination · Berlin |

---

## Links

- **Live Mini App:** World App store → search `HumanBond`
- **TIME Protocol:** https://github.com/herbstephens/TIME-Protocol
- **Website:** https://timeprotocol.earth
- **Contact:** herb@democracy.earth

---

*democracy.earth · timeprotocol.earth · ETHGlobal Lisbon · July 24–26, 2026*
