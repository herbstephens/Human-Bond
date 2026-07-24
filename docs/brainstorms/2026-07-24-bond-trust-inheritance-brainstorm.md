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

**Hito as the trust's notification channel:** above threshold X, the Safe/agent pushes the proposal to the hardware device itself — display and confirmation happen **out-of-band**. Even with phone + PIN compromised (the exact threat model above), the attacker never sees the approval channel. This is also hito's product pitch inside the project.

## Sweep Problem — Mischa's Three Options, Compared

| Option | Mechanism | Verdict |
|---|---|---|
| a) Give heirs wallet access after death | key handover / social recovery | ❌ Recreates the exact seed-phrase problem inheritance is meant to solve: all-or-nothing access, no partial allocations, no minor gate, no audit trail |
| b) Auto-send all funds to the ENS address at death | allowances / smart-account module granted **while alive**, exercisable only in death state, opt-in per wallet and token | ✅ **Recommended** for linked external wallets. Limitation: native ETH needs a smart account (allowances only cover tokens) |
| c) Access to the ENS address via hito hardware wallet | physical device as key to the vault | ❌ As death mechanism: a lost/broken device is a single physical point of failure (raised in the room). Hito's place is the spending tiers above |

**Core principle: heirs inherit *claims*, not *keys*.** The vault switches claim rights by state (alive → one deceased → both deceased); nobody ever needs the deceased's keys. Options (a) and (c) are key-inheritance thinking; the protocol's whole point is rule-inheritance.

## 0G — Verified AI Trust Manager (post-workshop idea)

**The idea:** the trust gets an auditable AI executor — it monitors heartbeat/death evidence, executes payouts per the charter, potentially manages vault assets. 0G's TEE-sealed verifiable inference is what makes "verified" real: every executor decision is provable, which is exactly what you want from the entity that decides whether you are dead. *"The executor is an auditable AI, not an uncle."*

**Why the trust *owns* the agent (vs. any LLM making suggestions)** — checked against the 0G docs:

1. **The agent is itself inheritable.** On 0G an agent is a token (ERC-7857 "Agentic ID") whose encrypted intelligence — memory, learned behavior, state — **transfers with ownership** (TEE-oracle re-encryption; the new owner receives the fully functional agent, the old owner loses access). The executor that knows years of the family's finances and charter is an asset in the vault like USDC and TIME — and passes to the heirs with its memory intact. An external LLM account hangs on one person and one credit card and dies with them.
2. **Verifiable decisions.** 0G inference runs in a TEE (TeeML: model inside the enclave, response signed with the TEE key; TeeTLS: verified proxy). Every proposal is cryptographically attributable to a specific model run — auditable and disputable later. A normal LLM API is unverifiable and silently model-swapped.
3. **Private persistent memory owned by the trust.** Charter, investment policy and family financials live encrypted in the agent's iNFT intelligence / 0G storage — not in a vendor's context window.
4. **Bounded on-chain agency.** The agent holds a **proposer role** on the Safe: it can queue transactions autonomously but never execute. Execution runs through the hito tiers. Autonomy with zero unilateral power — Safe supports the proposer/signer separation natively.

**Rejected alternative:** one personal agent per member whose "behavior" gets inherited. Behavior can be reconstructed post-hoc from transaction history and policy — and inherited intent belongs in the **charter** anyway (a testament *is* recorded intent that survives you; the trust agent executes it). Neutrality seals it: the executor must serve the trust, not one partner — per-member agents would end up negotiating against each other.

**Interaction model:** every bond member may write to the agent. Access is signature-gated (Safe-owner key or World ID proof of a bond member), so the agent always knows who is speaking and keeps per-member context. Requests above the thresholds become Safe proposals that run through the confirmation tiers — anyone can chat, only the process moves money. Design default: **one shared transparent log** — shared money means shared visibility; private channels are the exception.

**Shared investments and purchases:** the agent proposes per the investment policy in the charter (DCA, yield on idle USDC, joint purchases, bills); members confirm via hito above thresholds. This gives the "build shared wealth" decision its engine — the vault turns from passive storage into managed shared wealth.

**Why hardware confirmation is non-negotiable here — the more autonomous the agent, the more critical the hito anchor:**

An autonomous agent with a proposer role is, by design, an **untrusted proposal stream**. The TEE proves *which model* produced a proposal — it does not prove the proposal is correct or benign. Verifiability ≠ correctness. So the security model must assume proposals can be wrong or hostile, and place one trust anchor behind them that no software compromise can reach:

| Attack vector | Example | What stops it |
|---|---|---|
| Prompt injection | any bond member (or a hacked member account) chats the agent into proposing a transfer to an attacker address | proposal lands in the Safe queue — **hito on-device display shows the real recipient/amount**, human declines |
| Model error / hallucination | agent misreads the charter, proposes a 10x oversized investment | same — the human sees the actual numbers on a display the agent cannot draw on |
| Compromised agent host | the off-chain loop is hacked, starts queueing drains | proposals ≠ execution; nothing moves without hardware confirmation |
| Compromised phone UI | phone shows "send $50 to partner", actually signs "drain to attacker" | **what-you-see-is-what-you-sign**: the hito screen renders the transaction independently of the phone |

One sentence for the pitch: **autonomy upstream requires a trust anchor downstream** — the agent may think, propose, and manage; only a human with hardware in hand may execute. This is exactly why hito is not an accessory in this architecture but its load-bearing security layer.

**Caveats from the docs:** (1) "fully autonomous" means an autonomous *off-chain* loop with on-chain identity — the docs document no on-chain-triggered inference; (2) inference is paid from a **prepaid 0G-token account** (batch settlement) which the trust tops up from its own funds — the trust pays its own manager; (3) whether a *contract* (the Safe) can own an ERC-7857 token is not explicitly documented — key delivery on transfer uses the receiver's public key, non-trivial for a multisig. **Question for the 0G booth.**

**Prize reality (checked Jul 24):** 0G "Best AI Product" is $6,000 (3k/2k/1k) and requires a **working demo with actual 0G Compute inference**, live link, public repo, <3-min video. That is real build scope, not a pitch slide. Continuity track ($1,500) requires a prior 0G submission — we have none.

**Position:** the brief said skip 0G — but that predates Francesca (AI) joining the team. Decision for tonight: either Francesca owns a minimal v0 (agent reads bond state via the subgraph, drafts the death-verification decision through 0G inference) as an **optional stretch after ENS + Walrus are safe** — or 0G stays a named roadmap phase. It must not endanger the two clean wins.

## Open Questions (need Herb)

- **50/50 is brand ideology.** Configurable percentages enable business bonds and estates but dilute the equal-partner story. Grundsatz question, not a feature question.
- **One bond per person** is enforced on-chain today (`activeBondOf` reverts on a second proposal). Multiple bonds (partner + business) = contract-core change — post-hackathon at the earliest.
- **Who owns smart contracts now?** The brief assigns contract layers to Leticia; she is no longer on the team per the README. Every contract-touching line above depends on this answer.

## Proposed Next Step

~~(a) pull-based claims as the incoming-funds answer~~ ✅ **decided Jul 24** — claim model adopted. Still open for tonight: (b) inheritance/trust as the named roadmap phase in the pitch, (c) contract ownership (a new contract is needed for the claim model — "whole new contract" per the conversation), (d) 0G go/no-go for Francesca, (e) pin down in writing what the current USDC split code actually does. Then the 36 hours stay on track — two clean Continuity wins.
