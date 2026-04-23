# HumanBond Contracts

Smart contracts for the HumanBond protocol — a two-person DAO of verified humans using World ID.

> **Authored and deployed by Leticia Azevedo** ([@leticarolina](https://github.com/leticarolina) · [@letiweb3](https://x.com/letiweb3)).
> Canonical source: <https://github.com/leticarolina/worldid-marriage-protocol>
> This directory is a synchronized snapshot for World Build 3 judging. For the latest source of truth, see Leticia's repo.

---

## Deployed on World Chain Mainnet

| Contract | Purpose | Address |
|---|---|---|
| **HumanBond** | Core engine — proposals, marriage activation, yield, divorce | [`0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63`](https://worldscan.org/address/0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63) |
| **VowNFT** | Dynamic soulbound NFT minted at marriage (one per partner) | [`0x8c64c304854F9284ddb976918dF37Bd4f5949F22`](https://worldscan.org/address/0x8c64c304854F9284ddb976918dF37Bd4f5949F22) |
| **MilestoneNFT** | Upgradeable soulbound NFTs for yearly anniversaries | [`0x566c4a366625F08A714dd092f8bD2F0E86f906f5`](https://worldscan.org/address/0x566c4a366625F08A714dd092f8bD2F0E86f906f5) |
| **TimeToken** | ERC-20 `TIME` — 1 TIME/day shared yield per active marriage | [`0x39e629681a9db65D9352961d8dCD4C96C4A1169a`](https://worldscan.org/address/0x39e629681a9db65D9352961d8dCD4C96C4A1169a) |

**World ID Router (mainnet):** `0x17B354dD2595411ff79041f930e491A4Df39A278`
**World App ID:** `app_bfc3261816aeadc589f9c6f80a98f5df`
**Actions:** `propose-bond` (proposer nullifier) · `accept-bond` (acceptor nullifier)
**Group ID:** `1` (Orb-verified only)

---

## Contract Responsibilities

**`HumanBond.sol`** — Core engine. Holds the state for every bond: pending proposals, active marriages, deterministic marriage IDs (`keccak(sortedAddresses)`), divorce cooldowns, milestone tracking. All lifecycle calls route through here.

**`VowNFT.sol`** — ERC-721. Dynamic on-chain metadata (base64-encoded JSON) per token. Two tokens minted per marriage (one to each partner). **Soulbound** — transfers revert after mint.

**`MilestoneNFT.sol`** — ERC-721. Upgradeable per-year metadata URIs (the contract owner adds year N art; couples mint year N once they've been bonded for N years). **Soulbound**. Supports catch-up minting if a couple missed prior anniversaries.

**`TimeToken.sol`** — ERC-20 `TIME`. Mintable only by the HumanBond contract (and the deployer, during setup). Burnable. The ticker for the HumanBond economy and the seed implementation of the broader TIME Protocol token — see [`docs/TIME_PROTOCOL_TIEIN.md`](../docs/TIME_PROTOCOL_TIEIN.md).

---

## Lifecycle

### 1. Propose
```solidity
propose(address proposed, uint256 root, uint256 proposerNullifier, uint256[8] proof)
```
- Verifies the proposer with World ID (Orb, action `propose-bond`)
- Reverts if the proposer or proposed address is already married
- Reverts if the proposer is still in their divorce cooldown (30 days)
- Stores the proposal and indexes it for O(1) lookup

### 2. Accept
```solidity
accept(address proposer, uint256 root, uint256 acceptorNullifier, uint256[8] proof)
```
- Verifies the acceptor with World ID (Orb, action `accept-bond`)
- Computes deterministic `marriageId = keccak256(sortedAddresses)`
- Mints two soulbound `VowNFT`s (one per partner)
- Mints `1 TIME` to each partner as a marriage reward
- Activates the marriage; clears proposals

### 3. Daily Yield
```solidity
claimYield(address partner)  // callable by either partner
```
- `_pendingYield = daysElapsedSinceLastClaim * 1 TIME`
- Split 50/50 between partners (odd-wei remainder goes to partner B)

### 4. Milestones
```solidity
manualCheckAndMint(address partner)
```
- Mints missed anniversary NFTs in one call (catch-up)
- Capped by `MilestoneNFT.latestYear()` — the highest year the owner has set metadata for

### 5. Divorce
```solidity
divorce(address partner)
```
- Auto-claims and splits pending yield
- Marks marriage inactive (preserves history — no data deleted)
- Starts a 30-day cooldown before either partner can propose again
- Frees both partners to remarry

---

## Anti-Sybil & Replay Protection

- **Two separate external nullifiers** (`externalNullifierPropose`, `externalNullifierAccept`) — a user's `propose` nullifier and `accept` nullifier are cryptographically distinct, so neither proof can be replayed as the other action.
- **One-time nullifier use per action** — World ID enforces this at the router level.
- **One active marriage per address** — `activeMarriageOf[addr]` is the gate; `accept()` reverts if either party is already bonded.
- **Divorce cooldown** — prevents propose/accept/divorce spam loops.
- **Soulbound NFTs** — `VowNFT` and `MilestoneNFT` override `_update` to revert on transfer, so marriage status can never be sold.

---

## Repository Layout

```
contracts/
├── foundry.toml                 ← Foundry config
├── src/
│   ├── HumanBond.sol            ← core engine (~500 lines)
│   ├── VowNFT.sol               ← soulbound marriage NFT
│   ├── MilestoneNFT.sol         ← soulbound anniversary NFT
│   ├── TimeToken.sol            ← ERC-20 TIME
│   └── helpers/
│       ├── ByteHasher.sol       ← World ID hashToField helper
│       └── IWorldID.sol         ← World ID router interface
├── script/
│   └── Deploy.s.sol             ← deployment script w/ linkage
├── test/
│   ├── HumanBond.t.sol          ← core logic tests
│   ├── MilestoneNFTtest.t.sol
│   ├── VowNFTtest.t.sol
│   ├── integrations/
│   │   └── Deploytest.t.sol     ← deploy-script integration test
│   └── utils/
│       ├── MarriageHelper.sol   ← test fixture
│       └── MockWorldId.sol      ← mocked proof verifier
└── metadata/                    ← VowNFT & MilestoneNFT IPFS JSON
```

---

## Build & Test

Dependencies are tracked via git submodules in Leticia's canonical repo (`openzeppelin-contracts`, `world-id-contracts`, `forge-std`). To build locally:

```bash
git clone https://github.com/leticarolina/worldid-marriage-protocol
cd worldid-marriage-protocol
forge install
forge build
forge test -vvv
```

To deploy:

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $WORLDCHAIN_RPC \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify
```

---

## Attribution

All Solidity in this directory is © Leticia Azevedo, MIT-licensed, and imported here with her authorship explicitly preserved in the source headers. This World Build 3 submission is a joint effort — see the repo root [`README.md`](../README.md) for the full team.
