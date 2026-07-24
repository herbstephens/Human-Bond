---
date: 2026-07-24
topic: ethglobal-lisbon-36h-plan
author: Leon (Product / PM / UX)
status: v2 — demo-first restructure after Fri team decisions (agents Sat, Plan A confirmed, Mischa on contracts)
input: docs/brainstorms/2026-07-24-bond-trust-inheritance-brainstorm.md
deadline: SUBMISSION SUNDAY 09:00 — video + texts must be DONE SATURDAY NIGHT
---

# HumanBond — The Demo Is the Plan

**The exclusive sentence:** *The bond that outlives you.*
**The strategy:** every sponsor integration is a chapter of ONE demo story, not a feature list. We think in scenes; every task exists because a scene needs it.

---

## The Demo — Five Scenes (~3 min)

| # | Scene | What the audience sees | Sponsor visible |
|---|---|---|---|
| 1 | **Bond** | Two Orb/NFC-verified humans form a bond → VowNFT; Safe vault + `alice-bob.humanbond.eth` + charter on Walrus appear automatically | ENS · Walrus · World (tier gate: Selfie is NOT enough to open a shared wallet) |
| 2 | **Shared money** | USDC sent to the ENS name → accrues in the vault → partner claims 50% on the phone; per-partner spend stat | — (the claim primitive) |
| 3 | **Hardware trust** | hito is linked to the trust; threshold set in onboarding; small spend passes phone-only, large spend → hito prompt, confirmed on-device | hito (WYSIWYS) |
| 4 | **Agents** (Saturday) | Leon asks his personal agent → it asks the trust agent → trust agent (0G, TEE-signed) checks the charter, verifies via **AgentKit** that the requesting agent is backed by a real bonded human → proposes on the Safe → BOTH partners confirm via hito → executes | World AgentKit ($8k!) · 0G |
| 5 | **The bond that outlives you** | Heirs + % set in UI; Selfie Check as 90-day proof-of-life (demo interval: 2 min); heartbeat lapses → death state → heir claims. Twist: the "deceased" returns and cancels death with a live Selfie Check | World Selfie (as heartbeat — the team's own decision, and exactly the "not generic login" the track demands) |

**Fallback rule:** if Scene 4 slips, Scenes 1+2+3+5 are still a complete, prize-worthy demo. Scene 4 must never endanger the spine.

**Detailed storyboard:** [`2026-07-24-demo-script.md`](./2026-07-24-demo-script.md) — the full lifecycle as a **family trust** saga (founding → daily money → heirs → family agent → first death incl. collecting the deceased's linked funds → second death → heirs claim), screen-by-screen (S1–S19) with build mapping. **Screens get built from that document.**

## Wallet Workstream (Mischa) — explicit, per Leon's spec

- **W1 — Link trust:** pair hito with the Safe (manually first, per Fri conversation)
- **W2 — Spending:** threshold from onboarding enforced; above X → hito confirmation
- **W3 — Agent proposal → wallet confirm:** trust-agent proposals land as Safe proposals; hito displays and confirms
- **W4 — Full choreography:** human → personal agent → trust agent → 0G proposal → BOTH partners confirm on their hito devices

W1+W2 = Scene 3 (P0-adjacent). W3+W4 = Scene 4 (Saturday).

## Contract Workstream — design principles

1. **One generic claims table, not hardcoded 50/50:** member/heir = same table with (address, basis points, state). Alive-state claimants = members, death-state claimants = heirs. This makes multi-member trusts and heirs the SAME contract feature — and keeps "invite more people to the trust" a config change later, not a rebuild.
2. **Vault ≠ Bond:** the vault module must not depend on bond internals — the bond instantiates it. (Enables business/community trusts later without touching the live bond contract.)
3. **HeartbeatRegistry:** `checkIn()` (World-ID/Selfie-gated), configurable interval (90 days prod / 2 min demo), `isDeceased()` view + challenge window. Holds no funds — low risk.
4. **Vesting: CUT from the weekend** (was "optional if trivial"). Gap analysis: it contaminates the death-state logic (does vesting continue during ONE_DECEASED? how does it apply to heirs?). Roadmap slide only.
5. The live mainnet bond contract is **never touched**.

## Task Matrix

| # | Task | Scene | Owner | Realism | When |
|---|---|---|---|---|---|
| T1 | Vault contract (generic claims table, states, claim fn) | 1/2/5 | Mischa | ✅ confirmed Fri | tonight |
| T2 | ENS subname at bond creation → Safe | 1 | Franco | ✅ | tonight |
| T3 | Walrus: charter (incl. heir allocations) at creation | 1/5 | Francesca | ✅ | tonight |
| T4 | World verification changes (Orb/NFC tier gate for wallet) | 1 | Franco | ✅ ("today" per Fri convo) | tonight |
| T5 | HeartbeatRegistry + Selfie check-in wiring | 5 | Mischa + Franco | 🟡 | Sat AM |
| T6 | Heir UI (add heirs, % sliders, pending entry for wallet-less kids) + inheritance opt-in question + spend stat | 5/2 | Leon (UX/copy) + Franco | ✅ | Sat AM |
| T7 | W1+W2 hito link + threshold enforcement | 3 | Mischa | 🟡 manual first | Sat AM |
| T8 | Trust agent v0 on 0G (reads vault state, TEE-signed proposal) | 4 | Francesca | 🟡 | Sat |
| T9 | Personal agent (thin chat client per human) + AgentKit human-backing verification | 4 | Franco + Francesca | 🟡 SDK unknowns | Sat |
| T10 | W3+W4 agent→Safe→hito wiring | 4 | Mischa | 🟡 | Sat PM |
| T11 | Graph subgraph (bond + vault + death events) | pitch "public registry" | whoever has slack | optional | Sat |
| T12 | Demo identities: pre-created bonds (1 bond per World ID — judges can't bond spontaneously!), demo heartbeat interval, dry-runs | all | Leon | ✅ | Sat PM |
| T13 | Video (<3 min) + per-track submission texts + deck | — | Herb + Leon | ✅ | **Sat NIGHT — deadline is Sun 09:00** |
| T14 | Sweep: `collectFromDeceased(token, from)` — allowance-based, death-gated (demo: Alice's wallet pre-approves the vault) | 5 (S17) | Mischa | ✅ one function | Sat AM |
| T15 | Death-state UI: heartbeat warning/countdown, mourning trust home, heir claim screen | 5 (S16–S19) | Franco + Leon | ✅ | Sat AM/PM |

## Prize Mapping (corrected Fri — brief numbers were outdated)

| Track | $ | Our entry |
|---|---|---|
| **World AgentKit New Use Cases** | **$8,000** | Scene 4: trust grants proposal rights only to agents proving human backing of a bonded member — literally the track description |
| World Selfie Check (Continuity variant exists) | $1,750 / $875×2 | Selfie as **proof-of-life heartbeat**, not login — the non-generic use the track demands |
| World Identity Check NFC (Continuity variant exists) | $1,750 / $875×2 | NFC as tier gate for wallet creation + age gate for heirs |
| ENS | $2,000 | Scene 1: the address that outlives you |
| Walrus | $2,000 | Scene 1/5: the will that can't be lost |
| The Graph | $4,000 | T11 if capacity: the public estate registry |
| 0G Best AI Product | $6,000 | Scene 4 trust agent (requires real 0G Compute inference + live link + video) |

## Schedule

- **Tonight (Fri):** T1–T4 foundations. Booth runs: World (what happens if Selfie re-verify is missed?) · 0G (can two humans manage one agent / can a Safe own an ERC-7857?)
- **Sat 09:00–13:00:** T5–T7 (inheritance + hito complete)
- **Sat 13:00 — CHECKPOINT:** Scenes 1/2/3/5 must run end-to-end. Only then:
- **Sat 13:00–19:00:** T8–T10 agents (+T11 if slack)
- **Sat 19:00 — FEATURE FREEZE.** T12 dry-runs, **record backup video of every scene**
- **Sat night:** T13 — video cut, submission texts per track, deck
- **Sun 08:00:** final submission check. 09:00 deadline.

## Open Decisions / Risks

1. **AgentKit SDK reality** — nobody has touched it yet; Franco timeboxes a spike Sat 09:00, go/no-go for Scene 4 at the 13:00 checkpoint
2. **Selfie re-verify semantics** (World booth) — defines what "missed heartbeat" means product-wise (insurance analogy from Fri: no renewal → no coverage)
3. **0G × Safe ownership — largely resolved by docs:** ERC-7857 has `authorizeUsage(tokenId, executor, permissions)` — the Safe owns the family-agent iNFT and authorizes BOTH partners as executors, no ownership transfer needed; contract ownership is supported. Remaining booth question: how is the sealed metadata key managed when the owner is a contract (TEE oracle?), and does one TEE-verified inference call qualify for Best AI Product?
4. **Minors:** Orb allows 14+ in some jurisdictions (Portugal!) — heir age gate must come from NFC tier, not Orb. Affects T6 copy.
5. **Sun-09:00 trap:** anything not demoable by Sat 19:00 does not exist. The video is the product.

## Gap Analysis (spec-flow, Sat 09:00) — resolutions to build in

**Contract-blocking — decide BEFORE T1/W1 starts (Mischa + Leon, first thing):**

- **G-CLAIM · Claim accounting:** naive `balance/2` breaks the moment one partner claims and the other spends (double-claim from the remainder). Spec: **cumulative accounting** — `claimable = totalReceived × bps − alreadyClaimed`; spends debit the **spender's** share (the per-member spend stat implies exactly this).
- **G-MODULE · Native Safe threshold cannot survive a death:** a 2-of-2 Safe can never be reconfigured after Alice dies — the change itself would need her signature. Execute everything through a **custom Safe module whose signature policy reads HeartbeatRegistry state**, not native thresholds.
- **G-SIGNERS · hito topology:** per partner one phone key + one hito key as owners; the module enforces which combination per amount; **single threshold X this weekend** (drop tier Y).

**Demo-killers — T12 prep (Leon):**

- **G-CLOCK:** with a 2-min interval both partners go amber during Acts 1–4, and the scripted double-lapse adds ~5 min of waiting. Heartbeat interval + challenge window must be **runtime-adjustable per partner**, armed at the start of Act 5.
- **G-BONDS · Rehearsals burn bonds:** every dry-run permanently consumes a verified World-ID pair (1 bond per human, live contract untouchable) and collides on the ENS label. Check tonight whether dissolution frees an ID for re-bonding; otherwise stock N fresh verified pairs with per-run ENS labels and **reserve one unbonded pair exclusively for showtime**.

**Small build additions (fold into tasks):**

- Death-state transitions need **explicit transactions** — a view emits no events: challenge-start fires automatically from the app, "declare lapsed" is a button (T5)
- **Prefund every demo EOA** (Alice, Ben, Carla, employer) in the deploy script — an empty wallet fails silently on stage (T12/P4)
- **Survivor rule hardcoded**: survivor claims 100%, and that line is printed in the charter blob — visibly "written down while alive" (T1/T3)
- Carla claims in **wallet-address mode on a third phone** (the two mirrored phones are Alice and Ben) (T6/T12)
- **Pre-test the employer wallet's ENS resolution** on World Chain Sat PM; fallback: resolve in our own UI, send to raw address, keep the name on screen (T2/T12)
- **Incoming-proposal screen** on the partner's phone (polling is fine) — the S2→S3 handoff is exactly what the audience watches (T6)
- **Canned rogue-bot trigger** + AgentKit refusal card — the prize-critical 10 seconds needs an actor (T9)
- **hito retry/decline path:** "resend to device" button; decline = proposal stays pending; rehearse one deliberate failure (T7)
- **`require(state == BOTH_ALIVE)` on heir/charter writes** — else the survivor can rewrite the estate after the first death, contradicting "nothing about death is decided at death" (T1)

## Prerequisites — verify in the FIRST HOUR (Sat 09:00–10:00)

Access and accounts nobody has confirmed yet. Each unverified item silently blocks a task.

| # | Prerequisite | Blocks | Check |
|---|---|---|---|
| P1 | **Who controls `humanbond.eth`?** Durin subnames need the parent name + L2 resolver setup — and does Durin support World Chain at all? Fallback: offchain resolver (CCIP-read) | T2 (ENS, Scene 1) | Herb/Franco |
| P2 | **World Dev Portal:** is our app enrolled in the Selfie Check beta, NFC beta, AND AgentKit? Betas usually need allowlisting — request access TONIGHT, not Sat | T4, T5, T9 | Franco |
| P3 | **Safe Transaction Service on World Chain?** The proposal inbox (S15) needs off-chain proposal queueing — if the service doesn't run on World Chain, we self-host or queue on-chain | T1, T10, W3 | Mischa |
| P4 | **Deployer wallet + gas:** who deploys vault + heartbeat to World Chain, with what funded key? Plus test USDC for demo wallets | T1, T5, T12 | Mischa |
| P5 | **0G account funded** (prepaid ledger needs ≥3 0G) + decision where the family agent process runs (laptop vs. deployed — it must be alive Sunday 09:00) | T8 | Francesca |
| P6 | **Walrus needs SUI/WAL for storage** — testnet is fine, but keys must exist | T3 | Francesca |
| P7 | **Graph Studio supports World Chain?** + deploy key | T11 | whoever takes T11 |
| P8 | **hito × World Chain:** does the device sign for our chain ID, and how does the app talk to it (WalletConnect/SDK)? | T7, W1–W4 | Mischa |
| P9 | `.env.local` shared with every dev; `contracts/lib` installed (forge deps are missing from the repo) | everyone | tonight |

## Definition of Done (per scene)

A scene is DONE when it runs end-to-end on the demo devices **and is captured on backup video**. Not before.

- **Scene 1:** bond → Safe + ENS resolves + charter blob retrievable from Walrus
- **Scene 2:** external USDC transfer arrives → each partner claims 50% to their own wallet
- **Scene 3:** spend below threshold passes phone-only; above threshold requires hito on-device confirm
- **Scene 4:** agent proposal created via real 0G inference, AgentKit verification shown (incl. one refused bot), executed after both hito confirms
- **Scene 5:** heartbeat lapse → challenge → Selfie-Check cancel works; then real lapse → death state → sweep pulls pre-approved funds → heir claims

## Submission Deliverables (owner: Leon + Herb — Sat night)

Prize tracks demand more than a video. Missing any of these forfeits the track:

1. ETHGlobal project page + public repo link + demo video <3 min
2. **0G:** proof of Compute usage (inference logs/signatures) + live link + team Telegram & X handles
3. **World Selfie/NFC beta tracks: written testing documentation with developer AND user feedback** — a real deliverable, drafted during the build (collect friction notes as we go, don't reconstruct at 2am)
4. **AgentKit:** working end-to-end flow demonstrable live, not only on video
5. Per-track submission text (each sponsor form is separate)

## Bond vs. Trust (settled framing)

**One human = one bond (the relationship credential: vows, milestones, TIME yield, public partnership status, dissolution, inheritance flag) — but N trusts (the money vehicles: members, claims, spending policy, agent, heirs).** "More bonds" was the wrong ask; **more trusts + trust membership invites** is the right one, enabled by contract principle #1 above, shipped after the hackathon.
