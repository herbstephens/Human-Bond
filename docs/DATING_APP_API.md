# HumanBond Registry API — The B2B Verification Layer

> **Thesis:** the dating app industry is bleeding from catfishing, secretly-married users, and romance scams. HumanBond is the first cryptographic registry that can answer *"is this person currently bonded?"* without leaking any PII. We price the answer at **$0.50–$2 per call**. The TAM is ~360M dating-app users globally. This document is the product spec.

---

## Problem Statement (Why Dating Apps Will Pay)

- **~30%** of users on major dating apps are already married or in a relationship
- **55%** of dating app users report encountering fake profiles
- **~$300M/year** in direct catfishing losses borne by users
- **$1.14B** in FTC-reported romance scam losses in 2023
- **$141.8M** in catfishing fraud by 2022 — a **331%** increase from 2019
- **40%** of dating app users were targeted by scams in 2025 — up 10% YoY

Dating platforms currently have **no cryptographic way** to answer "is this user married?" The only options are:

1. Self-attestation (laughably broken — 30% lie)
2. Paid background checks (expensive, slow, privacy-invasive, US-centric)
3. AI flag-and-review (high false-positive rate, no ground truth)

**HumanBond is the ground truth.**

---

## The One Endpoint Dating Apps Need

```http
GET /v1/bond-status/{world_id_nullifier}
Authorization: Bearer <api_key>
```

**Response (200):**
```json
{
  "bonded": true,
  "since": "2024-03-14T09:12:00Z",
  "kind": "marriage",
  "chain": "worldchain",
  "marriage_id": "0x9f2c...a81e",
  "divorce_cooldown_until": null
}
```

**Response (200, divorced or never bonded):**
```json
{
  "bonded": false,
  "ever_bonded": true,
  "last_bond_ended": "2024-01-05T14:22:00Z",
  "divorce_cooldown_until": "2024-02-04T14:22:00Z"
}
```

**Response (200, never bonded):**
```json
{
  "bonded": false,
  "ever_bonded": false
}
```

**Response (404):** World ID nullifier not recognized (user has not verified with World App).

---

## Privacy Properties

The endpoint **does not** return:

- The partner's identity (address, World ID, anything)
- Income, treasury balance, or TIME holdings
- Any personally identifying information beyond relationship status
- Dating app's own data — they cannot learn anything about other dating apps' queries

The endpoint **does** return:

- A boolean: bonded or not
- A `since` timestamp (useful for "married under 1 year" signals)
- A cooldown indicator — if the user just divorced, the dating app can show a "welcome back" state rather than a generic "not married"

This is the minimum necessary information for the use case. No more.

---

## Pricing Model

### Tier 1 — Pay-per-call (self-serve)
| Volume | Price |
|---|---|
| 0 – 10,000 calls/month | **$2.00** per call |
| 10,001 – 100,000 | **$1.50** per call |
| 100,001 – 1,000,000 | **$1.00** per call |
| 1,000,001 + | **$0.50** per call |

**Bulk API key**, standard REST, SDKs in JavaScript/TypeScript, Python, Swift, Kotlin.

### Tier 2 — Enterprise unlimited (contract)
- Flat annual fee for unlimited queries
- SLA: 99.95% uptime, p95 latency < 200ms
- Dedicated support channel, co-marketing ("Verified by HumanBond" badge)
- Custom fields (e.g., enterprise dating apps may opt into "bonded within X years" rather than exact dates)
- **Target:** Tinder, Bumble, Hinge, Match Group as a whole, Grindr, Raya, The League, Feeld

### Tier 3 — Insurance / KYC / Government (bespoke)
- Life insurance carriers verifying spouse beneficiary claims
- Retirement / inheritance platforms validating "spouse" attestations
- Immigration / tax systems (where jurisdictions legally recognize the bond)
- Pricing: contract-level, typically $0.10–$0.50 per call at very high volume

---

## Revenue Projection (Conservative)

**Dating app industry, 2024:** $6B revenue, ~360M global users.

| Penetration | Annual verifications | Blended price/call | Revenue |
|---|---|---|---|
| 5% | 18M | $1.20 | **$21.6M/year** |
| 10% | 36M | $1.00 | **$36M/year** |
| 25% | 90M | $0.80 | **$72M/year** |

At 25% — a realistic ceiling if Match Group and Bumble adopt — **HumanBond's B2B line alone would exceed the hackathon's total prize pool by ~3,600x.** Without changing the couple-facing product.

---

## Integration SDK (sketch)

```typescript
// @humanbond/registry-client
import { HumanBondRegistry } from "@humanbond/registry-client";

const registry = new HumanBondRegistry({ apiKey: process.env.HB_KEY });

// On dating app signup flow, after the user completes World ID sign-in:
const result = await registry.getBondStatus(worldIdNullifier);

if (result.bonded) {
  return showError("This account appears to be in an active bond. Dating requires single status.");
}

if (result.ever_bonded && result.divorce_cooldown_until) {
  return showWarning("Welcome back! Your divorce cooldown ends on " + result.divorce_cooldown_until);
}

// Proceed to normal signup
```

Five lines of integration code. One API call per new signup. Existing dating-app identity flows don't need to change — this slots in as a pre-signup check.

---

## Why This Is a Moat, Not a Feature

Three reasons HumanBond's registry can't be replicated by a competitor overnight:

1. **Network effects on the couple side.** Couples register for their own reasons (wealth coordination, Vow NFT, TIME yield, inheritance routing). Every bond compounds the registry's value. A competitor starting from zero on couples can't offer dating apps a useful registry.
2. **World ID is non-rivalrous but Orb-only is scarce.** A competing registry would either have to rely on weaker identity (worthless for this use case) or convince the same Orb-verified humans to bond on a different protocol — a collective action problem.
3. **Soulbound + on-chain history is cryptographically durable.** Even if a competitor forks the code, they can't fork the history. A 3-year-old bond in HumanBond cannot be replicated on a fork — the chain-of-custody is part of the value.

---

## Rollout Plan

**Phase 1 (Seoul Build Week):** Private API with 2–3 pilot dating apps. Target smaller, privacy-first platforms (Feeld, HER) for initial legitimacy. Free tier for pilots.

**Phase 2 (3-month virtual program):** Public launch with self-serve Tier 1 pricing. Stripe billing. Developer docs. At least one Match Group brand in Tier 2 pilot.

**Phase 3 (SF Demo Day):** Case study + revenue metrics. This is the B2B story we'll tell investors: HumanBond isn't a couple's DAO, it's **infrastructure for online trust at the scale of the dating internet.**

---

## The Framing That Closes the Deal

The genius of this business is the **voluntary self-registration flywheel**:

> Couples register for their own reasons — wealth, inheritance, the Vow NFT, the TIME yield, the sentimental on-chain proof of commitment.
> Dating apps get the registry **as a byproduct**.
> Every new bond compounds the value for every dating app that integrates.
> Every dating app that integrates pushes more single users toward eventual bonding.
> The flywheel closes.

There is no user-acquisition cost on the registry side that isn't already being paid to acquire couples. The B2B revenue is, in a real sense, **pure margin on a product we're already building**.

That's the pitch.
