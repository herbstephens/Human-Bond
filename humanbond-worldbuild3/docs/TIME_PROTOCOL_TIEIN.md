# HumanBond × TIME Protocol — Simplified Integration

> **Audience:** World Build 3 judges, prospective partners, and anyone who wants to understand how HumanBond ties into the larger TIME economy without wading through protocol documentation.

---

## The One-Sentence Version

**TIME = 1 hour of verified human existence. HumanBond is the first live application minting it — every active bond earns 1 TIME per day together, and the bond itself is the vehicle that aggregates, witnesses, and distributes those hours as an economic asset.**

---

## What Is Actually Live Today

On World Chain mainnet, right now:

- **`TimeToken`** (ERC-20 `TIME`) is deployed at [`0x39e629681a9db65D9352961d8dCD4C96C4A1169a`](https://worldscan.org/address/0x39e629681a9db65D9352961d8dCD4C96C4A1169a)
- Minting authority is restricted to the **`HumanBond`** engine at [`0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63`](https://worldscan.org/address/0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63)
- Every active marriage accrues **1 TIME per day together**, claimable anytime via `claimYield(partner)`, split 50/50
- Marriage ceremony itself mints **1 TIME to each partner immediately** on `accept()`

This is not a roadmap. This is the state of the network.

---

## Why TIME Matters

TIME Protocol is an economic primitive: **1 TIME = 1 hour of verified human existence.** It needs three things to work at scale:

1. **Verified humans** — solved by World ID
2. **A legitimate way to mint TIME** — work happened, or time elapsed in a witnessed relationship
3. **A social context to aggregate and distribute** — needs a primitive like a DAO

HumanBond supplies the third leg. A bond is the smallest, most intimate, most legitimate social unit: two humans who have publicly committed to shared economic life. When time passes, the bond is the natural vehicle to witness it.

---

## Flow V1 — Relationship-Longevity TIME (shipped)

```
        ┌─────────────────────────────────────┐
        │  1.  Two World IDs bond              │
        │      (propose + accept, Orb-only)    │
        │      → 1 TIME minted to each         │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  2.  Each day the bond stays active  │
        │      → pending yield += 1 TIME       │
        │      (computed on-the-fly, no loop)  │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  3.  Either partner calls            │
        │      claimYield(partner)             │
        │      → TIME minted, split 50/50      │
        │      → remainder → partnerB          │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  4.  If divorce is triggered,        │
        │      pending yield auto-mints and    │
        │      distributes before close-out.   │
        │      No TIME is left on the table.   │
        └─────────────────────────────────────┘
```

**Concrete example:**
Alice and Bob bond on March 1. On March 31, either of them calls `claimYield`. The contract computes `(now - lastClaim) / 1 day = 30 days`, mints 30 TIME, splits it: 15 to Alice, 15 to Bob. `lastClaim` is updated. The clock resets; tomorrow they're at 1 TIME pending again.

That is the entire mechanism. Simple, legible, on-chain.

---

## Flow V2 — Work-Income TIME (roadmap, post-Seoul)

The V1 yield is **longevity-proof**: 1 TIME/day represents time *shared*. The next integration unlocks the broader TIME Protocol thesis: **minting TIME from verified work hours**.

```
        ┌─────────────────────────────────────┐
        │  1.  Bond already exists             │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  2.  Partner A does 40 hrs of work   │
        │      for income paid to the bond     │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  3.  Partner A mints a WorkNFT       │
        │      attesting the hours + income    │
        │      (permissionless, low-tier)      │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  4.  HumanBond sees the WorkNFT,     │
        │      mints N additional TIME tokens  │
        │      into the bond's shared balance  │
        └─────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  5.  Partners can claim, burn for    │
        │      services, or hold toward the    │
        │      January 1, 2034 Schelling point │
        └─────────────────────────────────────┘
```

**Why this is the right way to ship it second, not first:** the V1 "1 TIME/day" mechanic is tamper-resistant by design — time just elapses, you can't fake it. The V2 mechanic needs dispute resolution (is the WorkNFT honest?), which is a five-stage system we're scoping separately. Ship the simple thing live; add the richer thing once the dispute layer is in place.

---

## What Changes When You Add TIME to HumanBond

| Without TIME | With TIME (V1, shipped) | With TIME (V2, roadmap) |
|---|---|---|
| Marriage is a status, not a stream | Marriage accrues a daily on-chain yield | Marriage also accrues from work hours |
| Divorce splits the money | Divorce splits the money + the TIME | Divorce splits money + longevity TIME + work TIME |
| No way to prove "we built this life together" | Every bonded day is minted on-chain | Every bonded hour of labor is also minted |
| Couples are financial units | Couples are **time-economic units** | Couples are **time-economic producers** |

TIME turns the bond from a treasury into a **biography**.

---

## Anti-Double-Mint: Cross-Chain Invariant

HumanBond's TIME is canonical on World Chain. As the protocol extends to Ethereum and NEAR satellites, the single most important invariant is:

> **No human can mint more than 24 TIME in a single calendar day, across all chains.**

Enforced via **day-scoped chain-agnostic nullifiers**: every TIME-minting event gets a unique fingerprint of `(worldId_nullifier × calendar_day_UTC × chain_id_of_origin)`. World Chain is the canonical arbiter; satellites submit their minted events for registry and are slashed if they over-issue.

For the current V1 longevity yield, this is trivially satisfied — a bond is active on exactly one chain at a time. For the V2 work-hour mechanic, it is non-negotiable.

---

## The Layered Identity Stack (for V2)

TIME Protocol uses a four-tier identity model. HumanBond inherits it as a progressive-disclosure system:

```
┌──────────────────────────────────────────────────┐
│  Tier 4 — WorkNFT          (anyone can mint)     │
│  "I claim I worked N hours for this income"      │
├──────────────────────────────────────────────────┤
│  Tier 3 — Human Passport   (reputation-weighted) │
│  Used for dispute escalation                     │
├──────────────────────────────────────────────────┤
│  Tier 2 — Self Protocol    (passport-verified)   │
│  Used for high-value bonds and cross-border      │
├──────────────────────────────────────────────────┤
│  Tier 1 — World ID         (proof of personhood) │
│  REQUIRED for every bond. The foundation.        │
└──────────────────────────────────────────────────┘
```

**For the live V1 mechanic, HumanBond enforces Tier 1 only.** The deeper tiers are scoped into the roadmap — couples will be able to upgrade verification as the bond ages or the treasury grows. Higher tier = access to larger work-income TIME mints with lighter dispute friction.

---

## Scope for the World Build 3 Demo

✅ **Live today:**
- Bond creation with two World IDs (Orb-only, Group ID 1)
- `propose-bond` and `accept-bond` as cryptographically distinct action nullifiers
- 1 TIME minted to each partner at marriage
- 1 TIME/day shared yield, claimable, split 50/50
- Milestone NFTs for yearly anniversaries (catch-up supported)
- Clean-exit divorce with auto-distribution of pending yield
- Dynamic on-chain VowNFT metadata (no IPFS failure risk for core fields)

⏳ **Seoul Build Week → SF Demo Day:**
- WorkNFT minting from Joint Treasury income events
- V2 work-hour TIME minting into the bond balance
- Ethereum + NEAR satellite sync to World Chain canonical registry
- Production 5-stage dispute resolution
- Dating-app Registry API productization (see [DATING_APP_API.md](DATING_APP_API.md))

---

## The Big Picture

HumanBond is not just a couple's DAO. It is **the first real-world application demonstrating that TIME Protocol works with actual humans earning actual yield in an actual relationship, on mainnet, today.**

Every bond is a live test of the TIME thesis: that a verified human's time is the most democratic economic unit — everyone has exactly 24 hours a day — and that tokenizing it, witnessed by the simplest human contract there is, creates an asset class with the broadest possible legitimacy.

January 1, 2034 is the Schelling point. HumanBond is how we get there, one bonded day at a time.
