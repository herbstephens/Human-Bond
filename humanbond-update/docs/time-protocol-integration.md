# TIME Protocol Integration

HumanBond is the first reference application of [TIME Protocol](https://github.com/herbstephens/TIME-Protocol) — the human-anchoring layer for an AI-dominant economy.

**1 TIME = 1 verified hour of human existence. Max 24 TIME/day/person.**

---

## What HumanBond Uses from TIME Protocol

### 1. Identity Stack

HumanBond requires both partners to verify their humanity using the TIME Protocol's Tiered Humanity Stack. The identity tier used is recorded immutably in the VowNFT.

```
TIME Protocol Identity Stack
    │
    ├── Tier 1: Selfie Check (World beta)
    │         → HumanBond: available for entry-level bonds
    │
    ├── Tier 2: NFC Credentials (World beta)
    │         → HumanBond: preferred — verifies age + jurisdiction
    │
    └── Tier 3: World Orb (Proof of Humanity)
              → HumanBond: highest assurance — full governance weight
```

Both partners must verify. Their tiers can differ — but both must be ≥ Tier 1.

### 2. Work TIME Issuance

HumanBond intercepts the Work TIME minting event and splits it 50/50:

```
Standard TIME Protocol:
  Payment received → TIME minted → 100% to worker

HumanBond:
  Payment received → TIME minted → 50% to worker + 50% to partner
```

This is implemented via `finalizeWorkAndDistribute()` in `HumanBond.sol`. The function:
1. Verifies the worker is in an active partnership
2. Mints Work TIME through the TIME Protocol's issuance engine
3. Distributes 50% to the worker and 50% to their bonded partner

The split percentage is configurable at the Soroban level (stored in the PartnershipRecord as `splitBps`). Default is 5000 (50/50). Future versions may allow different splits by mutual agreement.

### 3. Partnership Reputation Score

Every HumanBond partnership contributes to the TIME Protocol's 5-dimension Reputation Score. The **Partnership Score** dimension is populated by:

- VowNFT creation (bond formation)
- Duration of active partnership
- Income splits executed (number and total amount)
- Milestones recorded
- Identity tier of both partners

This means a HumanBond partnership is not just a social record — it builds each partner's economic and reputational standing within the TIME Protocol ecosystem.

```solidity
// ReputationRegistry.sol (TIME Protocol, Soroban)
function getPartnershipScore(bytes32 nullifier) external view returns (
    uint256 score,
    PartnershipStatus status,  // None, Active, Dissolved
    uint256 durationDays,
    uint256 incomeSplitsCount,
    uint8   partnerIdentityTier
);
```

---

## What HumanBond Contributes to TIME Protocol

### Partnership Registry

HumanBond maintains the world's first on-chain proof-of-humanity partnership registry. This registry:

1. **Feeds the Partnership Score dimension** of the TIME Protocol Reputation Score
2. **Provides verifiable partnership status** to any TIME Protocol application
3. **Enables income split verification** — the Governance Agent can query whether a user's income splits are legitimate partnership distributions

### Proof of Relationship as Economic Infrastructure

The broader TIME Protocol vision: economic participation as a team, not just an individual. HumanBond is the first implementation. Future reference apps will extend this:

- **VolunteerPROOF** will allow organisations to verify partnership status when awarding volunteer TIME
- **Governance Agent** will allow partnerships to share governance weight on certain objects (optional, not enforced)
- **Utility Concierge** may allow partnerships to register as joint households for utility access

---

## Deployment Architecture

```
HumanBond (World Chain Mainnet — EVM)
    │
    │ uses TIME Protocol contracts
    │
    ├── TIMEToken.sol       ← ERC-20 TIME token
    │   mint() called on Work TIME events
    │
    ├── [GenesisRegistry — Soroban]
    │   Age Grant minted at first verification
    │   Governance-bound, unlocked via Liquidity Ladder
    │
    └── [ReputationRegistry — Soroban]
        Partnership Score updated on:
          - Bond formation
          - Income split execution
          - Milestone recording
          - Bond dissolution
```

Note: TIME Protocol's Soroban (Stellar) contracts are in development (SCF Build Award Q3 2026). The World Chain contracts are live. Cross-chain communication between World Chain and Soroban via attestation bridge — in development.

---

## Future Integration: Governance Agent

When the Governance Agent launches on Soroban (Q4 2026), HumanBond partnerships will gain:

**Day-zero governance endowment:**
Both partners receive their Age Grant governance allocation automatically. The partnership can choose to stake jointly on governance objects — one shared position rather than two competing positions.

**Partnership governance weight:**
A HumanBond partnership can optionally be registered as a single governance actor on specific objects (e.g., local utility contracts, neighbourhood governance). This is opt-in and requires both partners to sign.

**Quadratic weighting:**
√(combined TIME staked) gives partnerships meaningful but not disproportionate governance weight.

---

*democracy.earth · timeprotocol.earth · July 2026*
