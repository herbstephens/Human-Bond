# HumanBond Mini App

MiniKit frontend for the HumanBond partnership protocol. Built with World's MiniKit SDK. Live in the World App store — search `HumanBond`.

Frontend by [@franco](https://github.com/franco) · ETHGlobal Lisbon 2026

---

## Stack

- **Framework:** Next.js (or React — Franco's choice)
- **Identity:** World MiniKit SDK (`@worldcoin/minikit-js`)
- **Wallet:** MiniKit wallet integration
- **Chain:** World Chain Mainnet (chainId: 480)
- **Contracts:** HumanBond V2 (see `../contracts/README.md`)
- **Storage:** 0G KV Layer for: agentic data, milestone NFTs, metadata, queriable registries
- **Naming:** ENS subnames via `humanbond.eth`
- **Indexing:** The Graph partnership registry subgraph

---

## World Identity Integration

HumanBond uses three World identity credentials — selected during bond formation based on what's available to each partner:

```javascript
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js'

// Tier 3: World Orb (strongest — full governance weight)
const orbVerification = await MiniKit.commandsAsync.verify({
  action: 'humanbond-propose',
  verification_level: VerificationLevel.Orb,
})

// Tier 2: NFC Credentials (passport chip — age >18, jurisdiction)
// World Identity Check beta
const nfcVerification = await MiniKit.commandsAsync.verify({
  action: 'humanbond-propose-nfc',
  verification_level: VerificationLevel.Device, // pending NFC level
  // attribute_requests: ['age_over_18', 'jurisdiction']
})

// Tier 1: Selfie Check (liveness detection — World beta)
const selfieVerification = await MiniKit.commandsAsync.verify({
  action: 'humanbond-propose-selfie',
  verification_level: VerificationLevel.Device,
})
```

The identity tier used is recorded in the VowNFT and the Partnership Registry.

---

## Key Screens

### 1. Bond Formation Flow

```
Screen 1: Landing
  "Form a HumanBond"
  "Two World ID–verified humans. One on-chain partnership."
  [Choose identity verification method]
    → Selfie Check (Tier 1)
    → NFC Credentials (Tier 2) — verify age + jurisdiction
    → World Orb (Tier 3) — highest assurance

Screen 2: Identity Verification
  World MiniKit verify() call
  Show identity tier earned
  Explain what it means

Screen 3: Partner Code
  Generate QR code / share link for partner to join
  Partner scans and verifies their own identity

Screen 4: ENS Subname
  "Create your partnership name"
  Input: [name1] - [name2]
  Preview: name1-name2.humanbond.eth
  [Register on ENS]

Screen 5: Partnership Charter
  Optional: write vows / describe the partnership
  Stored permanently on Walrus
  [Stored on Walrus: ✓]

Screen 6: Confirm Bond
  Summary: both partners, identity tiers, ENS name, charter
  [Form Bond] → HumanBond.proposeBond() tx
  Partner: [Accept Bond] → HumanBond.acceptBond() tx

Screen 7: Bond Confirmed
  VowNFT minted
  Show token ID, ENS subname
  "Search HumanBond in World App to manage your partnership"
```

### 2. Dashboard (existing partnership)

```
Header: herb-agatha.humanbond.eth
        ★ Active · Since January 2026

Identity Tiers:
  Herb:   World Orb (Tier 3)
  Agatha: NFC Credentials (Tier 2)

Income Splits:
  ┌─────────────────────────────────┐
  │ Total Work TIME split: 2,400    │
  │ Your share: 1,200 TIME          │
  │ Partner share: 1,200 TIME       │
  └─────────────────────────────────┘
  [Recent splits history]

Milestones:
  + Add milestone

Partnership Registry:
  [Copy ENS name]
  [Share partnership proof]
  [View on The Graph]
```

### 3. Age Grant Visualisation (ETHGlobal build)

```
Your Governance Endowment

Age Grant: 14,600 TIME
  ████████████░░░░░░░░ 60% unlocked
  8,760 TIME liquid
  5,840 TIME governance-bound

Unlock progress:
  Earned 8,760 Work TIME → unlocked 8,760 Age Grant TIME
  Next unlock: earn more Work TIME

Your governance weight:
  √14,600 = 120.8 votes (when fully allocated)

[Go to Governance Agent →]
```

---

## Income Split UI (ETHGlobal build)

When a payment is received for verified work:

```javascript
// Trigger the 50/50 split
async function finalizeWorkAndDistribute(workAmount: bigint) {
  const { commandPayload, finalPayload } = await MiniKit.commandsAsync.sendTransaction({
    transaction: [{
      address: HUMANBOND_CONTRACT,
      abi: HumanBondABI,
      functionName: 'finalizeWorkAndDistribute',
      args: [
        userNullifier,
        workAmount,
        payerAddress,
        workVerificationHash,
      ],
    }],
  })
  // Show confirmation: both partners received TIME
}
```

UI feedback:
```
✓ Work TIME split complete

  You received:     1,150 TIME (50%)
  Partner received: 1,150 TIME (50%)
  Payer: 0x1234...

  [View on worldscan.org]
```

---

## Walrus Storage

VowNFT metadata and partnership charter stored permanently on Walrus:

```javascript
import { WalrusClient } from '@mysten/walrus'

const client = new WalrusClient({ network: 'mainnet' })

// Store charter on Walrus
async function storeCharter(charterData: object): Promise<string> {
  const blob = new Blob([JSON.stringify(charterData)], {
    type: 'application/json'
  })
  const result = await client.writeBlob({
    blob,
    deletable: false, // permanent
    epochs: 100,
  })
  return result.blobId // store in VowNFT tokenURI
}

// Read charter from Walrus
async function readCharter(blobId: string): Promise<object> {
  const blob = await client.readBlob({ blobId })
  return JSON.parse(await blob.text())
}
```

---

## ENS Integration

```javascript
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

// Register subname during bond formation
async function registerENSSubname(name1: string, name2: string) {
  const subname = `${name1}-${name2}.humanbond.eth`
  // Call humanbond.eth subname registrar contract
  // Sets resolution to partnership shared address
  // Sets text records: vowNFTId, identityTiers, timeProtocol
}

// Resolve partnership address
async function resolvePartnership(ensName: string) {
  const address = await publicClient.getEnsAddress({
    name: normalize(ensName),
  })
  return address
}
```

---

## The Graph Queries

```javascript
import { createClient, gql } from '@urql/core'

const SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/humanbond/partnership-registry'

const client = createClient({ url: SUBGRAPH_URL })

// Check partnership status
const IS_PARTNERED = gql`
  query IsPartnered($nullifier: Bytes!) {
    partnerships(where: { partnerANullifier: $nullifier, active: true }) {
      id
      bondedAt
      ensSubname
      identityTierA
      identityTierB
      incomeSplits(orderBy: timestamp, orderDirection: desc, first: 10) {
        amount
        timestamp
      }
    }
  }
`

const result = await client.query(IS_PARTNERED, { nullifier: userNullifier })
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_WORLDCHAIN_RPC=https://worldchain-mainnet.g.alchemy.com/public
NEXT_PUBLIC_HUMANBOND_CONTRACT=0x6494daa4e693F748Eb0a16041ECfCEd51392bB13
NEXT_PUBLIC_TIME_TOKEN=0x261f6d89491cbadff7813303363a514f4b226a82
NEXT_PUBLIC_VOWNFT=0xa1650cc531c2780fb8c006f4b8d314018f7f9ac9
NEXT_PUBLIC_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/humanbond/partnership-registry
NEXT_PUBLIC_ENS_REGISTRAR=0x[humanbond.eth subname registrar]
NEXT_PUBLIC_WLD_APP_ID=app_[your_app_id]
```

---

## Running Locally

```bash
# Install
cd miniapp
npm install

# Dev server
npm run dev

# Build
npm run build

# Test in World App simulator
npx @worldcoin/minikit-js simulator
```

---

## Folder Structure (Franco fills in)

```
miniapp/
├── README.md                    ← This file
├── package.json
├── next.config.js
├── src/
│   ├── app/
│   │   ├── page.tsx             ← Landing / dashboard
│   │   ├── bond/
│   │   │   ├── propose/         ← Bond formation flow
│   │   │   └── accept/          ← Accept a bond invitation
│   │   ├── age-grant/           ← Age Grant visualisation (ETHGlobal)
│   │   └── split/               ← Income split UI (ETHGlobal)
│   ├── components/
│   │   ├── BondFormation/
│   │   ├── IdentitySelector/    ← Selfie / NFC / Orb choice
│   │   ├── AgeGrantViz/         ← ETHGlobal build
│   │   ├── IncomeSplit/         ← ETHGlobal build
│   │   └── PartnershipCard/
│   ├── hooks/
│   │   ├── useHumanBond.ts
│   │   ├── useWorldId.ts
│   │   └── useTheGraph.ts
│   └── lib/
│       ├── contracts.ts
│       ├── walrus.ts
│       └── ens.ts
└── public/
```

---

*Frontend: Franco · ETHGlobal Lisbon · July 24–26, 2026*
