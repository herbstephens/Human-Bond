# HumanBond Protocol — V3

On-chain bonds, yield, milestones & relationship-proof infrastructure.

## Table of Contents

1. [Introduction](#introduction)
2. [Smart Contracts](#smart-contracts)
3. [Protocol Overview](#protocol-overview)
4. [Refactoring History](#refactoring-history)
5. [View & Getter Functions](#view--getter-functions)
6. [Author](#written-and-refactored-by)

---

## Introduction

HumanBond allows two verified humans (via World ID) to form a cryptographically provable bond on-chain.

A bond becomes:

- A permanent on-chain registry entry with a deterministic bond ID, and
- A two-person relationship with shared yield, annual milestones, and a full on-chain history.

With one proposal → one acceptance → a bond immediately receives:

- A soulbound Bond NFT (one per partner)
- Annual Milestone NFTs
- TIME token yield for each day bonded together

The protocol handles everything autonomously: proposals, acceptance, yield, milestones, and a two-step dissolution with cooldown protection.

---

## Smart Contracts

### World Chain Mainnet

- **HumanBond Proxy (Core Engine)**: [0xc14803e47D19eD0F305E16d462d97c6d4D2a2A93](https://worldscan.org/address/0xc14803e47D19eD0F305E16d462d97c6d4D2a2A93)
- **HumanBond Implementation 1**: [0x38b9f58fBF0Fd242d12512fC98e8a53e64c8e814](https://worldscan.org/address/0x38b9f58fBF0Fd242d12512fC98e8a53e64c8e814)
- **BondNFT (Soulbound)**: [0x26860bC82B257ed139e33bC6BB185d748aB7b9dc](https://worldscan.org/address/0x26860bC82B257ed139e33bC6BB185d748aB7b9dc)
- **MilestoneNFT (Soulbound)**: [0xA98F4B954009559335085B36f1024A165024D3E0](https://worldscan.org/address/0xA98F4B954009559335085B36f1024A165024D3E0)
- **TIME Token**: [0x65E4d2C637C1adf1a92839D91DB8bE1e63EE864f](https://worldscan.org/address/0x65E4d2C637C1adf1a92839D91DB8bE1e63EE864f)

### Contract Responsibilities

**HumanBond.sol** → Core logic: proposals, bond activation, two-step dissolution, cooldown enforcement, yield accrual, milestone triggering. Deployed behind a UUPS proxy.

**BondNFT.sol** → Soulbound ERC-721 minted once per partner at bond creation. Stores dynamic on-chain metadata: partner addresses, bond start timestamp, and bond ID.

**MilestoneNFT.sol** → Soulbound ERC-721 collection tracking yearly anniversaries. URIs are set per year by the owner and can be frozen to prevent further changes. Supports catch-up minting for missed years. Each token stores on-chain metadata: milestone year, partner addresses, bond ID, bond start, and claim timestamp.

**TimeToken.sol** → ERC-20 reward token (`TIME`). Accrues at 1 token per day per couple. Minting is controlled by authorized addresses set by the owner. Includes authorized burn functionality for future protocol integrations.

---

## Protocol Overview

### 1. Proposal

```bash
propose(address proposed, uint256 root, uint256 nullifier, uint256[8] proof)
```

- Caller must not be in an active bond
- Caller must not be within the rebond cooldown window after a dissolution
- Verifies the proposer is a real human via World ID (Orb-level, `GROUP_ID = 1`)
- Stores an outgoing proposal and adds the proposer to the recipient's incoming list
- One active outgoing proposal per address at a time

```bash
cancelProposal()
```

- Proposer can cancel their own outgoing proposal at any time

```bash
rejectProposal(address proposer)
```

- Recipient can reject an incoming proposal

### 2. Acceptance

```bash
accept(address proposer, uint256 root, uint256 nullifier, uint256[8] proof)
```

- Acceptor must also pass World ID verification (separate nullifier and action from propose)
- Acceptor must not be within the rebond cooldown window
- Creates the bond with a deterministic bond ID (`keccak256` of both addresses, order-independent)
- Mints one BondNFT to each partner
- Mints 1 TIME token to each partner immediately
- Clears all related proposals (including cross-proposals)
- Both partners' World ID nullifiers are stored on-chain as part of the bond record

### 3. Daily Yield

Partners accrue 1 TIME token per day together (shared, split 50/50 on claim).

```bash
claimYield(address partner)
```

- Calculates days elapsed since last claim
- Mints split TIME tokens directly to each partner

### 4. Milestones

```bash
manualCheckAndMint(address partner)
```

- Mints yearly anniversary MilestoneNFTs for both partners
- Supports catch-up minting if previous years were missed
- Capped at the highest year configured in MilestoneNFT (`latestYear`)

### 5. Dissolution (Two-Step)

```bash
requestDissolution(address partner)
```

- Either partner can initiate
- Starts a waiting period (`dissolutionDelay`, default 3 days)

```bash
executeDissolution(address partner)
```

- Only the requester can execute, after the delay has elapsed
- Auto-mints any pending yield before dissolving the bond
- Marks bond inactive, frees both partners
- Sets rebond cooldown (`REBOND_COOLDOWN`) on both addresses
- Preserves all historical bond data on-chain (bond struct is marked inactive, not deleted)

```bash
cancelDissolutionRequest(address partner)
```

- Requester can cancel before the delay elapses

> **Note:** `dissolutionDelay` is adjustable by the contract owner via `setDissolutionDelay(uint256 _delay)`. The default is 3 days.

### 6. Rebond Cooldown

After a dissolution, both partners enter a cooldown period (`REBOND_COOLDOWN`) during which they cannot propose or accept new bonds. This prevents dissolution/rebond spam cycles.

---

## Refactoring History

### V2 — Post-Hackathon Refactor

- Clean architecture: O(1) proposal indexing and removal
- Deterministic bond IDs for easy lookups
- Dynamic BondNFT on-chain metadata
- MilestoneNFT with upgradeable year registry and freeze mechanism
- Catch-up minting for missed anniversaries
- Separate World ID external nullifiers for propose and accept actions
- UI-ready getter functions (`getBondView`, `getUserDashboard`, `getIncomingProposals`)

### V3 — Anti-Spam & Protocol Tracking

- Two-step dissolution: `requestDissolution()` → delay period → `executeDissolution()`
- `cancelDissolutionRequest()` — requester can back out before delay elapses
- `cancelProposal()` — proposer can cancel their own outgoing proposal
- `rejectProposal()` — recipient can reject incoming proposals
- `activeBondCount` — live count of currently bonded couples
- `totalDissolutionCount` — total dissolutions ever recorded
- `lastDissolutionTimestamp` + `REBOND_COOLDOWN` — per-user cooldown after dissolution
- `setDissolutionDelay()` — owner-adjustable dissolution waiting period
- BondNFT: `bondToToken` tracks full bond history per couple (dynamic array, rebond-safe)
- HumanBond converted to UUPS upgradeable proxy (ERC-1967)
- `setBondNft`, `setMilestoneNft` — periphery contract replacement without upgrade
- `setDayDuration`, `setYearDuration`, `setRebondCooldown`, `setDissolutionDelay`
- Storage gap (`__gap[30]`) reserved for future upgrades
- Full terminology refactor: marriage → bond, divorce → dissolution

---

## View & Getter Functions

### HumanBond

| Function | Returns | Description |
|---|---|---|
| `isBonded(address a, address b)` | `bool` | True if the two addresses have an active bond |
| `getBondId(address a, address b)` | `bytes32` | Deterministic bond ID for a couple (order-independent) |
| `getBond(address a, address b)` | `Bond` | Full bond struct |
| `getBondView(address a, address b)` | `BondView` | Bond details including pending yield and bond ID |
| `getUserDashboard(address user)` | `UserDashboard` | Bond status, partner, pending yield, TIME balance, proposal status |
| `getIncomingProposals(address user)` | `Proposal[]` | All pending proposals made to a given address |
| `getProposal(address proposer)` | `Proposal` | Outgoing proposal for a given address |
| `hasPendingProposal(address proposer)` | `bool` | True if the address has an active outgoing proposal |
| `getPendingYield(address a, address b)` | `uint256` | Unclaimed TIME yield in wei |
| `getBondStart(address a, address b)` | `uint256` | Timestamp when the bond was created |
| `getCurrentMilestoneYear(address a, address b)` | `uint256` | Last milestone year claimed |
| `getDissolutionRequest(address a, address b)` | `DissolutionRequest` | Active dissolution request struct, if any |
| `activeBondOf(address user)` | `bytes32` | Active bond ID for a user, `bytes32(0)` if none |
| `activeBondCount()` | `uint256` | Total currently active bonds |
| `totalDissolutionCount()` | `uint256` | Total dissolutions ever recorded |
| `dayDuration()` | `uint256` | Duration of one yield day in seconds (default: 86400) |
| `yearDuration()` | `uint256` | Duration of one milestone year in seconds (default: 31536000) |
| `rebondCooldown()` | `uint256` | Cooldown period after dissolution in seconds (default: 2592000) |
| `dissolutionDelay()` | `uint256` | Required wait between request and execution in seconds (default: 259200) |

### BondNFT

| Function | Returns | Description |
|---|---|---|
| `tokenURI(uint256 tokenId)` | `string` | Base64-encoded on-chain JSON metadata |
| `getTokenMetadata(uint256 tokenId)` | `partnerA, partnerB, bondStart, bondId` | Raw metadata for a token |
| `getTokensByBond(bytes32 bondId)` | `uint256[]` | Token IDs associated with a bond |
| `totalSupply()` | `uint256` | Total BondNFTs minted |
| `ownerOf(uint256 tokenId)` | `address` | Owner of a token |
| `imageCid()` | `string` | Current IPFS URI used as the NFT image |

### MilestoneNFT

| Function | Returns | Description |
|---|---|---|
| `tokenURI(uint256 tokenId)` | `string` | Base64-encoded on-chain JSON metadata |
| `tokenYear(uint256 tokenId)` | `uint256` | Milestone year this token represents |
| `tokenData(uint256 tokenId)` | `TokenMetadata` | Full metadata: partners, bond ID, bond start, claimed at |
| `latestYear()` | `uint256` | Highest milestone year configured |
| `milestoneUrIs(uint256 year)` | `string` | IPFS URI for a given milestone year |
| `totalSupply()` | `uint256` | Total MilestoneNFTs minted |
| `frozen()` | `bool` | Whether milestone URIs are locked |

### TimeToken

| Function | Returns | Description |
|---|---|---|
| `balanceOf(address account)` | `uint256` | TIME balance in wei |
| `totalSupply()` | `uint256` | Total TIME in circulation |
| `authorizedMinters(address)` | `bool` | Whether an address can mint |
| `authorizedBurners(address)` | `bool` | Whether an address can burn on behalf of users |

---

## Written and refactored by

Leticia Azevedo — Smart Contracts Developer (Brazil)
