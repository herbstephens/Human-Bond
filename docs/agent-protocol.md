# HumanBond — The Agent-to-Agent Settlement Protocol

> Two human-backed agents chat directly, with full context, human-like but
> agent-fast, and their conversation deterministically becomes a signed,
> executable settlement for the partnership's shared money.

This is the thing HumanBond is really about. The bond, the vault, the ENS name,
the Selfie Check — those are the body. This is the nervous system.

## The idea in one paragraph

Every human has a personal financial agent that represents them and nobody else,
grounded in that human's private profile (income band, protected budget, hard
rules, the facts they told it). When a partnership has a shared money decision —
split this dinner, put the buffer to work, cover the groceries — the two agents
**negotiate it directly**: a real back-and-forth conversation where each agent
argues from its own human's position. They converge on an exact settlement
(recipient, amount, per-person shares), each agent **signs** the settlement's
hash with its registered key, and only then does the neutral trustee execute it —
mechanically, on matching signatures, with the humans' hito release on top above
threshold. The chat is fuzzy and human-readable; the settlement is canonical and
law.

## Why this is novel (and how to say it honestly)

Agent-to-agent messaging as a field already exists — don't claim "the first
agent protocol." What is genuinely new here is the specific stack:

- **Human-backed agents.** Each agent is bound to a World ID–verified human via
  AgentKit / AgentBook. An unbacked bot never gets a seat — the trustee's door
  policy checks human-backing before a proposal reaches the release track.
- **Private profiles, shared conversation.** Each agent reasons over its human's
  private second brain, but only ever puts *negotiation messages* on the shared
  channel — never the raw profile. Interests are exposed; secrets are not.
- **A fair split for a human relationship, not a transaction.** The subject is a
  partnership's money over time (by-income splits, protected budgets, feelings
  count as interests), not a one-off trade.
- **Conversation → signed, executable settlement.** The fuzzy chat
  deterministically reduces to a canonical term sheet that both agents sign and
  the trustee can execute on-chain. Talk is color; the signed hash is consent.

That combination — human-backed agents negotiating a partnership's finances into
a signed, executable settlement — is the claim to plant a flag on.

## Design principle: direct, context-complete, agent-paced

The agents must **chat in a shared place, directly, with the full context** —
not be black-boxed by a server that "asks each side" in isolation. The shared
negotiation thread is the protocol's core artifact. Concretely:

- **One shared channel per case.** A negotiation ("case") has its own thread that
  both agents read and append to. The thread is persistent and auditable — you
  can always open it and read exactly how a settlement was reached.
- **Full context on every turn.** Each agent's turn is computed with: the shared
  thread so far, the request, the bond's charter (the rules both humans signed),
  its own private profile, and relevant history. Nothing important is hidden from
  the agent that has a right to see it.
- **Human-like, but agent-fast.** The turns are natural language — real positions,
  real reasoning ("Alice earns 4× Ben, charter says by-income, so 80/20") — but
  dense and quick. No pleasantries, no human latency. Open with a position,
  exchange offers, accept when the deal serves your human, settle in a few turns.
  The agent style is: say the interest, put a number on the table, converge.

Result, proven live: `2000/8000` income → `20/80` split; reversed `6000/3000` →
`67/33`. Different situation → different conversation → different, derived split.
The old build showed the *same* conversation and a hardcoded 10/90 every time.

## The three layers (fuzzy → canonical → mechanical)

1. **Conversation (LLM).** `LlmDriver` produces one `AgentTurn` per turn:
   `{ say, offer?, acceptOffer? }`. An offer names per-agent shares that must sum
   to the amount. A hallucinating model can talk nonsense — it cannot move money.
2. **Settlement (canonical).** The accepted offer reduces to a `Settlement`:
   kind, bondId, nonce, expiry, recipient, amount, `shares`, optional APR/swap
   terms, memo, and the transcript hash. Canonical JSON → one hash both sides sign.
3. **Execution (mechanical).** `TrusteeExecutor` verifies both registered agents
   signed that exact hash, shares sum to the amount, the nonce is fresh and
   unexpired, and — above the charter threshold — the humans released on hito.
   No judgment, no language. Matching signatures over identical bytes *are* the
   agreement.

## How the agents actually communicate (transports)

The brain (`LlmDriver`), the settlement/signing, and the execution are identical
regardless of transport — only the shared channel changes. So we can start simple
and swap later without a rewrite.

| Option | Where each agent runs | Shared channel | Partner online? | Profile privacy | Infra |
|---|---|---|---|---|---|
| **A. Server-orchestrated** | one backend runs both | in-process thread | not needed | backend sees both (per-turn one at a time) | lowest — built + live |
| **B. 0G-KV bus** (`kvBus.ts`) | each in its own browser | append-only 0G-KV log | both, turn-based | strongest — profiles never leave device | highest — funded Galileo key, on-chain write per turn |
| **C. Server-relay** | each in its own browser | server session (Franco's bridge pattern) | both, turn-based | strong — server relays messages, not profiles | medium — no 0G dependency |

Cross-cutting: **notifications** (World MiniKit push so the partner opens the app
and their agent responds) and optionally a **realtime channel** (SSE/WebSocket)
instead of polling.

Infra nuance: **0G-KV reads are free; only writes cost gas.** So loading profiles
for a negotiation is free — we only pay to *publish* them. A and C can even keep
profiles in a plain store and use 0G purely as an optional audit archive.

**Direction:** ship **A** for real async users now (works even when the partner
is offline), evolve to **C** for on-device profile privacy, keep **B** as the
decentralized, on-brand-for-0G/AgentKit north star.

## What's built vs. what's next

**Built (this session):**
- The full engine already existed in `lib/agents/` (negotiate, LlmDriver,
  TrusteeExecutor, kvBus, protocol, signatures, 0G-KV) but was never wired in.
- `POST /api/agent/negotiate` — runs both agents over the real engine, returns
  transcript + settlement (derived shares). Proven live on `glm-5.2`.
- `POST/GET /api/agent/profile` — publishes/reads a human's `StoredProfile` on
  0G-KV (`brain/<address>`).

**Blocked:** 0G-KV *writes* need the Galileo wallet `0xE9728a…155` funded
(faucet.0g.ai). Reads are free.

**Next:**
- Persist charter + profiles (per-user, per-bond) — plain store or 0G-KV.
- Wire the personal-agent chat + bond page to open a real case and render the
  shared thread + the negotiated split, replacing the scripted card.
- Trustee execution over the live vault rail (MiniKit) + dual-hito.
- Partner notification + peer auto-run; then optional swap to the 0G-KV bus.

## Model note

The negotiation engine uses `glm-5.2` (verified working). The live
`/api/agent/chat` and `/api/agent/trustee` routes still default to
`zai-org/GLM-5-FP8`, which the engine's own code says does not exist on the 0G
router — worth confirming those aren't silently failing.
