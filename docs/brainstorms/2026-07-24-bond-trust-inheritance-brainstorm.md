---
date: 2026-07-24
topic: bond-trust-inheritance
author: Leon (Product / PM / UX)
status: v2 — updated after on-site team conversation + 0G workshop, Jul 24
---

# The Bond Is a Trust — Inheritance as the Next Protocol Phase

## The Idea in One Sentence

The bond wallet (`alice-bob.humanbond.eth`) becomes a single claims-based vault for **both** states of a partnership: shared income while both partners live, and the estate when they don't — one mechanism, not two features.

## Before / After — What Actually Changes

| Dimension                                  | Before (current plan, per HumanBond_Brief)                                                                        | After (this proposal)                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Weekend scope**                          | ENS subnames · Walrus · The Graph · Selfie Check/NFC · `finalizeWorkAndDistribute()`                              | **Identical.** Only one open decision gets an answer (next row).                                                                            |
| **Funds arriving at the bond ENS address** | Unspecified — brief names the address, not the mechanics                                                          | **Pull-based claims:** funds accrue in the bond vault, each partner claims their share (0xSplits pattern). No auto-forwarding.              |
| **What the bond *is***                     | A 2-person partnership record with a 50/50 TIME split, alive-only                                                 | A **trust**: shared vault while alive, estate vehicle at death — same claims primitive throughout (roadmap)                                 |
| **Death**                                  | Not addressed anywhere in protocol or product — TIME streams 1/day forever, bonds never end except by dissolution | Heartbeat per partner → challenge window → **World ID re-verification as "I'm alive" veto**; defines TIME's end-of-life semantics (roadmap) |
| **Both partners die (shared accident)**    | Undefined — assets stranded                                                                                       | Beneficiary tier of the same state machine: children/third parties claim from the vault (roadmap)                                           |
| **Beneficiaries / children**               | Do not exist as a concept                                                                                         | Claims bound to **World ID nullifier, not address**; NFC passport check (built this weekend) doubles as the ≥18 claim gate (roadmap)        |
| **Documents on Walrus**                    | Vows, partnership charter, milestone records                                                                      | + inheritance charter as one more document type — same infrastructure                                                                       |
| **Pitch narrative**                        | Live product + 4 infrastructure upgrades, phases: Stellar (Oct) → x402 → 0G                                       | Same, plus one named phase: **"The bond that outlives you"** — emotionally the strongest slide                                              |

Everything labeled *(roadmap)* is pitch material, not weekend build. The only weekend-relevant change is the claims decision — which the team must make anyway to ship the ENS integration.

## The State Machine

Each partner maintains a heartbeat (periodic check-in). The bond moves through three states:

| State | Trigger | Who can claim from the bond vault |
|---|---|---|
| **1. Both alive** | default | Both partners, per split rules (pull-based, not auto-split) |
| **2. One deceased** | one heartbeat lapses + challenge window passes | Surviving partner, per the deceased's rules |
| **3. Both deceased** | both heartbeats lapse (e.g. shared accident) | Beneficiaries — children, third parties, institutions, per allocation |

The simultaneous-death case (state 3) is not an edge case bolted on — it is simply the next tier of the same machine. Legal analogy that everyone knows: this is the **Berliner Testament as a smart contract** — partner inherits first, children after the second death. Centuries-old estate law (commorientes doctrine), finally executable.

## Three Design Constraints (solved, not open)

1. **The sweep problem.** A contract cannot pull assets from an EOA after death. "Linking a wallet" therefore means granting the bond contract an allowance (ERC-20 approve / smart-account module) **while alive**, exercisable only in death state. This defines the onboarding UX: link wallets = grant permissions.
2. **World ID as the "I'm alive" veto — our moat.** After a heartbeat lapse, a challenge window opens in which the supposedly deceased can cancel the death state with a **fresh World ID proof** (Orb / Selfie Check). Every other dead-man's-switch protocol (Sarcophagus etc.) relies on key signatures — keys can be stolen; biometric liveness cannot. On-chain inheritance only truly works on World infrastructure. This is the argument for the World judges.
3. **Beneficiaries without wallets (minors).** Claims attach to the **World ID nullifier, not an address** — claimable whenever the child verifies, even years later. The age gate comes for free: the **NFC passport check (Tier 2) we are building this weekend** proves ≥18 and unlocks the claim. The inheritance vision feeds the prize tracks instead of competing with them.

## Fit With the Current Plan (per HumanBond_Brief)

**Nothing about the weekend scope changes.** Two contributions land inside it:

- **Open gap we must decide anyway:** the brief sets the bond ENS name as receiving address but never specifies what happens to funds arriving there. Proposal: **pull-based claims** (funds accrue, entitled parties claim — 0xSplits pattern), because it is the same primitive the estate later uses. Deciding this correctly now costs nothing and makes the vault model a config change later, not a rebuild.
- **UX / comprehensibility** of the existing flows (Leon's role per README).

**Inheritance itself is a roadmap phase, not weekend scope** — positioned after Stellar settlement (Oct), pitched as: *"The bond that outlives you."* It also closes a genuine protocol-level hole: TIME streams 1 TIME/day to every verified human for life — nothing in the protocol defines what happens to the stream, the Age Grant, or governance weight at death. HumanBond is the natural home for TIME's end-of-life semantics.

## Decisions — Team Conversation, Jul 24 (on-site)

1. **Shared wallet ships with the bond.** The Safe (multisig) is no longer optional — it is created automatically at bond formation, and the ENS subname appears at that moment, not later.
2. **Claim model adopted** ("the most elegant flow"): payments/salary arrive at the bond ENS address, each partner can claim 50% at any time; the survivor claims when the partner is deceased. Rationale: easier accounting than auto-split, and the vault lets partners **build shared wealth** instead of instantly atomizing it.
3. **Inheritance becomes one onboarding question** at bond creation: *"Is this the bond your life savings should flow to when you die?"* Opt-in, one sentence.
4. **Work/TIME platform is out of weekend scope.** Demo shows the utility ("pay someone → funds land at the bond → partner claims 50%"), not the platform. The mechanics stay underneath.
5. **UI addition:** per-partner monthly spend stat ("you have X left of your share this month").

**Corrections to the "Before" state** (the current build knows more than the brief): shared wallet is a **Safe**; **USDC is the only supported token** so far and has some existing direct-split behavior — the exact current behavior (split on receipt vs. on dissolution) must be pinned down in writing; a **spending-limits concept** exists (small amounts single-signer, larger amounts require both partners).

## TIME Semantics (settled)

- **Daily UBI TIME (1/human/day) goes to each person's own wallet, individually. Never split.** (Confirmed.)
- **Work TIME:** per the TIME architecture, 1 TIME = 1 verified hour — so 8 hours of work cost **8 TIME** (+ optionally USDC), not 8/24 of one. Hard cap: ≤23 Work TIME/day (24 minus the 1 UBI).
- **Work TIME is partnership income** → it flows to the bond vault and is claimable 50/50 — the same claim primitive as USDC.
- **Should the ENS address receive TIME? Yes.** TIME is an ERC-20 on World Chain; the vault treats it exactly like USDC under the claim rules. One primitive, two assets — no special case needed.

## Security Tiers — Where the Hito Hardware Wallet Fits (Mikhail)

Threat model: someone holds your phone and knows your PIN (or the hot wallet is compromised) → they can drain the trust through World App in seconds. Answer: a three-tier spending policy on the Safe, thresholds **self-defined per bond**:

| Tier | Amount | Required to sign |
|---|---|---|
| 1 | below X | one partner, phone only |
| 2 | above X | + **hito hardware confirmation** |
| 3 | above Y | **both bond holders** (+ hito) |

Hito is the **transaction-security layer of the living trust — not the inheritance mechanism** (see next section for why).

## Sweep Problem — Mischa's Three Options, Compared

| Option | Mechanism | Verdict |
|---|---|---|
| a) Give heirs wallet access after death | key handover / social recovery | ❌ Recreates the exact seed-phrase problem inheritance is meant to solve: all-or-nothing access, no partial allocations, no minor gate, no audit trail |
| b) Auto-send all funds to the ENS address at death | allowances / smart-account module granted **while alive**, exercisable only in death state, opt-in per wallet and token | ✅ **Recommended** for linked external wallets. Limitation: native ETH needs a smart account (allowances only cover tokens) |
| c) Access to the ENS address via hito hardware wallet | physical device as key to the vault | ❌ As death mechanism: a lost/broken device is a single physical point of failure (raised in the room). Hito's place is the spending tiers above |

**Core principle: heirs inherit *claims*, not *keys*.** The vault switches claim rights by state (alive → one deceased → both deceased); nobody ever needs the deceased's keys. Options (a) and (c) are key-inheritance thinking; the protocol's whole point is rule-inheritance.

## 0G — Verified AI Trust Manager (post-workshop idea)

**The idea:** the trust gets an auditable AI executor — it monitors heartbeat/death evidence, executes payouts per the charter, potentially manages vault assets. 0G's TEE-sealed verifiable inference is what makes "verified" real: every executor decision is provable, which is exactly what you want from the entity that decides whether you are dead. *"The executor is an auditable AI, not an uncle."*

**Prize reality (checked Jul 24):** 0G "Best AI Product" is $6,000 (3k/2k/1k) and requires a **working demo with actual 0G Compute inference**, live link, public repo, <3-min video. That is real build scope, not a pitch slide. Continuity track ($1,500) requires a prior 0G submission — we have none.

**Position:** the brief said skip 0G — but that predates Francesca (AI) joining the team. Decision for tonight: either Francesca owns a minimal v0 (agent reads bond state via the subgraph, drafts the death-verification decision through 0G inference) as an **optional stretch after ENS + Walrus are safe** — or 0G stays a named roadmap phase. It must not endanger the two clean wins.

## Open Questions (need Herb)

- **50/50 is brand ideology.** Configurable percentages enable business bonds and estates but dilute the equal-partner story. Grundsatz question, not a feature question.
- **One bond per person** is enforced on-chain today (`activeBondOf` reverts on a second proposal). Multiple bonds (partner + business) = contract-core change — post-hackathon at the earliest.
- **Who owns smart contracts now?** The brief assigns contract layers to Leticia; she is no longer on the team per the README. Every contract-touching line above depends on this answer.

## Proposed Next Step

~~(a) pull-based claims as the incoming-funds answer~~ ✅ **decided Jul 24** — claim model adopted. Still open for tonight: (b) inheritance/trust as the named roadmap phase in the pitch, (c) contract ownership (a new contract is needed for the claim model — "whole new contract" per the conversation), (d) 0G go/no-go for Francesca, (e) pin down in writing what the current USDC split code actually does. Then the 36 hours stay on track — two clean Continuity wins.
