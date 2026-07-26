# HumanBond Technical Architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     World App Store                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              HumanBond Mini App (Franco)             │   │
│  │   MiniKit SDK · Next.js · World Chain RPC            │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
  ┌─────────────┐  ┌────────────┐  ┌─────────────────┐
  │  World ID   │  │     0G     │  │      ENS        │
  │  ZK Proofs  │  │  Storage   │  │    Subname      │
  │ Selfie/NFC/ │  │            │  │    Registry     │
  │     Orb     │  │            │  │                 │
  └──────┬──────┘  └─────┬──────┘  └────────┬────────┘
         │               │                   │
         └───────────────┼───────────────────┘
                         │
         ┌───────────────▼───────────────────────────┐
         │         World Chain Mainnet (chainId: 480) │
         │                                            │
         │  HumanBond.sol ←→ VowNFT.sol              │
         │       ↓                ↓                   │
         │  MilestoneNFT.sol   TIMEToken.sol          │
         └────────────────────────────────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │         ENS (Ethereum)          │
         │  name1-name2.humanbond.eth      │
         │  → shared receiving address     │
         └─────────────────────────────────┘
```

---

## Bond Formation Flow

```
Partner A                    Partner B
    │                            │
    │ 1. Verify identity         │
    │    (Selfie/NFC/Orb)        │
    │                            │
    │ 2. proposeBond()           │
    │    World ID proof          │
    │    external nullifier:     │
    │    "humanbond-propose"     │
    │                            │
    │ 3. Share partner code ──→  │
    │                            │ 4. Verify identity
    │                            │    (Selfie/NFC/Orb)
    │                            │
    │                            │ 5. acceptBond()
    │                            │    World ID proof
    │                            │    external nullifier:
    │                            │    "humanbond-accept"
    │                            │
    │  ←──── VowNFT minted ──────│
    │                            │
    │ 6. Register ENS subname    │
    │    name1-name2.humanbond.eth│
    │                            │
    │ 7. Store charter on Walrus │
    │    → blobId saved in       │
    │      VowNFT tokenURI       │
    │                            │
    │  BOND ACTIVE               │
```

---

## Income Split Flow

```
Client/Payer
    │
    │ pays for work
    ▼
HumanBond.finalizeWorkAndDistribute(
    workerNullifier,
    workAmount,
    payerAddress,
    workVerificationHash
)
    │
    ├── verify: worker is in active partnership
    │
    ├── calculate split:
    │     workerShare = workAmount × 50%
    │     partnerShare = workAmount × 50%
    │
    ├── TIMEToken.mint(workerWallet, workerShare)
    ├── TIMEToken.mint(partnerWallet, partnerShare)
    │
    ├── emit IncomeSplit(vowNFTId, workerShare, partnerShare, payer)
    │
    └── record in incomeRecords[vowNFTId]
            │
            ▼
    The Graph indexes the event
    → available via subgraph query
    → available in Mini App dashboard
```

---

## Identity Architecture

HumanBond uses three World identity credentials, selected during bond formation:

```
Tier 3: World Orb (Proof of Humanity)
  ├── Iris biometric scan
  ├── ZK proof of unique humanity
  ├── Full governance weight in TIME Protocol
  └── Strongest sybil resistance

Tier 2: NFC Credentials (World beta)
  ├── Reads NFC chip from biometric passport
  ├── Verifies: age >18, jurisdiction
  ├── Document-backed identity
  └── Enhanced sybil resistance

Tier 1: Selfie Check (World beta)
  ├── Selfie liveness detection
  ├── Confirms real, live person
  ├── Standard weight
  └── No ID required — friction-free entry

Tier 0: (future) Peer Vouching
  ├── 3 verified HumanBond partners attest identity
  └── Entry level — lowest friction
```

Identity tiers are recorded immutably in the VowNFT at bond formation. Can be upgraded (not downgraded) by re-verifying with higher tier credentials.

---

## World ID External Nullifiers

HumanBond uses two separate external nullifiers to prevent proof replay:

```javascript
// Propose action
const PROPOSE_NULLIFIER = keccak256("humanbond-propose-v2")

// Accept action
const ACCEPT_NULLIFIER = keccak256("humanbond-accept-v2")
```

A proof generated for the propose action cannot be replayed as an accept. Both nullifiers are checked against World ID's used-proof registry to prevent double-spending.

---

## Walrus Storage Schema

```
blobId = store({
  name: "HumanBond Partnership Charter",
  version: "2.0",
  bondedAt: 1717200000,
  partnerA: {
    nullifierHash: "0x...",  // World ID nullifier, privacy-preserving
    identityTier: 3,
    verifiedAt: 1717200000,
  },
  partnerB: {
    nullifierHash: "0x...",
    identityTier: 2,
    verifiedAt: 1717200000,
  },
  splitBps: 5000,             // 50/50
  ensSubname: "herb-agatha.humanbond.eth",
  jurisdiction: "PT",         // from NFC credentials (if available)
  charter: "[optional text]", // partnership description / vows
  incomeHistory: [],          // updated off-chain via The Graph
})
```

VowNFT tokenURI: `walrus://[blobId]`

---

## ENS Architecture

```
humanbond.eth (parent name, controlled by HumanBond protocol)
    │
    ├── herb-agatha.humanbond.eth
    │       resolution: 0x[shared address]
    │       text records:
    │           vowNFT: "0xa1650cc5...:#42"
    │           identityTierA: "3"
    │           identityTierB: "2"
    │           timeProtocol: "splitBps=5000"
    │           walrusCharter: "walrus://[blobId]"
    │
    └── [every HumanBond partnership gets a subname]
```

The "shared address" is a multisig or shared wallet controlled by both partners. Or: the ENS name resolves to the HumanBond contract address, which routes payments to the split function.

---

## The Graph Subgraph Schema

```graphql
type Partnership @entity {
  id: ID!                          # vowNFT token ID
  partnerANullifier: Bytes!
  partnerBNullifier: Bytes!
  vowNFTTokenId: BigInt!
  bondedAt: BigInt!
  identityTierA: Int!
  identityTierB: Int!
  active: Boolean!
  splitBps: Int!
  ensSubname: String
  charterWalrus: String
  milestones: [Milestone!]! @derivedFrom(field: "partnership")
  incomeSplits: [IncomeSplit!]! @derivedFrom(field: "partnership")
}

type IncomeSplit @entity {
  id: ID!                          # txHash-logIndex
  partnership: Partnership!
  amount: BigInt!
  workerShare: BigInt!
  partnerShare: BigInt!
  payerAddress: Bytes!
  timestamp: BigInt!
  txHash: Bytes!
}

type Milestone @entity {
  id: ID!
  partnership: Partnership!
  tokenId: BigInt!
  description: String!
  completedAt: BigInt!
  metadataWalrus: String
}
```

---

*democracy.earth · timeprotocol.earth · July 2026*
