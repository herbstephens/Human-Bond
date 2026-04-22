# HumanBond — 2-Minute Demo Script

> For judges, investors, and anyone evaluating HumanBond in under 120 seconds.
> Timing assumes a live walkthrough in World App with the Mini App pre-loaded.

---

## Opening (0:00 – 0:10)

> "This is HumanBond. Two World-ID-verified humans form a two-person DAO on-chain. We're live on World Chain mainnet today. Let me show you."

**On-screen:** open World App → HumanBond Mini App → logged-in dashboard for Partner A.

---

## Beat 1 — Propose (0:10 – 0:30)

> "Partner A proposes to Partner B. World ID verification happens here — Orb-only, Group ID 1 — and we use a dedicated `propose-bond` nullifier so this proof can never be replayed as anything else."

**On-screen:** tap **Propose** → World ID Orb verification flow → transaction signed → "Proposal sent to 0xB0b..."

Show on Worldscan: proposal event emitted on contract [`0xB3cbCB...5A63`](https://worldscan.org/address/0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63).

---

## Beat 2 — Accept (0:30 – 0:55)

> "Partner B sees the incoming proposal and accepts. A second World ID proof — this time with the `accept-bond` nullifier. At this moment, four things happen atomically: a deterministic marriage ID is generated from both addresses, two soulbound Vow NFTs are minted with dynamic on-chain metadata, and one TIME token is minted to each partner as a welcome."

**On-screen:** switch to Partner B → tap **Accept** → Orb verification → transaction confirms.

**Show the receipt:**
- `ProposalAccepted` event
- Two `VowMinted` events (one per partner)
- Two `Transfer` events on the TIME contract — 1 TIME each
- Dynamic VowNFT rendering — partner addresses, bond date, marriage ID, all on-chain

---

## Beat 3 — Yield Accruing (0:55 – 1:15)

> "From the moment the bond activates, the couple earns 1 TIME per day together. Computed lazily — no daily gas cost — so the yield just compounds. Either partner can claim anytime; it splits 50/50 automatically."

**On-screen:** show the dashboard with `pendingYield` counter. If the demo environment has time-travel (forge cheatcodes), advance a week; otherwise show a real active bond with multiple days accrued.

Tap **Claim** → `claimYield()` fires → TIME balance updates for both partners.

---

## Beat 4 — The B2B Angle (1:15 – 1:35)

> "Now here's the part most people miss. Every bond we mint populates a registry. Dating apps bleed $300 million a year to catfishing and secretly-married users. We expose this as one API call."

**On-screen:** switch to a browser tab → make a live `GET /v1/bond-status/{nullifier}` request against our staging endpoint → show the JSON response:

```json
{ "bonded": true, "since": "2026-04-12T14:30:00Z", "chain": "worldchain" }
```

> "At 10% penetration of the 360-million-user global dating app market, that's $36 million a year of B2B revenue — on top of the couple-facing product."

---

## Beat 5 — The Ask (1:35 – 2:00)

> "HumanBond is live. Four contracts on World Chain mainnet. TIME is minting. Registry is populating. Ethereum and NEAR satellites are syncing. We want to come to Seoul and ship the dating-app API pilot, the WorkNFT integration for the broader TIME Protocol, and the production registry. We'll see you at Demo Day in San Francisco."

**On-screen:** close with the team slide + the four deployed contract addresses + `github.com/herbstephens/humanbond-worldbuild3`.

---

## Q&A Cheat Sheet (what judges usually ask)

**"Why not just use a wallet address?"**
A wallet is cheap. A World-ID-verified human is unique. Wallet-based marriage is sybil-forgeable; World ID is the thing that makes the registry worth querying.

**"What stops someone from getting divorced and remarrying the next day?"**
Nothing — except the built-in 30-day cooldown, which prevents propose/accept/divorce spam loops and gives either party breathing room.

**"How is TIME different from a points system?"**
TIME is a standalone ERC-20 on mainnet with its own lifecycle. HumanBond's 1-TIME-per-day mechanic is the first live use case, but TIME will accrue from multiple sources as the broader TIME Protocol ships — work-hour WorkNFTs, day-elapsed yields from other primitives, etc. It's the seed of an hour-denominated economy, not a scoreboard.

**"What about same-sex / polyamorous / non-romantic bonds?"**
The protocol is address-pair agnostic. Two World IDs, any gender, any reason. The initial product framing is marriage because it's the clearest on-ramp, but the primitive generalizes to any two humans committing shared economic life.

**"What's the moat?"**
Three layers. (1) Network effects on couple-side self-registration — the registry gets more valuable as couples bond. (2) Orb-only verification is not trivially replicable — the same scarcity that makes World ID valuable applies here. (3) On-chain history is uncopyable — a 3-year-old bond cannot be forked.

**"Is Leticia's code audited?"**
Internal review complete. Formal audit scoped for the 3-month virtual program ahead of the dating-app API public launch. The contracts are intentionally minimal (~500 lines of core logic) to keep the audit surface small.

**"What's the Ethereum and NEAR satellite actually doing today?"**
Listening to World Chain `ProposalAccepted` / `MarriageDissolved` events and replaying them as registry mirrors. Read-only today. Write path (cross-chain TIME minting) depends on the day-scoped chain-agnostic nullifier system, which is scoped for post-Seoul.
