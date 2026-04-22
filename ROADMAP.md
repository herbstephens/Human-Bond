# HumanBond — Post-Hackathon Roadmap

> How we intend to spend the three stages of World Build 3 after the April hackathon: Seoul Build Week (May 10–18), the three-month virtual program (May – August), and the San Francisco Demo Day.

---

## Guiding Principles

1. **Ship the simple thing live, then layer on complexity.** The 1-TIME-per-day yield is shipped. WorkNFT integration and cross-chain TIME minting come next — but only after the couple-facing product is undeniable.
2. **The registry is the business.** Every decision is evaluated against whether it compounds the value of the bonded-couples registry. Features that don't — cut them.
3. **World Chain is canonical, always.** Satellites are for interop and liquidity. They never become the source of truth for marriage state.

---

## Stage 1 — Seoul Build Week (May 10–18, 2026)

**Team on the ground:** Herb (product), Leticia (contracts), Franco (front-end). Axel remote from Hungary for cross-chain infra.

### Goals

- **Ship the Mini App rebrand.** `marriagePROOF` → `HumanBond`, with the four-primitive UX locked (Bond, Yield, Milestones, Divorce) and MiniKit 2.0 native.
- **Dating-app API private alpha.** Stand up the `GET /v1/bond-status/{nullifier}` endpoint with at least one pilot integration partner. Target: a smaller privacy-first dating app (Feeld, HER, or similar) that can move fast.
- **WorkNFT v0 contract.** Scope and deploy a minimal `WorkNFT` on World Chain that can be consumed by the HumanBond contract for work-hour TIME minting.
- **Stress-test with real users.** Minimum 20 real bonded pairs from the Build Week cohort. Collect every failure mode.

### Deliverables by end of week

- Live Mini App with full HumanBond branding and flows
- API v0 docs + SDK in JavaScript/TypeScript
- Signed LOI with at least one dating-app pilot partner
- Deployed `WorkNFT` contract on World Chain mainnet
- Bug list + prioritized roadmap for the virtual program

---

## Stage 2 — Three-Month Virtual Program (May – August 2026)

**Cadence:** weekly standups with the World team, office hours, workshops. We treat this as a real runway.

### Month 1 (May–June): Productize

- Dating-app API **public launch** — self-serve signup, Stripe billing, Tier 1 pricing live
- Formal audit engaged (target: Spearbit or Zellic) on `HumanBond`, `VowNFT`, `MilestoneNFT`, `TimeToken`
- Insurance partner conversations — life insurance carriers are the second natural B2B customer after dating apps
- Public changelog + developer documentation site

### Month 2 (June–July): Integrate

- **WorkNFT → TIME minting** flow live on World Chain (V2 of the TIME tie-in)
- Ethereum satellite upgraded from read-only mirror to **read + write** with day-scoped chain-agnostic nullifiers enforcing the 24-TIME/day-per-human invariant
- NEAR satellite follows the same pattern
- First high-volume dating-app contract signed (target: one Match Group brand in Tier 2)

### Month 3 (July–August): Scale & Prep

- **Five-stage dispute resolution** system live — for WorkNFT challenges, not for the marriage itself
- Lineal (RIA wealth-manager channel) integration: bonded couples surfaced to their wealth manager for coordinated treasury planning
- Case study pack — real metrics (bonds created, TIME minted, registry queries served, B2B revenue) — prepared for Demo Day
- Seed round preparation: data room, financial model, capital table

---

## Stage 3 — San Francisco Demo Day (approximate: late August / early September 2026)

**Audience:** Tools for Humanity senior leadership, top-tier VCs curated by the World team.

### What we pitch

- **Live product, real users, real revenue.** Not a deck full of projections — actual mainnet metrics from the three-month program.
- **The flywheel is closing.** Every new bond compounds registry value. Every dating-app integration pushes more users toward eventual bonding. Show the curve.
- **TIME is the bigger thesis.** HumanBond is the first live application — the road to the January 1, 2034 Schelling point begins with the bonded couple.

### What we ask for

- **Seed round** (target size set closer to the date based on traction). Lead commitment from a World-aligned fund.
- **Strategic introductions** from Tools for Humanity — specifically to Match Group executive team, life insurance innovation groups, and jurisdictions open to recognizing cryptographic bonds as supplemental civil-registry entries (Liberland, specific Swiss cantons, Delaware DAO LLC framework).

---

## Beyond World Build 3

### Q4 2026 (post-Demo-Day)

- Multi-language / multi-jurisdiction launch (non-English markets matter for global registry scale)
- Insurance partnership live — bonded-couple status recognized as beneficiary proof
- TIME token DEX liquidity on Ethereum via the satellite
- First legal-recognition conversation with a sympathetic jurisdiction

### 2027

- One million active bonds as the internal target
- Full TIME Protocol integration: HumanBond bonds as the flagship economic vehicle for TIME minting, alongside solo-minting pathways for individual humans
- Additional social-bond primitives on the same infrastructure (business partnerships, co-parenting agreements, caretaker contracts) — all sharing the same registry backbone

### 2034

- The TIME Protocol Schelling point: January 1, 2034. Every hour a human has lived-and-verified is worth 1 TIME. HumanBond is part of the infrastructure that got us there.

---

## What Would Make Us Declare Failure

- **Couples don't voluntarily self-register.** If bonded humans won't pay on-chain fees to mint a Vow NFT, the registry thesis breaks. We learn this by end of Seoul Build Week.
- **Dating apps won't pay.** If we can't close at least one paying pilot in the three-month virtual program, the B2B revenue line is fantasy and we restructure around pure-consumer.
- **World ID alone isn't enough identity.** If we see meaningful sybil attempts succeeding against Orb-only verification, we either halt or escalate to Tier 2 (Self Protocol passport proofs) as a hard requirement.

Any of these and we'll say so honestly to the World team, rather than play the pretend game.

---

## Metrics We Will Publish

At SF Demo Day, we commit to showing:

- Total bonds created (World Chain + satellite mirror)
- Total TIME minted, and TIME held by bonded couples
- Total registry API queries served, split by tier
- B2B MRR, pilot count, named logo list
- Median gas cost per bond lifecycle event (propose → accept → claim → divorce)
- Audit findings + remediation status

No vanity metrics. No "impressions." Just the numbers that matter.
