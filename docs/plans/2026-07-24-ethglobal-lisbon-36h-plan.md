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
4. **Optional if trivial — vesting parameter:** claimable share ramps with bond age ("no one drains 50% on the first date" — Fri idea). One uint, else roadmap.
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

## Bond vs. Trust (settled framing)

**One human = one bond (the relationship credential: vows, milestones, TIME yield, public partnership status, dissolution, inheritance flag) — but N trusts (the money vehicles: members, claims, spending policy, agent, heirs).** "More bonds" was the wrong ask; **more trusts + trust membership invites** is the right one, enabled by contract principle #1 above, shipped after the hackathon.
