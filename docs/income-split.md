# Income Split — 50/50 Work TIME Distribution

The income split is the economic core of HumanBond. When either partner earns Work TIME, the protocol automatically splits it 50/50. The non-working partner receives equal economic recognition — in code, not just in principle.

---

## Why This Matters

In the current economic system, the caregiver — the person who stays home to raise children, manage the household, or support a partner's career — has no formal economic standing. Their contribution is real. Their contribution is essential. It generates no income, builds no pension, creates no credit score, and leaves them economically vulnerable if the partnership ends.

HumanBond changes this with a single smart contract function.

**Before HumanBond:**
```
Partner A works → earns €5,000 → Partner A gets €5,000
Partner B (caregiver) → earns €0 → gets €0
Economic standing: entirely asymmetric
```

**After HumanBond:**
```
Partner A works → earns 100 TIME → Work TIME minted
HumanBond: 50 TIME → Partner A wallet
           50 TIME → Partner B wallet (automatic, no request needed)
Economic standing: equal
```

---

## The Contract Function

`finalizeWorkAndDistribute()` — built at ETHGlobal Lisbon

```solidity
/**
 * @notice Called when a payment is received for verified work.
 * Mints Work TIME and distributes according to the partnership split.
 *
 * @param workerNullifier  World ID nullifier of the working partner
 * @param workAmount       Total TIME to mint for this work event
 * @param payerAddress     Address of the client/payer
 * @param workVerificationHash  Hash of work verification proof
 */
function finalizeWorkAndDistribute(
    bytes32 workerNullifier,
    uint256 workAmount,
    address payerAddress,
    bytes32 workVerificationHash
) external onlyVerifiedWork {

    // 1. Confirm worker is in active partnership
    PartnershipRecord storage record = partnerships[workerNullifier];
    require(record.active, "HumanBond: worker not in active partnership");

    // 2. Confirm within daily cap (24 TIME/day)
    require(
        dailyMinted[workerNullifier][today()] + workAmount <= MAX_DAILY,
        "HumanBond: daily TIME cap exceeded"
    );

    // 3. Get partner nullifier and wallet
    bytes32 partnerNullifier = (record.partnerANullifier == workerNullifier)
        ? record.partnerBNullifier
        : record.partnerANullifier;

    address workerWallet  = nullifierToWallet[workerNullifier];
    address partnerWallet = nullifierToWallet[partnerNullifier];

    // 4. Calculate split
    uint256 workerShare  = (workAmount * record.splitBps) / 10000;
    uint256 partnerShare = workAmount - workerShare;

    // 5. Mint TIME to both wallets
    TIMEToken(timeTokenAddress).mint(workerWallet,  workerShare);
    TIMEToken(timeTokenAddress).mint(partnerWallet, partnerShare);

    // 6. Update daily minted tracking
    dailyMinted[workerNullifier][today()] += workAmount;

    // 7. Record income event (indexed by The Graph)
    incomeRecords[record.vowNFTTokenId].push(IncomeRecord({
        timestamp:    uint64(block.timestamp),
        grossAmount:  workAmount,
        workerShare:  workerShare,
        partnerShare: partnerShare,
        payerAddress: payerAddress,
        txHash:       bytes32(0) // filled by indexer
    }));

    // 8. Update Reputation Score
    // (async cross-chain call to ReputationRegistry on Soroban — future)

    emit IncomeSplit(
        record.vowNFTTokenId,
        workerNullifier,
        partnerNullifier,
        workerShare,
        partnerShare,
        payerAddress
    );
}
```

---

## Split Configuration

The default split is 50/50 (`splitBps = 5000`). Future versions may support:

| Split | splitBps | Description |
|---|---|---|
| 50/50 | 5000 | Default — equal partners |
| 60/40 | 6000 / 4000 | By mutual agreement |
| 70/30 | 7000 / 3000 | By mutual agreement |
| 100/0 | 10000 | Effectively no split |

Changing the split requires both partners to sign a transaction. Split changes are recorded on-chain and time-stamped.

---

## Daily Cap Integration

Work TIME is subject to the TIME Protocol's 24 TIME/day biological cap:

```
Total daily TIME per person = Daily UBI (1) + Work TIME (≤ 23)

HumanBond does NOT bypass this cap.
The workAmount in finalizeWorkAndDistribute() is the gross amount
for the worker only — the partner's 50% counts toward the partner's
own daily cap, not the worker's.

Example:
  Worker earns 20 TIME (gross for work done)
  → Worker receives: 10 TIME (counts toward worker's 24 cap)
  → Partner receives: 10 TIME (counts toward partner's 24 cap)
  Both remain within cap.
```

---

## Liquidity Ladder Effect

Income splits also advance the Liquidity Ladder for both partners:

- For the **worker:** earning 10 TIME unlocks 10 TIME from their Age Grant
- For the **partner:** receiving 10 TIME also unlocks 10 TIME from their Age Grant

This means the non-working partner's Age Grant unlocks through the partnership, not just through their own work. A caregiver who has earned zero Work TIME through their own independent work still benefits from unlocked Age Grant TIME through their partner's labour.

---

## The Graph Event Indexing

Every `IncomeSplit` event is indexed by the Partnership Registry subgraph:

```graphql
type IncomeSplit @entity {
  id: ID!                     # txHash-logIndex
  partnership: Partnership!
  grossAmount: BigInt!        # total TIME minted
  workerShare: BigInt!        # worker's 50%
  partnerShare: BigInt!       # partner's 50%
  payerAddress: Bytes!        # client who paid
  timestamp: BigInt!          # block timestamp
  txHash: Bytes!              # World Chain tx
}
```

This creates a complete, queryable record of the partnership's economic history — usable for:
- Tax reporting (proof of income for both partners)
- Mortgage/loan applications (joint income history)
- Pension planning (both partners have formal income records)
- Legal proceedings (documented economic contribution)

---

## Mini App UI

When a split executes, the Mini App shows:

```
┌─────────────────────────────────────┐
│  ✓ Work TIME split complete          │
│                                     │
│  Total earned:    1,150 TIME        │
│  Your share:      575 TIME  (50%)   │
│  Partner share:   575 TIME  (50%)   │
│                                     │
│  Payer: 0x1234...5678               │
│  herb-agatha.humanbond.eth          │
│                                     │
│  [View on worldscan.org]            │
│  [View income history]              │
└─────────────────────────────────────┘
```

And the partner receives a notification in their World App:

```
HumanBond
Your partner completed work.
You received: 575 TIME (50% split)
```

---

*democracy.earth · timeprotocol.earth · July 2026*
