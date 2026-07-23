# HumanBond Contracts

Smart contracts authored and deployed by [@leticarolina](https://github.com/leticarolina).

---

## Deployed — World Chain Mainnet

| Contract | Address | Status |
|---|---|---|
| **HumanBond** | `0x6494daa4e693F748Eb0a16041ECfCEd51392bB13` | ✅ Verified |
| **TIME Token** | `0x261f6d89491cbadff7813303363a514f4b226a82` | ✅ Verified |
| **VowNFT** | `0xa1650cc531c2780fb8c006f4b8d314018f7f9ac9` | ✅ Verified |
| **MilestoneNFT** | `0x0a2759241d0cb610e3e61db351813ddf8a52f14c` | ✅ Verified |

View on worldscan.org for ABI, source, and transaction history.

---

## Contract Descriptions

### HumanBond.sol

Core partnership contract. Manages bond formation, dissolution, income splits, and the Partnership Registry.

**Key functions:**

```solidity
// Form a new bond (both partners must call)
function proposeBond(
    uint256 worldIdRoot,
    uint256 nullifierHash,
    uint256[8] calldata proof
) external;

function acceptBond(
    uint256 worldIdRoot,
    uint256 nullifierHash,
    uint256[8] calldata proof,
    uint256 proposerNullifierHash
) external;

// Income split — called when payment received for verified work
// Mints TIME and distributes 50/50 to both partners
function finalizeWorkAndDistribute(
    bytes32 worldIdNullifier,
    uint256 workAmount,
    address payerAddress
) external;  // ← NEW: being built at ETHGlobal Lisbon

// Dissolve partnership
function dissolve(bytes32 nullifierHash) external;

// Registry queries
function isPartnered(bytes32 nullifierHash) external view returns (bool);
function getPartnership(bytes32 nullifierHash) external view returns (PartnershipRecord memory);
function getPartnerNullifier(bytes32 nullifierHash) external view returns (bytes32);
```

**Key data structures:**

```solidity
struct PartnershipRecord {
    bytes32 partnerANullifier;
    bytes32 partnerBNullifier;
    uint256 vowNFTTokenId;
    uint64  bondedAt;
    uint8   identityTierA;
    uint8   identityTierB;
    bool    active;
    uint16  splitBps;           // 5000 = 50/50
    string  charterWalrus;      // Walrus blob ID
    string  ensSubname;         // ENS subname
}

struct IncomeRecord {
    uint64  timestamp;
    uint256 grossAmount;
    uint256 workerShare;
    uint256 partnerShare;
    address payerAddress;
}
```

**World ID integration:**
- External nullifier: `keccak256("humanbond-propose")` for propose action
- External nullifier: `keccak256("humanbond-accept")` for accept action
- Prevents replay across actions

---

### VowNFT.sol

Soulbound ERC-721. One token per partnership. Non-transferable. Permanent.

```solidity
// Minted by HumanBond.sol on bond formation
// NOT transferable — overrides ERC-721 transfer functions
function tokenURI(uint256 tokenId) external view returns (string memory);
// Returns Walrus URI: walrus://[blobId]

// Read partnership data from token
function getPartnershipId(uint256 tokenId) external view returns (bytes32);
function getIdentityTiers(uint256 tokenId) external view returns (uint8 tierA, uint8 tierB);
function getBondTimestamp(uint256 tokenId) external view returns (uint64);

// Override transfer to prevent movement
function transferFrom(address, address, uint256) public pure override {
    revert("VowNFT: soulbound — not transferable");
}
```

**Metadata schema (stored on Walrus):**

```json
{
  "name": "HumanBond #[tokenId]",
  "description": "A soulbound partnership record on TIME Protocol.",
  "attributes": [
    { "trait_type": "Partner A Identity Tier", "value": 3 },
    { "trait_type": "Partner B Identity Tier", "value": 2 },
    { "trait_type": "Bonded At", "value": 1717200000 },
    { "trait_type": "ENS Subname", "value": "herb-agatha.humanbond.eth" },
    { "trait_type": "Split", "value": "50/50" }
  ],
  "charter": {
    "partnerANullifier": "0x...",
    "partnerBNullifier": "0x...",
    "jurisdiction": "PT",
    "splitBps": 5000
  }
}
```

---

### MilestoneNFT.sol

Soulbound ERC-721. Minted by either partner to record shared milestones. Non-transferable.

```solidity
function mintMilestone(
    bytes32 partnershipId,
    string calldata description,
    string calldata metadataWalrus
) external;

function getMilestones(bytes32 partnershipId)
    external view returns (Milestone[] memory);

struct Milestone {
    uint256 tokenId;
    uint64  completedAt;
    string  description;
    string  metadataWalrus;
}
```

---

### TIMEToken.sol

ERC-20 TIME token. Minted by the issuance contracts. 24 TIME/day hard cap per verified human enforced by `UHTC_Calendar`.

```solidity
// Total supply = Σ(verified_humans × 24 TIME/day) — growing
// Decimals: 18

// Minting restricted to authorized issuance contracts
function mint(address to, uint256 amount) external onlyIssuer;

// Standard ERC-20 transfers for liquid TIME
// Governance-bound TIME held in AllocationManager (Soroban)
```

---

## ETHGlobal Lisbon — New Feature

**`finalizeWorkAndDistribute()`** — the 50/50 income split function being built at ETHGlobal Lisbon:

```solidity
function finalizeWorkAndDistribute(
    bytes32 workerNullifier,
    uint256 workAmount,        // TIME to mint
    address payerAddress,
    bytes32 workVerificationHash
) external onlyVerifiedWork {
    // 1. Verify worker is in an active partnership
    PartnershipRecord memory record = partnerships[workerNullifier];
    require(record.active, "Not in active partnership");

    // 2. Get partner nullifier
    bytes32 partnerNullifier = (record.partnerANullifier == workerNullifier)
        ? record.partnerBNullifier
        : record.partnerANullifier;

    // 3. Calculate split
    uint256 workerShare = (workAmount * record.splitBps) / 10000;
    uint256 partnerShare = workAmount - workerShare;

    // 4. Mint TIME to both
    TIMEToken(timeTokenAddress).mint(workerWallet, workerShare);
    TIMEToken(timeTokenAddress).mint(partnerWallet, partnerShare);

    // 5. Record income event
    incomeRecords[record.vowNFTTokenId].push(IncomeRecord({
        timestamp:    uint64(block.timestamp),
        grossAmount:  workAmount,
        workerShare:  workerShare,
        partnerShare: partnerShare,
        payerAddress: payerAddress
    }));

    emit IncomeSplit(record.vowNFTTokenId, workerShare, partnerShare, payerAddress);
}
```

---

## Development

```bash
# Install dependencies
npm install

# Compile
npx hardhat compile

# Test
npx hardhat test

# Deploy to World Chain testnet
npx hardhat run scripts/deploy.js --network worldchain-testnet

# Verify
npx hardhat verify --network worldchain <CONTRACT_ADDRESS> [constructor args]
```

**Network config:**

```javascript
// hardhat.config.js
networks: {
  "worldchain": {
    url: "https://worldchain-mainnet.g.alchemy.com/public",
    chainId: 480,
  },
  "worldchain-testnet": {
    url: "https://worldchain-sepolia.g.alchemy.com/public",
    chainId: 4801,
  }
}
```

---

*Contracts: Leticia (@leticarolina) · July 2026*
