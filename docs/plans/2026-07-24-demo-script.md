---
date: 2026-07-24
topic: demo-script
author: Leon (Product / PM / UX)
status: v1 — the buildable storyboard; screens derive from this
input: docs/plans/2026-07-24-ethglobal-lisbon-36h-plan.md
---

# HumanBond Demo Script — A Family, On-Chain

**Framing:** this is not a couple's wallet demo. It is the life of a **family trust**: founded by two humans, grown by heirs, managed by a **family agent**, and — when its founders die — passed on intact. *The bond that outlives you.*

```mermaid
flowchart LR
    A1["Act 1 · Founding<br/>bond + Safe + ENS + charter"] --> A2["Act 2 · Daily money<br/>receive · claim · spend"]
    A2 --> A3["Act 3 · Heirs<br/>Carla added · charter v2"]
    A3 --> A4["Act 4 · Family agent<br/>proposes · humans confirm"]
    A4 --> A5["Act 5 · First death<br/>sweep linked funds"]
    A5 --> A6["Act 6 · Both gone<br/>heirs claim"]
    style A1 fill:#1a3a5c,color:#fff
    style A4 fill:#4a3a6c,color:#fff
    style A5 fill:#5c2a2a,color:#fff
    style A6 fill:#2a5c3a,color:#fff
```

**The core mechanic — the trust's state machine (spans Acts 2→6):**

```mermaid
stateDiagram-v2
    [*] --> BOTH_ALIVE : trust founded
    BOTH_ALIVE --> CHALLENGE : heartbeat missed
    CHALLENGE --> BOTH_ALIVE : Selfie Check in window — death cancelled
    CHALLENGE --> ONE_DECEASED : challenge window elapses
    ONE_DECEASED --> BOTH_DECEASED : second partner lapses
    BOTH_DECEASED --> [*] : estate settled
    note right of BOTH_ALIVE
        partners claim 50/50
        spend via hito tiers
        agent proposes
    end note
    note right of ONE_DECEASED
        survivor claims per rules
        collectFromDeceased sweeps
        linked wallets into trust
    end note
    note right of BOTH_DECEASED
        heirs claim their %
        NFC age gate for minors
        agent passes to heirs
    end note
```

## Cast & Demo Setup (prepare Sat PM — T12)

- **Alice & Ben** — bonded partners. Pre-created World IDs (1 bond per human = no spontaneous bonding on stage), Orb/NFC tier.
- **Carla** — their heir. Demo identity with NFC (age ≥18 verified) for the claim moment.
- **Employer** — any funded wallet that pays USDC to the trust's ENS name.
- **Devices on stage:** 2 phones (mirrored), 2 hito devices, 1 laptop (subgraph/worldscan views).
- **Demo params:** heartbeat interval 2 min (prod: 90 days), challenge window 30 s, Alice's personal demo wallet has **pre-approved the vault** (the "linked wallet" allowance the sweep needs).

---

## Act 1 — Founding (Scene 1: Bond)

| Screen | What happens | On-chain |
|---|---|---|
| **S1 Verify** | Tier badges (Selfie / NFC / Orb). Copy states the gate: *"A shared trust needs NFC or Orb verification."* | World ID proof |
| **S2 Propose** | Alice picks Ben (QR / username) | `proposeBond()` (live contract) |
| **S3 Vows** | Ben accepts; vow text shown; VowNFT preview | `acceptBond()` → VowNFT |
| **S4 Trust is born** | One celebratory screen: Safe created · `alice-ben.humanbond.eth` registered · charter stored on Walrus (blob ID visible) | Safe deploy · ENS subname · Walrus blob |
| **S5 Trust settings** | Three onboarding steps: (a) inheritance opt-in — *"Is this the trust your life savings should flow to when you die?"* (b) hito threshold slider — *"ask my hardware wallet above $X"* (c) hito pairing (W1) | threshold stored in vault config |

## Act 2 — Daily Life (Scenes 2+3: Money & Hardware)

| Screen | What happens | On-chain |
|---|---|---|
| **S6 Trust home** | Balance · members · ENS address front and center (this IS the routing story: give this address to whoever pays you) · per-member monthly spend stat · heartbeat status chips (green) | reads vault |
| **S7 Receive** | Employer sends 1,000 USDC to the ENS name → balance ticks up live | ERC-20 transfer to Safe |
| **S8 Claim** | Ben claims his 50% to his personal wallet — one tap, no co-signature. *Claims, not custody.* | `claim()` on vault |
| **S9 Spend small** | Alice pays $8 (below threshold) — phone only, instant | Safe tx |
| **S10 Spend large** | Alice tries $500 → **hito lights up**, shows real recipient + amount on its own display (WYSIWYS), she confirms on-device | Safe tx w/ hardware signer (W2) |

**Money flow (Acts 2, 5, 6 in one picture):**

```mermaid
flowchart TD
    E[Employer / anyone] -->|USDC to alice-ben.humanbond.eth| V[(Trust Vault<br/>Safe)]
    AW[Alice's personal wallet] -.->|pre-approved allowance<br/>while alive| V
    V -->|claim 50% anytime| A[Alice]
    V -->|claim 50% anytime| B[Ben]
    V -->|spend below X: phone only| P1[payment]
    V -->|spend above X: hito confirm| P2[payment]
    AW ==>|ONE_DECEASED:<br/>collectFromDeceased| V
    V ==>|BOTH_DECEASED:<br/>heir claims %| C[Carla]
    linkStyle 6 stroke:#c0392b
    linkStyle 7 stroke:#27ae60
```

## Act 3 — The Family Grows (Scene 5a: Heirs)

| Screen | What happens | On-chain |
|---|---|---|
| **S11 Heirs** | Add Carla: % slider (e.g. 100% after both gone). Two modes: wallet address OR *"no wallet yet"* → pending entry, note: *"claimable once she verifies (NFC, 18+)"* | heir row in vault claims table |
| **S12 Charter v2** | Updated charter (heir allocations) re-stored on Walrus — *"a will that cannot be lost"* — visible in trust home | Walrus blob v2 |

## Act 4 — The Family Agent (Scene 4: Agents, Saturday)

| Screen | What happens | On-chain |
|---|---|---|
| **S13 Personal agent chat** | Leon (as Ben) tells **his personal agent**: *"Ask our family agent to set aside 100 USDC a month for Carla."* | — |
| **S14 Family agent thinks** | The **family agent** (0G, owned by the Safe, both partners authorized via `authorizeUsage`) checks the charter, runs TEE-verified inference, drafts a proposal. **AgentKit badge:** *"requested by a verified human member of this trust"* — bots without human backing are refused (show one refused request!) | 0G inference proof · AgentKit verification |
| **S15 Proposal inbox** | Proposal card: amount, purpose, TEE signature, confirmation status Alice ⬜ / Ben ⬜ → **both hito devices light up** → both confirm → executes | Safe proposal → threshold sigs → exec (W3+W4) |

**The refused-bot beat matters:** AgentKit's track is "tell a bot from a human-backed agent" — show the negative case for 10 seconds.

**The full choreography (W3+W4):**

```mermaid
sequenceDiagram
    actor Ben
    participant PA as Personal Agent
    participant FA as Family Agent<br/>0G · owned by Safe
    participant AK as World AgentKit
    participant Safe as Trust Safe
    participant HA as hito Alice
    participant HB as hito Ben
    Ben->>PA: set aside 100 USDC monthly for Carla
    PA->>FA: request on Ben's behalf
    FA->>AK: verify human backing of requester
    AK-->>FA: verified — bonded member
    Note over FA: charter check + TEE-verified inference
    FA->>Safe: proposal (TEE-signed)
    Safe-->>HA: confirmation request
    Safe-->>HB: confirmation request
    Note over HA,HB: both devices show real<br/>recipient + amount (WYSIWYS)
    HA-->>Safe: confirmed on device
    HB-->>Safe: confirmed on device
    Safe->>Safe: execute
    rect rgb(90, 40, 40)
    Note over PA,AK: negative case: unbacked bot request → AgentKit refuses → no proposal rights
    end
```

## Act 5 — The First Death (Scene 5b)

| Screen | What happens | On-chain |
|---|---|---|
| **S16 Heartbeat lapse** | Alice's chip turns amber → *"Alice hasn't confirmed life in 2 min"* → challenge window countdown. **Twist first:** Alice returns, taps check-in, **Selfie Check verifies her face → death cancelled.** *"No key can fake this."* Then (demo) she lapses for real. | `checkIn()` Selfie-gated · then state → ONE_DECEASED |
| **S17 Trust in mourning** | Trust home in muted state: *"Alice · deceased."* Ben taps **"Collect Alice's linked funds"** → her pre-approved personal wallet is swept into the trust (**Geld wird eingezogen**). Ben's claims now follow Alice's rules; the family agent keeps working, confirmations now Ben-only. | `collectFromDeceased(token, alice)` via allowance |

## Act 6 — The Bond Outlives Them (Scene 5c)

| Screen | What happens | On-chain |
|---|---|---|
| **S18 Second lapse** | Ben lapses too → state BOTH_DECEASED. The trust does not die — it waits. | state transition |
| **S19 Heir claim** | Carla opens the app, NFC-verified (≥18) → *"You are the heir of alice-ben.humanbond.eth"* → claims her share. VowNFT & milestones remain as soulbound memory. Closing line: the family agent — with its memory — passes to her (`transfer()`/`authorizeUsage`, ERC-7857). *"She doesn't just inherit the money. She inherits the manager who knows the family."* | heir `claim()` · (agent handover: pitch line, build only if 0G booth confirms key handling) |

**Closing shot:** the laptop — subgraph query showing the bond's whole life as public record: founded, funded, grown, mourned, inherited.

---

## Screen Inventory → Build Mapping

| Screens | Build task | Owner |
|---|---|---|
| S1–S3 | exist (live app) + tier-gate copy (T4) | Franco |
| S4–S5 | T1+T2+T3 UI + settings flow (T6/T7) | Franco + Leon copy |
| S6–S8 | trust home + claim (T1 UI) | Franco |
| S9–S10 | hito W1/W2 (T7) | Mischa |
| S11–S12 | heir UI (T6) + Walrus v2 (T3) | Franco + Leon |
| S13–S15 | agents (T8/T9/T10) + proposal inbox UI | Francesca + Franco + Mischa |
| S16–S18 | heartbeat UX + death states (T5 + **new: T15**) | Franco + Mischa |
| S17 collect | **new: T14 sweep function** — `collectFromDeceased()`, one function, allowance-based | Mischa |
| S19 | heir claim flow (T6 extension) | Franco |

## On-Chain Events (what the subgraph indexes — T11)

BondCreated · TrustCreated · CharterStored(v) · Received · Claimed · ThresholdSet · ProposalCreated/Confirmed/Executed · CheckIn · DeathStateEntered/Cancelled · FundsCollected · HeirClaimed

## Timing

- **Video (<3 min, Sat night):** Act 1 30s · Act 2 40s · Act 3 15s · Act 4 45s · Act 5 30s · Act 6 20s
- **Live judging (if longer):** same order, the resurrection beat (S16) and the double-hito confirm (S15) are the two moments to milk.
