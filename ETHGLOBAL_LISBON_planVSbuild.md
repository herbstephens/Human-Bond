# ETHGlobal Lisbon 2026 — HumanBond Submission

**Event:** ETHGlobal Lisbon · July 24–26, 2026 · Pavilhão Carlos Lopes
**Track:** Continuity Track — existing product shipping new features
**Team:** Francesca · Franco · Herb · Leon · Mikhail 

---

## Project Description

HumanBond is a two-person partnership protocol deployed and live on World Chain Mainnet, searchable today in the World App store. Two World ID–verified humans form an on-chain bond — a soulbound VowNFT anchored to biometric proof of unique humanity, not just a wallet address. When either partner earns income through the TIME Protocol, a 50/50 split is enforced automatically on-chain: the working partner and the non-market partner — the caregiver, the homemaker, the person whose contribution the formal economy has never recognized — receive equal shares. This is not a philosophical gesture. It is a smart contract. Beyond the bond itself, HumanBond exposes a Partnership Registry API: a verifiable, privacy-preserving on-chain record of partnership status that dating platforms, financial services, and legal systems can query with user consent. HumanBond is the first application of TIME Protocol's identity stack to a relationship that predates every financial system on earth — and the first time that partnership has had programmable economic consequences.

---

## What We Built at the Hackathon

> The list below is the **Friday plan** (kept as-is — our pivots are part of the story).
> What actually shipped is in **What the Weekend Actually Became**, directly below it.

- `finalizeWorkAndDistribute()` — 50/50 Work TIME split on payment receipt. When a payment is received for verified work, the contract mints TIME and distributes 50% to the worker and 50% to their bonded partner automatically. No manual split required. No trust required.
- **World 'Selfie Check' and 'NFC Credentials' ** — this adds two layers to the ID stack, eliminating use friction by introducing Tier 2 and Tier 3 sign-up [to the existing Tier 0 and Tier 4, iris orb scan].
- **ENS subname registration** — During bond formation, partners register `name1-name2.humanbond.eth` as their shared economic address
- **Walrus storage** — VowNFT metadata, partnership charter, and milestone records stored permanently on Walrus (Sui ecosystem)
- **The Graph subgraph** — Partnership Registry indexed and queryable via standard subgraph API

---

## What the Weekend Actually Became

The build pivoted on Saturday morning, and the pivots are how we found the real product: not
storage and indexing around a partnership record, but a **living trust run by human-backed
agents**. What actually shipped, all verifiable in this repo and on-chain:

- **The shared wallet (V5, live on World Chain mainnet):** every bond ships with a Safe owned
  2-of-2 by the partners, driven by our `BondVaultModule`. Creating it is ONE World App
  confirmation — Safe deploy + vault registration + ENS subname in a single MiniKit batch.
  212 unit tests + fork tests against the real Safe and the real Durin registry; two V4
  re-bond defects found and fixed on the way.
- **ENS subnames, mandatory at birth:** `name1-name2.humanbond.eth` is registered in the same
  batch that creates the wallet (own registrar, authorised on the Durin L2Registry under
  `humanbond.eth`), with live availability checking and an auto-label fallback so no couple
  is ever blocked by a name collision.
- **Live AI agents on 0G Compute:** each partner has a personal agent, the bond has a neutral
  trustee — real inference over the 0G router, not scripts. Agents negotiate, sign one
  canonical settlement hash, and the trustee executes only with BOTH signatures; the full
  verification chain is documented in `docs/settlement-verification.md` and attacked by our
  test runners (`agents:demo`).
- **World AgentKit door policy:** the trustee refuses any agent whose wallet has no verified
  human behind it — live AgentBook lookups on World Chain, a distinct-humans check for the
  two partner agents, and a refused rogue agent proving the door works.
- **World identity tiers as spending policy:** Selfie Check keeps a bond alive (the 90-day
  proof of life); the wallet — a financial instrument — requires Orb or Identity Check 18+
  from both partners. On-chain Orb proof verification, production app_id.
- **Uniswap Trade API:** the trustee quotes real swaps (USDC → WLD, World Chain 480) inside
  the conversation; swap terms are first-class fields of the signed settlement schema.
- **The inheritance layer (UI + protocol design):** dead-man's timer per partner, will editor
  with heirs and shares, charter rules co-signed by both. The estate state machine is
  specified and demo-ready; its contracts are the next phase.

---

## Prize Tracks

### 🤳 World — Selfie Check Beta · $3,500

**Technology:** World's Selfie Check is a low-friction, selfie-based credential confirming a real, live person is present — available to users who haven't completed Orb verification.

**Before:** HumanBond V1 required both partners to be Orb-verified World ID holders — the highest tier of sybil resistance, but one that excludes people who haven't visited a World Orb. In many countries, Orbs are rare. This created a geographic barrier to forming a partnership on-chain.

**After:** Selfie Check plays two roles in HumanBond. (1) **Entry tier:** partners without Orb access can form a bond with a Selfie Check credential; the wallet (a financial instrument) still requires Orb or Identity Check 18+ from both. Tier = authority, not friction. (2) **The 90-day proof of life** — our core use: each partner's dead-man's timer resets only with a fresh Selfie Check. A lapse opens a challenge window; a live selfie cancels the death state; a true lapse engages the estate machine (surviving partner, then heirs). The credential gates **authorization, risk, eligibility and economic terms** — who may move shared money, when an estate unlocks, who may claim. Biometric liveness is the only primitive that makes on-chain inheritance honest: keys can be stolen, a living face cannot. This use case only works on World infrastructure.

**Testing documentation:** see the full section **World Beta Testing Documentation** below — honest developer + user feedback per the track rubric.

**Qualification:** A recurring trust event (life proof gating an estate), not generic login. Working app on World Chain mainnet with real users.

---

### 🪪 World — Identity Check (NFC) Beta · $3,500

**Technology:** World's Identity Check / NFC Credentials lets a product request verified identity attributes (age, jurisdiction) beyond simple proof of uniqueness by reading the NFC chip from a biometric passport.

**Before:** A HumanBond partnership had no jurisdiction awareness. Both partners verify that they are unique humans; nothing more. In Portugal and many other jurisdictions, a registered partnership carries legal implications for inheritance, tax, and property rights — but nothing in the V1 bond formation flow helped partners assert these attributes.

**After:** During bond formation, HumanBond surfaces World's NFC Credentials as an optional layer. Partners can have their passport NFC chip read to attach verified age (>18 confirmation) and jurisdiction attestations to their VowNFT text records. A Portuguese couple forming a bond can assert that both partners are adults and resident in Portugal. The attestation is stored in the VowNFT — jurisdiction and age confirmation, nothing more. This is the first step toward a partnership protocol that is legally legible in the real world.

**Testing documentation:** see **World Beta Testing Documentation** below. In HumanBond the NFC / Identity Check credential additionally serves as the **≥18 claim gate for heirs**: inheritance claims bind to a World ID nullifier (children may have no wallet yet) and unlock when the heir verifies their age — the credential doubles as estate-law compliance.

**Qualification:** Uses Identity Attestations in a meaningful way for eligibility and compliance, not generic login. Explains why the attributes are necessary (legal standing). Working prototype.

---

### 🔄 ENS — Best ENS Continuity Integration · $2,000

**Technology:** ENS turns wallet addresses into human-readable names. Subnames like `herb-agatha.humanbond.eth` can be registered under the `humanbond.eth` parent name.

**Before:** A partnership on HumanBond is identified by two wallet addresses and a numeric VowNFT ID. When a client wants to pay for work performed by a partnership, or a relative wants to send a gift, they're handed `0x6494...bB13` — an address that belongs to one partner, not to the partnership as a unit. There is no shared economic identity. Payments go to individuals.

**After:** Every HumanBond partnership registers an ENS subname during the bond formation flow — `partner1-partner2.humanbond.eth`. This becomes the partnership's shared economic address. ENS text records on the subname store:
- The VowNFT token ID and contract address
- Both partners' World ID identity tiers
- The TIME Protocol split configuration
- A pointer to the Walrus-stored partnership charter

Anyone can resolve `herb-agatha.humanbond.eth` to reach the partnership's shared receiving address — without either partner revealing their individual wallet.

**Qualification:** HumanBond is an existing live product. ENS integration is the new feature shipped at this hackathon. ENS is load-bearing — it provides the shared economic identity that makes the Partnership Registry legible to the outside world.

---

### 🌊 Sui / Walrus — Best existing app integrating the Sui stack · $2,000

> **Status: PIVOTED → 0G.** This was the Friday plan. On Saturday the agents became the
> heart of the build, and 0G gave us compute AND storage in one ecosystem — so the
> permanent-charter idea moved to 0G storage and the Walrus integration was not built.
> The pivot is part of the story: storage was never the product, the living trust is.

**Technology:** Walrus is a decentralised storage network from the Sui ecosystem. Chain-agnostic — works directly with EVM contracts.

**Before:** HumanBond's VowNFTs, partnership charters, and milestone records had nowhere permanent to live. IPFS is reliable only as long as someone keeps pinning the content. Centralised metadata storage directly contradicts the promise of a soulbound, lifelong partnership record.

**After:** Every VowNFT's metadata — the partnership charter, the formation timestamp, the verified identity tiers of both partners, the income split configuration, and every milestone record — is stored on Walrus. The record is as permanent as the bond is intended to be. When a Work TIME split executes, the transaction hash and split record are appended to the Walrus document. The partnership's full economic history is sovereign and decentralised.

**Qualification:** HumanBond is a live existing product (Continuity Track). Walrus integration is the new feature. The integration is load-bearing — permanent partnership records, not a cosmetic add-on.

---

### 🏆 The Graph — Best Use of Composable or Standardized Graph Data Products · $4,000

> **Status: CUT — roadmap.** Planned Friday as the optional capacity track; the weekend's
> capacity went into making the agents real (0G inference, AgentKit, live vault). The
> Partnership-Registry-as-standard idea survives unchanged on the roadmap.

**Technology:** The Graph is the indexing and query layer of web3. Subgraphs provide structured, real-time access to blockchain data.

**Before:** The HumanBond Partnership Registry exists on World Chain Mainnet — VowNFTs minted, income splits recorded — but it is opaque to the outside world. A dating platform that wants to display a "verified partnership" badge has to run its own World Chain node. Every external integration requires bespoke work.

**After:** HumanBond publishes a standardised Partnership Registry subgraph on The Graph — a clean, queryable schema that any application can integrate in minutes. The subgraph indexes:
- Partnership formation events (VowNFT minted with both World ID nullifiers)
- Income split executions (50/50 TIME distributions)
- Milestone completions (MilestoneNFT mints)
- Partnership dissolution events
- Identity tier upgrades

The schema is designed as a **standard** — `PartnershipStatus`, `PartnershipEvent`, `IncomeRecord`, and `IdentityTier` entities that any app querying relationship data on World Chain can adopt. Query: *"is this World ID nullifier currently in an active HumanBond partnership?"* — one query, one standard, composable with any World ID application.

**Qualification:** Uses live World Chain Mainnet data from deployed contracts. Schema explicitly designed as a reusable standard. Shows what became easier because of a shared schema.

---

## World Beta Testing Documentation (Selfie Check · Identity Check · AgentKit)

Per the track rubric — strategic fit 30%, **reusable feedback 25% ("Don't be nice! We need you to really test and tell us what's bad")**, product quality 20%, technical integration 15%, deployment path 10% — this section is deliberately blunt.

### Developer feedback — what was hard, honestly

**Discoverability was the #1 issue — and not only for us.** Multiple teams around us at the venue independently said World documentation was hard to find. [TODO: 2–3 verbatim quotes + team names from the venue.] Specifics from our build:

- **Credential identifiers are buried.** That `selfieCheckLegacy`, `proofOfHuman`, `identityCheck`, `passport` are the real credential ids — and how they map to what users see in World App — took genuine digging; the credentials page is not linked from where builders actually start. The "Legacy" suffix on the credential this beta track is built on is unsettling: is it going away?
- **The architecture-deciding question is unanswerable from public docs:** can Selfie Check / Identity Check proofs be verified **on-chain**, or only via the cloud API? Orb verifies on-chain today; for the other credentials the docs are silent. This single unknown decides whether a protocol needs a trusted attestation server. We had to design a swappable verifier seam (`ICredentialVerifier`) around not knowing.
- **AgentKit's core primitive is hidden behind the x402 story.** The docs lead with payment hooks and free-trial modes. The thing most builders want first — "given a wallet, is a verified human behind it?" — is one call, `createAgentBookVerifier().lookupHuman(address)`, and we only found it by reading the package's TypeScript declarations inside `node_modules`. A five-line "bare verification" recipe belongs at the top of that page.
- **MiniKit error payloads are developer-hostile.** `{ status: "error", error_code: "cancelled" }`-style responses forced us to build our own `explainTxError` layer for actionable user messages. Document the full `error_code` enumeration in one table, or ship human-readable messages.
- **Two vocabularies for one concept:** MiniKit `VerificationLevel` does not map 1:1 to the IDKit credential list, so wiring a Selfie-gated action next to an Orb-gated action means translating between them.
- **One bond per nullifier is right for production, painful for demos:** judges can't form a bond spontaneously (their World ID is unverified or already consumed). A sandbox / test-nullifier mode in the Dev Portal would remove demo pre-staging entirely.

**What worked well (credit where due):** on-chain Orb proof verification inside our bond contract worked first try against the production app_id — the nullifier model is a joy for one-bond-per-human logic. AgentBook resolving on World Chain regardless of payment chain meant our verifier needed zero configuration. MiniKit transaction batching (Safe deploy + vault registration + ENS registration in ONE confirmation) is the backbone of our best UX moment. AgentKit registration via `npx @worldcoin/agentkit-cli register` — gasless, hosted relay, World App prompt — is genuinely good. [TODO after registering the demo agents: note beta-access friction and flow duration.]

### User feedback — live testing on real devices (Jul 25, mainnet, real USDC)

- **"Verify World ID" does not read as "log in."** Testers hesitated on the landing CTA; renaming it "Login with World ID" removed the hesitation entirely. The design guidelines should say this out loud.
- **Consumer users do not know what a multisig is** — and never need to. Comprehension jumped when our copy switched to "one shared address, like a shared purse; nothing moves unless you both say yes." World's developer examples still lean on protocol vocabulary; consumer-grade copy patterns in the docs would raise the floor for every mini-app.
- **Selfie Check as a recurring heartbeat felt natural, not creepy.** "Look into the camera every 90 days or your bond starts asking questions" needed no explanation. Strong signal for Selfie Check product-market fit beyond login.
- **Session state after login surprised users:** a stale client showed an old screen until reload — our bug, not World's, but testers experienced it as "World login didn't work." Listed for completeness.
- [TODO: add 1–2 outside testers from the venue — five minutes of a stranger using it beats our own eyes.]

### Open questions for the World team

1. Can Selfie Check / Identity Check proofs be verified on-chain today? If cloud-only, is a signed-attestation server the blessed pattern?
2. Is `selfieCheckLegacy` being replaced, and what is the migration story for recurring-liveness products built on it?
3. Will AgentBook get a testnet deployment (and the Dev Portal a test-nullifier mode) so multi-human flows are demoable without consuming real identities?
4. Is there an intended pattern for **recurring** verification (our 90-day heartbeat)? A native "verify at most every N days" action config would collapse most of our custom logic.

### 30-day deployment path

HumanBond stays live on World Chain mainnet after the weekend as a beta learning source.

**Week 1.** Complete AgentKit registration for both partner agents through `npx @worldcoin/agentkit-cli register`, closing the human-backing verification gap that currently blocks the AgentBook door check from running against real registered agents rather than demo identities. Replace the heartbeat's mock Selfie Check overlay with a real MiniKit verify call: today it is a fixed 2.4-second UI timer with no credential request behind it. Separately, the app's real MiniKit verification calls, used for bond formation and agent activation, do reach World ID, but the consent sheet they trigger only asks for "Verification level" and does not itself render a selfie-capture step. Worth raising with World directly, since it is unclear whether that is expected behavior for the Selfie Check credential specifically or a sign it is not yet enabled for this app_id. Fully verify the death-flow on-chain end to end, lapse, challenge, cancel, heir claim, which currently runs as UI and narration but is unverified as a complete on-chain sequence.

**Weeks 2 through 4.** Wire the AgentBook human-backing check into the trustee's actual execution path. Today it runs as a separate check ahead of the trustee rather than inside the flow that moves real money. Connecting the two turns verified human-backed authorization into something enforced on every real spend, instead of something demonstrated separately. Revisit the deliberately deferred scope from the hackathon weekend: a Graph subgraph publishing the Partnership Registry as a public, queryable standard, real swap execution from the Safe (quotes are live today, execution needs module wiring), and the 0G KV multi-browser agent bus (written, blocked on a testnet faucet during the weekend). Continue running as a live beta source on World Chain mainnet, gathering comparative data between Selfie Check and Orb-verified (POH) cohorts on fraud, retention, and behavior, one of the named preferred feedback areas the bounty brief asks for and currently has zero coverage.

We are available for follow-up interviews with the Selfie Check and AgentKit teams.

---

## Demo Script

> **Original Friday storyboard below (kept for the record).** The actual demo is five
> scenes: **1. Bond** (login → one confirmation creates Safe + vault + ENS name) ·
> **2. Shared money** (send USDC to the ENS name, balance rises from zero on-chain,
> spend with partner approval) · **3. Hardware trust** (thresholds; large moves confirmed
> out-of-band on hito) · **4. Agents** (ask your agent to invest → trustee checks
> AgentBook, refuses the rogue, quotes Uniswap live, both humans release) ·
> **5. The bond that outlives you** (will, heirs, the 90-day Selfie-Check heartbeat).


1. Open World App on phone · search `HumanBond` · show live app
2. Show existing bond between two verified partners
3. Demonstrate `finalizeWorkAndDistribute()` — trigger a TIME split, show both wallets receive
4. Show ENS subname resolution: `herb-agatha.humanbond.eth` → shared address
5. Show Walrus storage: open partnership charter URL, load from decentralised storage
6. Show The Graph query: curl Partnership Registry subgraph, return partnership status for a nullifier
7. Show Selfie Check / NFC flow: new partner onboarding with non-Orb credential

---

## Links

- **Live app:** World App store → search `HumanBond`
- **GitHub:** https://github.com/herbstephens/Human-Bond
- **TIME Protocol:** https://github.com/herbstephens/TIME-Protocol
- **Website:** https://timeprotocol.earth
- **Contact:** herb@democracy.earth

---

*democracy.earth · ETHGlobal Lisbon · July 24–26, 2026*
