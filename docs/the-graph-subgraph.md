# The Graph — Partnership Registry Subgraph

HumanBond publishes a standardised Partnership Registry subgraph on The Graph. Any application can query partnership status, income history, and milestone records in real time — without running their own World Chain node.

**ETHGlobal Lisbon:** targeting "Best Use of Composable or Standardized Graph Data Products" ($4,000).

---

## Subgraph Details

| Field | Value |
|---|---|
| Network | World Chain Mainnet |
| Deployment | ETHGlobal Lisbon — July 2026 |
| Endpoint | `https://api.thegraph.com/subgraphs/name/humanbond/partnership-registry` |
| Explorer | https://thegraph.com/explorer/subgraphs/humanbond |

---

## Schema

```graphql
type Partnership @entity {
  id: ID!                          # VowNFT token ID (hex string)
  partnerANullifier: Bytes!        # World ID nullifier — privacy-preserving
  partnerBNullifier: Bytes!
  vowNFTTokenId: BigInt!
  bondedAt: BigInt!                # Unix timestamp
  dissolvedAt: BigInt              # null if still active
  identityTierA: Int!              # 1=Selfie, 2=NFC, 3=Orb
  identityTierB: Int!
  active: Boolean!
  splitBps: Int!                   # 5000 = 50/50
  ensSubname: String               # e.g. "herb-agatha.humanbond.eth"
  charterWalrus: String            # Walrus blob ID for charter
  txHash: Bytes!                   # Bond formation tx
  milestones: [Milestone!]! @derivedFrom(field: "partnership")
  incomeSplits: [IncomeSplit!]! @derivedFrom(field: "partnership")
}

type IncomeSplit @entity {
  id: ID!                          # txHash-logIndex
  partnership: Partnership!
  grossAmount: BigInt!
  workerNullifier: Bytes!
  partnerNullifier: Bytes!
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
  txHash: Bytes!
}

type IdentityTierUpgrade @entity {
  id: ID!
  partnership: Partnership!
  nullifier: Bytes!
  fromTier: Int!
  toTier: Int!
  upgradedAt: BigInt!
}

# Protocol-level stats
type ProtocolStats @entity {
  id: ID!                          # "global"
  totalBonds: BigInt!
  activeBonds: BigInt!
  totalIncomeSplits: BigInt!
  totalTIMESplit: BigInt!
}
```

---

## Key Queries

### Check Partnership Status

```graphql
query IsPartnered($nullifier: Bytes!) {
  partnerships(
    where: {
      partnerANullifier: $nullifier
      active: true
    }
  ) {
    id
    bondedAt
    identityTierA
    identityTierB
    ensSubname
    splitBps
    active
  }
}
```

Also check partnerB position:

```graphql
query IsPartneredEither($nullifier: Bytes!) {
  asPartnerA: partnerships(where: { partnerANullifier: $nullifier, active: true }) {
    id
    bondedAt
    ensSubname
  }
  asPartnerB: partnerships(where: { partnerBNullifier: $nullifier, active: true }) {
    id
    bondedAt
    ensSubname
  }
}
```

### Get Partnership Dashboard Data

```graphql
query PartnershipDashboard($tokenId: BigInt!) {
  partnership(id: $tokenId) {
    id
    bondedAt
    identityTierA
    identityTierB
    ensSubname
    active
    incomeSplits(orderBy: timestamp, orderDirection: desc, first: 20) {
      grossAmount
      workerShare
      partnerShare
      payerAddress
      timestamp
      txHash
    }
    milestones(orderBy: completedAt, orderDirection: desc) {
      description
      completedAt
      metadataWalrus
    }
  }
}
```

### Partnership Registry for B2B Integrations

```graphql
# Public registry — no private data, just status and tier
query PartnershipRegistry($minTier: Int!, $after: BigInt!) {
  partnerships(
    where: {
      active: true
      identityTierA_gte: $minTier
      identityTierB_gte: $minTier
      bondedAt_gt: $after
    }
    orderBy: bondedAt
    orderDirection: desc
    first: 100
  ) {
    id
    bondedAt
    identityTierA
    identityTierB
    ensSubname
  }
}
```

### Protocol Statistics

```graphql
query ProtocolStats {
  protocolStats(id: "global") {
    totalBonds
    activeBonds
    totalIncomeSplits
    totalTIMESplit
  }
}
```

---

## Subgraph Manifest

```yaml
# subgraph.yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: HumanBond
    network: worldchain
    source:
      address: "0x6494daa4e693F748Eb0a16041ECfCEd51392bB13"
      abi: HumanBond
      startBlock: 0
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Partnership
        - IncomeSplit
        - Milestone
        - IdentityTierUpgrade
        - ProtocolStats
      abis:
        - name: HumanBond
          file: ./abis/HumanBond.json
      eventHandlers:
        - event: BondFormed(indexed bytes32,indexed bytes32,uint256,uint8,uint8)
          handler: handleBondFormed
        - event: BondDissolved(indexed uint256,uint64)
          handler: handleBondDissolved
        - event: IncomeSplit(indexed uint256,bytes32,bytes32,uint256,uint256,address)
          handler: handleIncomeSplit
        - event: MilestoneMinted(indexed uint256,uint256,string)
          handler: handleMilestoneMinted
        - event: IdentityTierUpgraded(indexed bytes32,uint8,uint8)
          handler: handleTierUpgrade
      file: ./src/mapping.ts
```

---

## Key Mappings

```typescript
// src/mapping.ts

import { BondFormed, IncomeSplit, MilestoneMinted } from '../generated/HumanBond/HumanBond'
import { Partnership, IncomeSplit as IncomeSplitEntity, ProtocolStats } from '../generated/schema'
import { BigInt, Bytes } from '@graphprotocol/graph-ts'

export function handleBondFormed(event: BondFormed): void {
  let partnership = new Partnership(event.params.vowNFTTokenId.toHexString())
  partnership.partnerANullifier = event.params.partnerANullifier
  partnership.partnerBNullifier = event.params.partnerBNullifier
  partnership.vowNFTTokenId = event.params.vowNFTTokenId
  partnership.bondedAt = event.block.timestamp
  partnership.identityTierA = event.params.identityTierA
  partnership.identityTierB = event.params.identityTierB
  partnership.active = true
  partnership.splitBps = 5000
  partnership.txHash = event.transaction.hash
  partnership.save()

  // Update global stats
  let stats = getOrCreateStats()
  stats.totalBonds = stats.totalBonds.plus(BigInt.fromI32(1))
  stats.activeBonds = stats.activeBonds.plus(BigInt.fromI32(1))
  stats.save()
}

export function handleIncomeSplit(event: IncomeSplit): void {
  let split = new IncomeSplitEntity(
    event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  )
  split.partnership = event.params.vowNFTTokenId.toHexString()
  split.grossAmount = event.params.workerShare.plus(event.params.partnerShare)
  split.workerShare = event.params.workerShare
  split.partnerShare = event.params.partnerShare
  split.payerAddress = event.params.payerAddress
  split.timestamp = event.block.timestamp
  split.txHash = event.transaction.hash
  split.save()

  // Update global stats
  let stats = getOrCreateStats()
  stats.totalIncomeSplits = stats.totalIncomeSplits.plus(BigInt.fromI32(1))
  stats.totalTIMESplit = stats.totalTIMESplit.plus(split.grossAmount)
  stats.save()
}
```

---

## B2B Integration Example

Dating platform integration — display "Verified Partnership" badge:

```javascript
import { createClient, gql } from '@urql/core'

const client = createClient({
  url: 'https://api.thegraph.com/subgraphs/name/humanbond/partnership-registry'
})

// Check if a World ID nullifier is in an active partnership
async function checkPartnershipStatus(worldIdNullifier: string) {
  const result = await client.query(gql`
    query ($nullifier: Bytes!) {
      asA: partnerships(where: { partnerANullifier: $nullifier, active: true }) {
        bondedAt
        identityTierA
        identityTierB
        ensSubname
      }
      asB: partnerships(where: { partnerBNullifier: $nullifier, active: true }) {
        bondedAt
        identityTierA
        identityTierB
        ensSubname
      }
    }
  `, { nullifier: worldIdNullifier }).toPromise()

  const partnerships = [...result.data.asA, ...result.data.asB]

  if (partnerships.length === 0) {
    return { partnered: false }
  }

  const p = partnerships[0]
  return {
    partnered: true,
    bondedAt: new Date(p.bondedAt * 1000).toISOString(),
    identityTier: Math.min(p.identityTierA, p.identityTierB), // min of both
    ensSubname: p.ensSubname,
  }
}

// Result: { partnered: true, bondedAt: "2026-01-15T...", identityTier: 2, ensSubname: "herb-agatha.humanbond.eth" }
```

---

## Deploy Commands

```bash
# Install Graph CLI
npm install -g @graphprotocol/graph-cli

# Authenticate
graph auth --studio [deploy-key]

# Build
graph codegen && graph build

# Deploy to Subgraph Studio
graph deploy --studio humanbond-partnership-registry

# Test locally
graph test
```

---

*democracy.earth · timeprotocol.earth · ETHGlobal Lisbon · July 2026*
