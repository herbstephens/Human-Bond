# Project Overview

HumanBond is a proof-of-humanity partnership protocol, live on World Chain Mainnet, built on TIME Protocol. Two World ID–verified humans form an on-chain bond (soulbound VowNFT). This weekend (ETHGlobal Lisbon, Jul 24–26) we extend the bond into a **family trust**: an auto-created Safe vault with an ENS name (`alice-ben.humanbond.eth`), pull-based 50/50 claims, hito hardware confirmation tiers, a 0G family agent (proposes, never executes), and an inheritance mechanic (Selfie-Check heartbeat → death states → heirs claim).

**The one sentence:** *The bond that outlives you.*

# The Weekend Plan — read these first, in this order

1. **`docs/plans/2026-07-24-ethglobal-lisbon-36h-plan.md`** — THE authoritative plan: task matrix (T1–T15) with owners, schedule with gates, prize mapping, risks. If a task is not in there, it is not weekend scope.
2. **`docs/plans/2026-07-24-demo-script.md`** — the feature list in demo form: 6 acts, screens S1–S19 with build mapping and on-chain events. **Screens and features get built from this document.**
3. **`docs/brainstorms/2026-07-24-bond-trust-inheritance-brainstorm.md`** — decisions and rationale (claim model, vault≠bond, sweep options, 0G/ERC-7857, hito tiers). Consult before re-litigating any design decision.
4. `docs/plans/demo-onepager.html` — the animated one-pager (design + copy reference, landing page seed).

**Deadline: submission SUNDAY 09:00. Feature freeze Sat 19:00. The video is the product.**

# Repo Structure

- `miniapp/` — Next.js 16 (Turbopack) World App Mini App. MiniKit, wagmi/viem, Tailwind 4, shadcn-style components, Zustand. `cd miniapp && npm install && npm run dev` → localhost:3000.
- `miniapp/lib/agents/` — the three-agent runtime (phase 2): dual-signed Settlement protocol, role-gated tools (personal agents cannot execute, trustee cannot negotiate), prompts rendered from the second brain, storage interface for 0G. Headless test of the whole choreography incl. attack cases: `cd miniapp && npm run agents:demo`. The UI mock (`lib/agent/agentStore.ts`) keeps its public actions — the runtime replaces their insides behind `NEXT_PUBLIC_USE_MOCKS=0`.
- `contracts/` — Foundry. `src/HumanBond.sol` (LIVE on mainnet), `TimeToken.sol`, `BondNFT.sol`, `MilestoneNFT.sol`. `ABI/` has exported ABIs.
- `docs/` — plans, brainstorms, architecture.
- Root MD files (README, ETHGLOBAL_LISBON, ARCHITECTURE…) — pitch/protocol docs, Herb's domain.

# Hard Rules

- **NEVER touch the live mainnet contracts** (HumanBond `0x6494…bB13`, TIME `0x261f…6a82`, VowNFT, MilestoneNFT). New functionality = NEW contracts (vault, heartbeat) that read from them. The Continuity-track story depends on this.
- **One bond per human is enforced on-chain** (`activeBondOf` reverts on a second proposal). Demo/testing needs pre-created identities — you cannot bond twice with the same World ID.
- **The vault NEVER auto-splits or auto-forwards.** Incoming funds (USDC, TIME) accrue at the bond's ENS/Safe address; entitled parties **claim** (pull-based). The "50/50 split enforced automatically" language in the root docs (README, ETHGLOBAL_LISBON, TIME_PROTOCOL_TIEIN) describes the live contract's **TIME minting** — protocol issuance, not vault behavior. Do not copy the auto-split pattern into the vault. Decision record: brainstorm doc, "Decisions — Team Conversation, Jul 24".
- No fallbacks, no defensive programming. Fail hard and explicitly; never swallow errors or stack traces. Avoid try/catch unless the flow genuinely requires it.
- Everything labeled *(roadmap)* in the docs is pitch material — do not build it.

# Gotchas

- Root `DEMO_SCRIPT.md` is the OLD (pre-Lisbon) demo. The current demo is `docs/plans/2026-07-24-demo-script.md` — don't build from the old one.

- `contracts/lib/` (forge-std, OpenZeppelin, world-id) is **missing** — the contracts folder was uploaded without submodules. Run the installs from `contracts/.gitmodules` before `forge build`.
- `docs/ARCHITECTURE.md` vs `docs/architecture.md` collide on case-insensitive filesystems (macOS): one of them will permanently show as modified in `git status`. **Never commit that phantom change**; don't `git add .` blindly.
- Supabase-style backends, migrations, RLS: not applicable here — this project has no own database. State lives on-chain + 0G storage.
- USDC and TIME are both plain ERC-20s on World Chain; the vault treats them identically. Repo-reality audit of what code actually exists: plan, P10/P11.

# Team & Ownership (weekend)

Herb — lead, protocol, pitch · Franco — frontend/MiniKit, ENS, World verification · Mischa (Mikhail) — contracts, Safe vault, hito wallet (W1–W4) · Francesca — 0G family agent, 0G storage · Leon — product/PM/UX, copy, demo script, submission texts.

# Design & Copy

**Chat rules (agent surfaces — bindend):**

1. **Never two bubbles at once.** The agent must always feel like someone thinking and writing: typing indicator first, then ONE message that types out live, a pause, then the next. All agent output goes through the sequential queue in `lib/agent/agentStore.ts` (`_enqueue`) — never push two agent messages in the same tick.
2. **Contextual answers live at the bottom.** Buttons that answer the agent's open question always render directly above the input bar — never floating inside the message stream.
3. **Free text is context-aware.** If the agent asked a question, an affirmative typed answer ("yes", "ok", "ja") answers THAT question — it never falls through to a generic reply.
4. **Primary CTA = the alive button.** Black pill, uppercase micro-tracking, breathing amber glow (it visibly "wabert" — the product's living signal). One per view; a CTA must never look like a chat bubble and a bubble never like a CTA. Shared component: `app/components/agent/AliveCta.tsx`.
5. **Agents negotiate, the trustee executes.** In all copy and diagrams: your agent settles terms WITH the partner's agent (interests vs. interests); the trustee only checks the charter and executes what the agents agreed. Never write "negotiating with the trustee".

Aesthetic: **ceremony × protocol** — serif italics for the human layer, monospace for the on-chain layer; warm dark editorial (see `demo-onepager.html` for the reference implementation). Copy tone: short sentences, concrete, emotional truth + product truth ("A face, not a password"). All docs and code comments in English.
