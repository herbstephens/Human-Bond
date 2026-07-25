# ETHGlobal Lisbon 2026 — HumanBond Submission

**Event:** ETHGlobal Lisbon · July 24–26, 2026 · Pavilhão Carlos Lopes
**Track:** Continuity Track — existing product shipping new features
**Team:** Francesca · Franco · Herb · Leon · Mikhail 

---

## Project Description

HumanBond is a two-person partnership protocol deployed and live on World Chain Mainnet, searchable today in the World App store. Two World ID–verified humans form an on-chain bond — a soulbound VowNFT anchored to biometric proof of unique humanity, not just a wallet address. When either partner earns income through the TIME Protocol, a 50/50 split is enforced automatically on-chain: the working partner and the non-market partner — the caregiver, the homemaker, the person whose contribution the formal economy has never recognized — receive equal shares. This is not a philosophical gesture. It is a smart contract. Beyond the bond itself, HumanBond exposes a Partnership Registry API: a verifiable, privacy-preserving on-chain record of partnership status that dating platforms, financial services, and legal systems can query with user consent. HumanBond is the first application of TIME Protocol's identity stack to a relationship that predates every financial system on earth — and the first time that partnership has had programmable economic consequences.

---

## What We Built at the Hackathon

- `finalizeWorkAndDistribute()` — 50/50 Work TIME split on payment receipt. When a payment is received for verified work, the contract mints TIME and distributes 50% to the worker and 50% to their bonded partner automatically. No manual split required. No trust required.
- **World 'Selfie Check' and 'NFC Credentials' ** — this adds two layers to the ID stack, eliminating use friction by introducing Tier 2 and Tier 3 sign-up [to the existing Tier 0 and Tier 4, iris orb scan].
- **ENS subname registration** — During bond formation, partners register `name1-name2.humanbond.eth` as their shared economic address
- **Walrus storage** — VowNFT metadata, partnership charter, and milestone records stored permanently on Walrus (Sui ecosystem)
- **The Graph subgraph** — Partnership Registry indexed and queryable via standard subgraph API

---

## Prize Tracks

### 🤳 World — Selfie Check Beta · $3,500

**Technology:** World's Selfie Check is a low-friction, selfie-based credential confirming a real, live person is present — available to users who haven't completed Orb verification.

**Before:** HumanBond V1 required both partners to be Orb-verified World ID holders — the highest tier of sybil resistance, but one that excludes people who haven't visited a World Orb. In many countries, Orbs are rare. This created a geographic barrier to forming a partnership on-chain.

**After:** HumanBond integrates World's Selfie Check as a Tier 1 entry point. Partners who haven't completed Orb verification can form a bond using a Selfie Check credential — lower friction, still a confirmed live human, with the bond marked at the appropriate identity tier. The VowNFT records which credential type was used by each partner. Higher-tier verification (NFC or Orb) can be added later, upgrading the bond's identity tier without dissolving it.

**Testing documentation:** Because HumanBond is a live app with real users, we provide genuine developer feedback on the Selfie Check SDK integration and real user feedback on the selfie flow, camera friction, and drop-off points.

**Qualification:** Uses Selfie Check in a meaningful way as a risk/trust signal for partnership formation, not generic login. Working app with real users.

---

### 🪪 World — Identity Check (NFC) Beta · $3,500

**Technology:** World's Identity Check / NFC Credentials lets a product request verified identity attributes (age, jurisdiction) beyond simple proof of uniqueness by reading the NFC chip from a biometric passport.

**Before:** A HumanBond partnership had no jurisdiction awareness. Both partners verify that they are unique humans; nothing more. In Portugal and many other jurisdictions, a registered partnership carries legal implications for inheritance, tax, and property rights — but nothing in the V1 bond formation flow helped partners assert these attributes.

**After:** During bond formation, HumanBond surfaces World's NFC Credentials as an optional layer. Partners can have their passport NFC chip read to attach verified age (>18 confirmation) and jurisdiction attestations to their VowNFT text records. A Portuguese couple forming a bond can assert that both partners are adults and resident in Portugal. The attestation is stored in the VowNFT — jurisdiction and age confirmation, nothing more. This is the first step toward a partnership protocol that is legally legible in the real world.

**Testing documentation:** Developer feedback on the NFC SDK, user feedback on the passport-scan flow, comprehension, and consent UX.

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

### 🏆 The Graph — Best Use of Composable or Standardized Graph Data Products · $4,000

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

## Demo Script

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
