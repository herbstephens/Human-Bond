---
date: 2026-07-24
topic: bond-trust-inheritance
author: Leon (Product / PM / UX)
status: proposal — for team discussion tonight
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

## Open Questions (need Herb)

- **50/50 is brand ideology.** Configurable percentages enable business bonds and estates but dilute the equal-partner story. Grundsatz question, not a feature question.
- **One bond per person** is enforced on-chain today (`activeBondOf` reverts on a second proposal). Multiple bonds (partner + business) = contract-core change — post-hackathon at the earliest.
- **Who owns smart contracts now?** The brief assigns contract layers to Leticia; she is no longer on the team per the README. Every contract-touching line above depends on this answer.

## Proposed Next Step

Agree tonight: (a) pull-based claims as the incoming-funds answer for the ENS address, (b) inheritance/trust as the named roadmap phase in the pitch, (c) contract ownership. Then the 36 hours stay exactly as planned — two clean Continuity wins.
