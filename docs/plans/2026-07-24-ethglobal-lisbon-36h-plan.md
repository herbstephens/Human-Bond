---
date: 2026-07-24
topic: ethglobal-lisbon-36h-plan
author: Leon (Product / PM / UX)
status: draft — for task assignment in tonight's team round
input: docs/brainstorms/2026-07-24-bond-trust-inheritance-brainstorm.md
---

# HumanBond — 36h Execution Plan, ETHGlobal Lisbon

**One line for the team:** Before this weekend the bond is something you *have*. After this weekend it is something you *use* — it has a name, holds money, both partners spend and claim from it, and (roadmap) it outlives you.

---

## Now → After

| | **NOW (before hackathon — live on mainnet)** | **AFTER (Sunday submission)** |
|---|---|---|
| Bond | Propose/accept with World ID Orb, VowNFT, MilestoneNFT, dissolution | unchanged (Continuity anchor — don't touch what's live) |
| Shared wallet | Safe creation exists but **optional**, disconnected from bond flow | **Safe ships automatically with every bond** |
| Address | none | **`alice-bob.humanbond.eth`** registered at bond creation, resolves to the Safe |
| Money in | USDC only, split behavior undocumented | USDC (+ TIME) accrue in the vault; **each partner claims 50% anytime**; per-partner monthly spend stat |
| Identity | Tier 4 Orb only | **+ Selfie Check (Tier 1) and NFC passport (Tier 2)** sign-up |
| Documents | NFT metadata only | **Vow + partnership charter permanent on Walrus** |
| Queryability | contract calls only | **Public subgraph on The Graph** |
| Inheritance | does not exist | **Opt-in question at onboarding + beneficiary UI preview** (labeled roadmap) — pitch phase "The bond that outlives you" |

## Requirements

**Weekend — MUST (prize anchors):**
- R1: Bond creation auto-creates the Safe vault (no longer optional)
- R2: ENS subname registered at bond creation, resolving to the Safe
- R3: USDC sent to the ENS address accrues in the vault — **no auto-split**
- R4: Each partner can claim 50% of vault balance at any time
- R5: Selfie Check + NFC Credentials integrated in sign-up
- R6: Vow + charter stored on Walrus, referenced from VowNFT metadata
- R7: Subgraph indexes bond lifecycle events, publicly queryable

**Weekend — SHOULD (differentiators, cheap):**
- R8: Inheritance opt-in question in onboarding ("Is this the bond your life savings should flow to when you die?")
- R9: Beneficiary designation UI (roadmap-labeled preview, no contract)
- R10: Per-partner monthly spend stat in the vault UI

**Weekend — STRETCH (gated, see timeline):**
- R11: 0G agent v0 — reads bond state via subgraph, produces one proposal via TEE-verified 0G inference
- R12: hito signs a Tier-2 Safe confirmation live on stage (feasibility: only Mischa can judge)

**Roadmap — pitch slides ONLY, zero build:**
- Heartbeat + death states, World-ID "I'm alive" veto, beneficiary claims via nullifier, sweep allowances, hito tier policy, agent charter execution

## Task Plan — Who / When / How Realistic

Realism: ✅ high · 🟡 medium (needs first-hour feasibility check) · 🔴 low / gated

| # | Task | Owner | Prize | Realism | Est. |
|---|---|---|---|---|---|
| T1 | Safe auto-create wired into bond flow + claim-50% function (Safe SDK, **avoid new Solidity** — Safe creation code already exists) | Mischa | — (enables all) | ✅ | 6–10h |
| T2 | ENS subname via Durin at bond creation → Safe address | Franco | ENS $2k | ✅ | 4–8h |
| T3 | Walrus upload of vow + charter at bond creation | Francesca | Walrus $2k | ✅ | 3–5h |
| T4 | Subgraph: BondCreated/Dissolved/YieldClaimed etc. | Francesca | Graph $4k | 🟡 verify World Chain support tonight | 3–6h |
| T5 | Selfie Check + NFC sign-up (beta APIs — timebox 4h, World booth if stuck) | Franco | World 2×$3.5k | 🟡 | 4–8h |
| T6 | Onboarding: inheritance question + beneficiary UI + spend stat (copy: Leon) | Leon + Franco | — (demo & story) | ✅ | 3–4h |
| T7 | End-to-end demo path: create bond → ENS appears → send USDC → partner claims 50% | all | — (the demo) | ✅ | integration |
| T8 | 0G agent v0 | Francesca | 0G $6k | 🔴 gated Sat 15:00 | 6–10h |
| T9 | hito Tier-2 confirm demo | Mischa | — (stage wow) | 🟡 Mischa judges | ? |
| T10 | Pitch deck + 3-min video + per-track submission texts | Herb + Leon | all | ✅ | Sun AM |

## Timeline & Gates

**Tonight (Fri):**
1. Team round on the brainstorm doc → assign T1–T10, resolve the 3 open decisions (contract ownership, 0G go/no-go direction, roadmap slide)
2. Mischa writes down what the current USDC split code actually does (blocks T1)
3. First-hour feasibility checks: The Graph × World Chain (T4) · Durin testnet/mainnet (T2) · 0G booth: can a Safe own an ERC-7857? (T8)
4. Env sharing: World App ID etc. for everyone's local setup

**Sat 09:00–13:00:** T1–T4 build in parallel · Leon writes UX copy + specs for T6 · Herb + Leon pitch skeleton
**Sat 13:00:** integration checkpoint — T1+T2 must connect (bond → Safe → ENS)
**Sat 15:00 — GATE:** T8 go/no-go: **only if T1–T4 are green.** No exceptions — the brief's rule stands: two clean wins beat seven reaches
**Sat 15:00–21:00:** T5, T6, stretch tasks · **Sat 21:00: record backup video of the working demo flow** (non-negotiable — mainnet demos fail on stage)
**Sun 08:00–12:00:** T10 — each prize track needs its own submission text; video <3 min; demo dry-run ×2

## Pitch — Before / Built / Vision

**For the team (how to talk about it):** one sentence per layer, no protocol lecture — "We made the bond usable: it has a name (ENS), a wallet (Safe), money flows in and both claim (vault), documents live forever (Walrus), anyone can verify it (Graph), and joining got easier (Selfie/NFC)."

**For the judges (Continuity structure):**
1. **Before the hackathon:** live on World Chain mainnet — bond registry, VowNFT, TIME token, mini app in the World App store. Show worldscan + app store, 30 seconds.
2. **Built this weekend:** the bond got an *economy* — demo T7 live: create → ENS → pay → claim. Each sponsor integration gets its 20 seconds inside the one flow (not as a feature list).
3. **Vision (one slide):** "The bond that outlives you" — heartbeat, World-ID alive-veto, beneficiaries via nullifier, the auditable AI executor. Explicitly labeled roadmap; judges reward honesty about what's built vs. planned.

| Track | What we show | Proof |
|---|---|---|
| World Selfie / NFC | Tier 1/2 sign-up in the live flow | app demo |
| ENS | subname minted during bond creation | resolver on-chain |
| Walrus | charter blob ID in VowNFT metadata | Walrus explorer |
| The Graph | live query against our subgraph | playground |
| 0G (if built) | TEE-signed proposal in the vault UI | signed response |

## Risks

1. **Contract ownership still unassigned** (Leticia gone) → mitigate: T1 uses Safe SDK, weekend stays Solidity-free; decide owner tonight anyway
2. **Beta API friction (Selfie/NFC)** → timebox 4h, then World booth, then drop to one of the two tracks
3. **The Graph × World Chain unsupported** → check tonight; if negative, drop T4 (don't substitute a non-Graph indexer — the prize requires The Graph)
4. **Mainnet demo failure on stage** → backup video Sat 21:00, tiny amounts, dry-runs Sunday
5. **Inheritance scope creep** — the excitement is the danger; everything beyond R8–R10 is slides. The doc's rule is the law of the weekend.
