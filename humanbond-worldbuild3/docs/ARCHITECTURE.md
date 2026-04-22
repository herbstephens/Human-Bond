# HumanBond — Technical Architecture

A compact reference to the on-chain and multi-chain design for World Build 3 judges who want to verify the work.

---

## System Overview

```
                ┌──────────────────────────────┐
                │         WORLD APP            │
                │      (Mini App, MiniKit 2)   │
                └───────────────┬──────────────┘
                                │
                                │ Orb ZK proof
                                ▼
                ┌──────────────────────────────┐
                │   World ID Router (mainnet)  │
                │   0x17B3...39A278            │
                └───────────────┬──────────────┘
                                │ verifyProof()
                                ▼
        ┌───────────────────────────────────────────────┐
        │                  HumanBond                    │
        │           (core engine, World Chain)          │
        │  ┌─────────┬──────────┬──────────┬─────────┐  │
        │  │ propose │  accept  │  claim   │ divorce │  │
        │  └─────────┴──────────┴──────────┴─────────┘  │
        └────┬────────────┬─────────────┬──────────┬────┘
             │            │             │          │
             ▼            ▼             ▼          ▼
        ┌────────┐  ┌──────────┐  ┌────────┐  ┌────────┐
        │ VowNFT │  │MilestoneN│  │TimeTok │  │Registry│
        │ (SBT)  │  │FT (SBT)  │  │(ERC20) │  │(query) │
        └────────┘  └──────────┘  └────────┘  └────────┘

                (canonical registry = World Chain)
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │Ethereum │  │  NEAR   │  │  (more) │
        │satellite│  │satellite│  │         │
        └─────────┘  └─────────┘  └─────────┘
```

---

## On-Chain State Model

**Marriage ID (deterministic):**
```solidity
keccak256(a < b ? abi.encodePacked(a, b) : abi.encodePacked(b, a))
```
Address order doesn't matter. Given any two addresses, the marriage ID is derivable with zero lookups.

**Core mappings (in `HumanBond.sol`):**
```solidity
mapping(address => Proposal)     public proposals;          // proposer => pending proposal
mapping(address => address[])    public proposalsFor;       // proposed => list of proposers
mapping(address => uint256)      public proposerIndex;      // proposer => index in proposalsFor
mapping(bytes32 => Marriage)     public marriages;          // marriageId => active state
mapping(address => bytes32)      public activeMarriageOf;   // user => active marriageId
mapping(address => uint256)      public lastDivorceTimestamp; // cooldown tracking
```

**Proposal indexing is O(1) add and remove** via the swap-and-pop pattern — critical for keeping gas predictable when a popular address has many incoming proposals.

---

## World ID Integration

Two separate **external nullifiers** are computed at deploy time:

```solidity
externalNullifierPropose = hash(appId || "propose-bond")
externalNullifierAccept  = hash(appId || "accept-bond")
```

This matters because:

1. A proof generated for `propose-bond` **cannot** be replayed as an `accept-bond` proof — the external nullifier is part of what the circuit commits to.
2. World ID internally tracks `(nullifierHash, externalNullifier)` pairs as spent, so a single user can propose to many people (different nullifiers each time) without collision against their accept action space.

**Group ID 1 (Orb-only):** we explicitly do not accept Device-level verification. Marriage is a legal-adjacent act; we want the strongest available proof of personhood.

**App ID:** `app_bfc3261816aeadc589f9c6f80a98f5df` (registered with World Foundation).

---

## Yield Math

```solidity
function _pendingYield(bytes32 marriageId) internal view returns (uint256) {
    Marriage storage m = marriages[marriageId];
    if (!m.active) return 0;
    uint256 daysElapsed = (block.timestamp - m.lastClaim) / 1 days;
    return daysElapsed * 1 ether;  // 1 TIME per day
}
```

Notes:
- **No continuous accrual loop.** Yield is computed lazily at claim time, so the cost per day is zero — we only pay gas when claiming.
- **Partial days round down.** Bonded for 3.7 days and claiming? You get 3 TIME. The 0.7 day remainder stays on the `lastClaim` timestamp for next time.
- **Split:** `reward / 2` to partner A, `reward - split` to partner B (captures odd-wei remainders so no dust is lost).

---

## Soulbound NFT Enforcement

Both `VowNFT` and `MilestoneNFT` override ERC-721 `_update` to revert on transfer:

```solidity
function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    address from = _ownerOf(tokenId);
    if (from != address(0) && to != from) {
        revert TransfersDisabled();
    }
    return super._update(to, tokenId, auth);
}
```

Mint is allowed (`from == address(0)`). Burn is blocked implicitly by having no burn function. Transfer is blocked explicitly. This makes marriage status and anniversaries **non-fungible biography** — provable, permanent, non-transferable.

---

## Divorce Semantics

```solidity
function divorce(address partner) external {
    // 1. compute deterministic marriageId
    // 2. auto-mint and split any pending yield
    // 3. mark marriage inactive (DO NOT delete — preserve history)
    // 4. record lastDivorceTimestamp for both partners (30-day cooldown)
    // 5. clear activeMarriageOf[] for both
    // 6. increment totalDivorceCount
}
```

Three deliberate choices:

1. **No data deletion.** The `Marriage` struct remains in storage with `active = false`. Anyone can still query the historical relationship. This is critical for the Registry API — "was this person ever bonded?" is a valid question.
2. **Yield auto-mints on divorce.** If you're owed 47 TIME when your partner divorces you, those 47 TIME are minted and split as part of the `divorce()` transaction. Nothing is stranded.
3. **30-day cooldown.** Prevents propose/accept/divorce spam loops and gives either party breathing room before re-entering the network.

---

## Multi-Chain Architecture

**World Chain is canonical.** Every Marriage, Vow NFT, and TIME mint originates here.

**Ethereum and NEAR are satellites.** They mirror the canonical registry and hold their own TIME liquidity pools for DEX integration. The satellite model uses:

1. **One-way event replay** — satellites listen to World Chain `ProposalAccepted` and `MarriageDissolved` events and update their local mirror
2. **Day-scoped chain-agnostic nullifiers** for any future cross-chain TIME minting — ensures no human mints more than 24 TIME/day across all chains combined
3. **Fallback reads** — dApps can query any satellite for registry state with eventual consistency (typically < 60s)

The Ethereum satellite is live; NEAR is live with the bridge operator running. Future satellites (L2s, Solana) follow the same pattern.

---

## Gas & Efficiency

Representative World Chain mainnet gas costs (pre-optimization):

| Call | Approx. gas | Notes |
|---|---|---|
| `propose()` | ~180k | Includes World ID verification |
| `accept()` | ~420k | World ID verify + 2 NFT mints + 2 TIME mints |
| `claimYield()` | ~95k | Two ERC-20 mints |
| `manualCheckAndMint()` | ~140k + 50k/year | Catch-up milestone minting |
| `divorce()` | ~120k | State update + auto-claim |

The expensive path is `accept()` — this is the moment with two NFT mints, two ERC-20 mints, a World ID proof, and multiple storage writes. Everything else is sub-200k.

---

## Testing

Foundry-based test suite in [`contracts/test/`](../contracts/test/):

- `HumanBond.t.sol` — full lifecycle tests with mocked World ID
- `VowNFTtest.t.sol` — soulbound enforcement, metadata, authorization
- `MilestoneNFTtest.t.sol` — upgradeable URI registry, catch-up minting, freeze
- `integrations/Deploytest.t.sol` — end-to-end deploy-script integration test
- `utils/MarriageHelper.sol` — fixture factory for bonded pairs
- `utils/MockWorldId.sol` — protocol-faithful mock of the World ID router for unit tests

Run:
```bash
cd contracts
forge test -vvv
```

---

## Deployed Addresses (World Chain Mainnet)

| Contract | Address |
|---|---|
| HumanBond | `0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63` |
| VowNFT | `0x8c64c304854F9284ddb976918dF37Bd4f5949F22` |
| MilestoneNFT | `0x566c4a366625F08A714dd092f8bD2F0E86f906f5` |
| TimeToken | `0x39e629681a9db65D9352961d8dCD4C96C4A1169a` |
| World ID Router (ref.) | `0x17B354dD2595411ff79041f930e491A4Df39A278` |

All verified on [worldscan.org](https://worldscan.org). Source of truth: Leticia's canonical repo at <https://github.com/leticarolina/worldid-marriage-protocol>.
