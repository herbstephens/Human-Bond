# Partnership Registry

HumanBond maintains the first verifiable, privacy-preserving on-chain partnership registry. Any application can query partnership status for a World ID nullifier — with the partner's consent — using a single API call.

---

## What the Registry Records

Every HumanBond partnership creates a canonical on-chain record containing:

| Field | Type | Description |
|---|---|---|
| `partnerANullifier` | `bytes32` | World ID nullifier for Partner A |
| `partnerBNullifier` | `bytes32` | World ID nullifier for Partner B |
| `vowNFTTokenId` | `uint256` | VowNFT token ID |
| `bondedAt` | `uint64` | Unix timestamp of bond formation |
| `identityTierA` | `uint8` | Identity tier of Partner A (0–3) |
| `identityTierB` | `uint8` | Identity tier of Partner B (0–3) |
| `active` | `bool` | Whether partnership is currently active |
| `splitBps` | `uint16` | Income split in basis points (5000 = 50/50) |
| `charterWalrus` | `string` | Walrus blob ID for partnership charter |
| `ensSubname` | `string` | ENS subname (e.g. `herb-agatha.humanbond.eth`) |

---

## Query Interfaces

### 1. Smart Contract (World Chain Mainnet)

```solidity
// Check if a World ID nullifier is in an active partnership
function isPartnered(bytes32 worldIdNullifier) external view returns (bool);

// Get full partnership record (with consent proof)
function getPartnership(
    bytes32 worldIdNullifier,
    bytes calldata consentProof
) external view returns (PartnershipRecord memory);

// Get partner's nullifier (with consent proof)
function getPartnerNullifier(
    bytes32 worldIdNullifier,
    bytes calldata consentProof
) external view returns (bytes32);

// Get ENS subname for a partnership
function getENSSubname(bytes32 worldIdNullifier) external view returns (string memory);
```

Contract address: `0x6494daa4e693F748Eb0a16041ECfCEd51392bB13`
Network: World Chain Mainnet

### 2. The Graph Subgraph

```graphql
# Check partnership status
query PartnershipStatus($nullifier: Bytes!) {
  partnerships(where: {
    partnerANullifier: $nullifier
    active: true
  }) {
    id
    vowNFTTokenId
    bondedAt
    identityTierA
    identityTierB
    splitBps
    ensSubname
    milestones {
      id
      completedAt
      description
    }
    incomeSplits {
      id
      amount
      executedAt
      txHash
    }
  }
}

# Get all active partnerships (public registry)
query ActivePartnerships {
  partnerships(where: { active: true }, orderBy: bondedAt, orderDirection: desc) {
    id
    bondedAt
    identityTierA
    identityTierB
    ensSubname
  }
}
```

Subgraph endpoint: `https://api.thegraph.com/subgraphs/name/humanbond/partnership-registry`
*(Deployed at ETHGlobal Lisbon — July 2026)*

### 3. REST API (Partnership Registry API)

```bash
# Check if a World ID nullifier is in an active partnership
GET /api/v1/partnership/status/{worldIdNullifier}

Response:
{
  "partnered": true,
  "bondedAt": 1717200000,
  "identityTier": 3,
  "ensSubname": "herb-agatha.humanbond.eth",
  "activeSince": "2026-01-15"
}

# Full partnership details (requires consent signature)
POST /api/v1/partnership/details
{
  "nullifier": "0x...",
  "consentSignature": "0x..."
}
```

---

## Privacy Model

The registry is designed for minimal disclosure:

- **Public fields:** Whether a partnership exists, when it was formed, identity tiers, ENS subname
- **Consent-gated fields:** Partner's nullifier, income split amounts, milestone details
- **Never disclosed:** Underlying wallet addresses (nullifiers are privacy-preserving World ID identifiers), names, or any off-chain identity attributes

A dating platform can display "✓ Verified HumanBond partnership" without knowing who the partners are. A financial institution can verify partnership status for a joint application without receiving any unnecessary personal data.

---

## B2B Use Cases

### Dating Platforms
Display a "Verified Partnership" badge on profiles. Query partnership status for a World ID nullifier before showing it to other users. Know immediately whether someone is in an active on-chain partnership.

```
Tinder · Match · Hinge · Bumble → Partnership status badge
Integration: The Graph subgraph or REST API
Zero infrastructure required
```

### Financial Services
Verify partnership status for joint accounts, mortgages, inheritance claims, tax filings. The ENS subname provides a human-readable joint identity. The VowNFT provides an immutable record of when the partnership was formed.

```
Banks · Insurance companies · Legal firms → Joint account eligibility
Integration: Smart contract query with consent proof
```

### Legal and Government Services
Many jurisdictions recognise registered partnerships for immigration, tax, property, and healthcare purposes. The HumanBond Partnership Registry provides the first cryptographically verifiable, privacy-preserving partnership record that any institution can query.

```
Immigration authorities · Tax agencies · Healthcare providers
Integration: REST API + identity tier verification
```

### Healthcare and Insurance
Verify spousal/partner status for insurance coverage, medical decision-making authority, emergency contact verification — with the partner's consent.

---

## Identity Tier Significance

| Tier | Method | Significance for partners |
|---|---|---|
| 0 | Peer Vouching | Community trust; entry-level |
| 1 | Selfie Check (World beta) | Confirmed live human; liveness detection |
| 2 | NFC Credentials (World beta) | Age >18 verified; jurisdiction confirmed; passport-backed |
| 3 | World Orb | Iris biometric; strongest sybil resistance; full governance weight |

A financial institution requiring the highest assurance would filter for `identityTierA >= 2 AND identityTierB >= 2` — ensuring both partners have document-backed identity.

---

## Income Split Record

Every `finalizeWorkAndDistribute()` execution is recorded on-chain and indexed by the subgraph:

```
IncomeRecord {
  timestamp: uint64
  grossAmount: uint256     // TIME minted for the work event
  workerShare: uint256     // 50% to working partner
  partnerShare: uint256    // 50% to non-working partner
  payerAddress: address    // who paid for the work
  txHash: bytes32          // World Chain transaction
}
```

This creates an immutable record of the partnership's shared economic activity — useful for tax purposes, financial planning, and demonstrating joint economic standing to institutions.

---

*democracy.earth · timeprotocol.earth · July 2026*
