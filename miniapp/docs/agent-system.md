# The Agent System — what actually runs today

Status audit of the HumanBond agent layer as it exists in the code on branch `feat/mini-app`
(miniapp repo), 2026-08-02. Written from the source, not from the plans: everything below is
either "this executes in the shipped app", "this executes only headless", or "this is a mock".
File references are `path:line`.

---

## 0. TL;DR

There are **two agent systems in this repo**, and they do not touch each other yet:

| | **Shipped path** (what the phone runs) | **Protocol runtime** (what the npm scripts run) |
|---|---|---|
| Code | `app/api/agent/*`, `lib/agent/agentStore.ts`, `app/agent/page.tsx` | `lib/agents/*`, `scripts/agents-*.ts` |
| Brain | 0G model router, OpenAI-compatible chat completions | same router (`LlmDriver`) |
| Consent | **one human** taps "Approve with hito" → MiniKit tx | **both agents sign** a canonical settlement hash, trustee verifies |
| Money | real `BondVaultModule.proposeSpend` on World Chain | `MockRail` (fake tx refs) |
| Storage | 0G-KV for agent keys only | 0G-KV for brain / charter / history |
| Runs in | browser + Next API routes | `npm run agents:demo` / `agents:live` / `agents:bus` |

So: **the agent can genuinely move money** (it drafts a spend, a human approves, the tx goes
on-chain through the vault module), but the *dual-signed settlement protocol* that the docs
describe — two agents negotiating and both signing — is currently only exercised headless.
Bridging those two is the main open piece, and section 7 proposes the UI for it.

---

## 1. The three roles

Defined in `lib/agents/protocol.ts:17` and enforced in `lib/agents/tools.ts:25`:

- **Personal agent** (one per human). Tools: `read_own_profile`, `send_to_peer`,
  `sign_settlement`, `submit_settlement`, `notify_human`. It **structurally cannot execute a
  payment** — there is no execute tool in its allowlist.
- **Trustee / bond manager** (one per bond, neutral). Tools: `verify_settlement`,
  `execute_payment`, `place_investment`, `report_to_humans`. It **cannot negotiate or advocate**.
- **The humans.** Above the charter threshold, agent consent never substitutes for human release
  (`HumanReleaseRequired`, `lib/agents/runtime.ts:141`).

The prompts *state* these boundaries (`lib/agents/prompts.ts`), `tools.ts` *enforces* them —
`assertToolAllowed` throws `ToolAccessViolation` regardless of what the model tried to do.

---

## 2. Where 0G is used — three distinct things

People conflate these. They are separate integrations.

### 2.1 0G Compute / model router — the agent's voice and judgment

OpenAI-compatible endpoint `https://router-api.0g.ai/v1`. Three consumers, three env tiers:

| Route | Purpose | Env | Default model |
|---|---|---|---|
| `app/api/agent/onboard/route.ts` | the agent's phrasing during creation (reactions + profile mirror) | `ZG_ROUTER_FAST_*` | `deepseek-v4-flash`, currently overridden to `qwen/qwen2.5-omni-7b` on a free testnet router |
| `app/api/agent/chat/route.ts` | personal-agent chat **with tool calling** | `ZG_ROUTER_CHAT_*` → `ZG_ROUTER_*` | `zai-org/GLM-5-FP8` |
| `app/api/agent/trustee/route.ts` | the neutral bond manager chat | same | same |
| `lib/agents/llmDriver.ts` | agent-to-agent negotiation turns (headless) | `ZG_ROUTER_API_KEY` | `glm-5.2` |

Note the model-id drift: `llmDriver.ts:21` documents that `zai-org/GLM-5-FP8` **does not exist**
on the router (`GET /v1/models` returns `glm-5` / `glm-5.1` / `glm-5.2`) — but the two chat
routes still default to it. In `.env.local` `ZG_ROUTER_MODEL=zai-org/GLM-5-FP8` is set
explicitly, so if chat 502s with a model error, that is the first thing to change.

The API key never reaches the client — every model call goes through a Next route handler.

### 2.2 0G-KV storage — the second brain and the agent keys

`lib/agents/zeroGKv.ts` implements the `HBStorage` interface (`lib/agents/storage.ts:12`) on the
0G Galileo testnet (chain 16602). Writes go through the flow contract with a funded key
(`ZG_KV_PRIVATE_KEY`); reads hit a KV node directly. One stream (`ethers.id('humanbond-v1')`),
namespaced keys:

```
brain/<human>                    StoredProfile — income, protected budget, hito threshold, facts
charter/<bondId>                 StoredCharter — split rule, joint hito threshold, heirs
history/<bondId>                 append-only executions + transcripts
agent-keys/<agentAddress>        AES-256-GCM encrypted agent private key  ← used by the app
agent-owner/<wallet>             wallet → agent link                      ← used by the app
<caseId>.<pair>                  kvBus conversation log
sig.<agentId>.<caseId>.<pair>    per-agent settlement signature
cases.<pair>                     case registry per bond pair
```

**What the shipped app actually writes to 0G-KV today: only the last two of the app-marked rows** —
`agent-keys/*` and `agent-owner/*`, from `lib/agents/agentKeyVault.server.ts`. The brain, charter
and history namespaces are written only by the headless scripts. The personal-agent chat sends
the profile *from the browser's Zustand store* on every request (`agentStore.ts:737`), it does not
read `brain/<human>` off 0G.

Two operational realities are already coded around:

- **0G-KV is eventually consistent.** `putJson` submits a storage tx; the KV node indexes it
  after. Activation writes a key and reads it back seconds later, inside that window — so
  `agentKeyVault.server.ts:61` keeps an in-process `recentWrites` map. 0G-KV stays the system of
  record; the map only answers for records this process wrote.
- **The KV node hangs on keys it has never seen** (no timeout in the SDK). Reading an unlinked
  wallet is exactly that case, so `agentAddressForOwner` races an 8s deadline and treats a
  timeout as "no agent" (`agentKeyVault.server.ts:150`).

Both are single-server assumptions. On a multi-instance deploy, partner B hitting a different
instance than the one that registered partner A falls back to the network read.

### 2.3 The 0G-KV bus — agents in different browsers

`lib/agents/kvBus.ts` is the multi-device design: each human runs their own agent, the two never
share a process, they talk **only through 0G-KV keys**. No write races by construction — the
conversation is strictly turn-based, signatures live under per-agent keys, the registry is
written by the initiator.

The elegant bit (`deriveSettlement`, `kvBus.ts:64`): both sides rebuild the **identical**
settlement deterministically from the shared conversation (nonce = caseId, expiry from the case
record), so their signatures land on one identical hash without ever exchanging the settlement
object. `npm run agents:bus -- --kv` asserts both arrived at the same hash over real 0G-KV.

**This is not wired into the app.** No React code imports `kvBus.ts`.

---

## 3. The settlement protocol (headless, but real)

`lib/agents/protocol.ts` — the chat may be fuzzy; the **order handed to the trustee is a
canonical, hash-signed term sheet**.

```
Settlement { kind, bondId, nonce, expiresAt, recipient, amountUsdc,
             shares{agentId→usdc}, aprPct?, swap?, memo, transcriptHash }
```

`canonicalJson` (recursively sorted keys) → `keccak256` → both agents sign the raw hash with
their own key (`identity.ts:27`).

`TrusteeExecutor.execute` (`runtime.ts:166`) then refuses on any of:

1. missing signature from either registered agent;
2. a signature from an unregistered key;
3. a signature that does not recover over *these* terms (terms altered after signing);
4. shares not summing to the amount (±0.005);
5. expired settlement;
6. replayed nonce;
7. amount over `charter.jointHitoThresholdUsdc` without `humansReleased` → throws
   `HumanReleaseRequired`.

It never "helpfully" proceeds. The key insight in the comment at `runtime.ts:160`: the trustee
does not trust the submitter and does not re-ask anyone — **matching signatures over identical
bytes ARE the agreement**, so whoever hands the order in is irrelevant.

Execution then dispatches to a `PaymentRail` (`tools.ts:56`): `pull` / `invest` / `swap`. The
only implementation today is `MockRail`. **The rail is the missing adapter** — wiring
`PaymentRail.pull` to `BondVaultModule.proposeSpend` is what would connect section 3 to section 4.

Verified headless, including attack cases: `npm run agents:demo`, `agents:live`, `agents:bus`.

---

## 4. What happens when you talk to your agent today — the real path

This is the flow that moves real USDC. Trace it end to end:

```
/agent chat input
  └─ submitDraft()                          app/agent/page.tsx:350
     ├─ context-aware shortcuts (yes / "I don't feel good" answer the OPEN question)
     └─ chatLive(text)                      lib/agent/agentStore.ts:726
        └─ POST /api/agent/chat             app/api/agent/chat/route.ts:201
           ├─ system prompt built from: profile answers, custom facts, ACTIVE charter
           │  rules, every active bond with its live vault balance
           ├─ tools: propose_spend, cancel_spend        (route.ts:68)
           ├─ tool_choice forced to propose_spend when the text matches a
           │  concrete shared-spend regex                (route.ts:29, 226)
           └─ returns { say, action }
        └─ store: enqueue the say bubble, set pendingAgentSpend
  └─ "Agent spend ready" card + "Approve with hito"     app/agent/page.tsx:502
     └─ approveAgentSpend()                              app/agent/page.tsx:378
        ├─ recipient must match /^0x[a-fA-F0-9]{40}$/    ← hard reject otherwise
        ├─ parseUsdc()
        └─ proposeSpend(to, amount, false)               lib/hooks/useVaultActions.ts:123
           └─ MiniKit.sendTransaction → BondVaultModule.proposeSpend  ← REAL TX
        └─ proposeShared(...) → the mock 10/90 choreography card renders in chat
```

On-chain, `proposeSpend` then obeys the module's rules (`lib/contracts/vault.ts:46`):
**≤10 USDC executes immediately**, capped at **25 USDC per bond per 24h**; above either limit it
sits as a pending spend needing the partner's `approveSpend`.

The partner sees it in `/bond/[bondId]` → `PendingMoney` (`app/components/bond/PendingMoney.tsx`),
which deliberately shows *both* kinds side by side and labels them differently:
a manual send waits for a **signature**; an agent proposal waits for a **human release**.

### What is real vs. theater in that path

| Element | Real? |
|---|---|
| Model reply, routing personal/shared, bond selection | **Real** — 0G router, tool calling |
| `propose_spend` arguments (label, recipient, amount, bond) | **Real** — model-generated, validated server-side |
| The on-chain `proposeSpend` tx | **Real** — MiniKit → World Chain |
| Partner approval / decline / cancel | **Real** — `PendingMoney` + `useVaultActions` |
| The "talking to Alice's agent…" reasoning bubble | **Scripted string** — `agentStore.ts:632` |
| The 10 / 90 split shown on the card | **Hardcoded** — `agentStore.ts:624` |
| "Released — you ✓ · Alice ✓ on hito" step walk | **`setTimeout` theater** — `agentStore.ts:696` |
| Second agent, negotiation, dual signature | **Does not happen on this path** |

That is worth being blunt about internally: the choreography card is honest about the *protocol
we intend*, but on the live path the money moved because **one** human approved, and the contract
enforced the limits. No settlement hash was signed.

---

## 5. The trustee on the bond page

`app/bond/[bondId]/page.tsx` runs a self-contained trustee room:

- Chat → `POST /api/agent/trustee`, which returns `{say, action}` with `action ∈ {invest,
  divest, swap_quote, null}`. The system prompt hard-codes the vault numbers so the model cannot
  invent a balance (`trustee/route.ts:36`).
- **`swap_quote` resolves server-side against the real Uniswap Trade API**
  (`lib/agents/uniswap.ts`), USDC.e → WLD on chain 480. The client only ever sees the answered
  quote. Needs `UNISWAP_API_KEY`; fails hard without one.
- **In live mode, invest/divest refuse to execute**: `runTrusteeAction` (`page.tsx:287`) replies
  "on-chain execution from the Safe is still being wired" and quotes only. The invest/divest state
  walk with the dual-hito card is mock-mode only.
- **The AgentBook door policy is live in both modes.** Before anything reaches the release track,
  `POST /api/agent/verify-backing` resolves each partner wallet → agent (0G-KV owner link) →
  `AgentBook.lookupHuman` on World Chain, and reports whether both agents are human-backed **and
  whether they answer to two distinct humans** (`verify-backing/route.ts:63`).
- The **rogue-agent beat** (`page.tsx:359`) is a real lookup too: a deterministic demo address
  nobody registered, refused at the door because `lookupHuman` returns null.

---

## 6. Agent identity — World AgentKit / AgentBook

Two activation paths exist:

**MiniKit path** — `/api/agent/activate/start` → `MiniKit.verify` in `app/agent/create/page.tsx:204`
→ `/api/agent/activate/complete`. Mints an agent key, gets an orb proof, relays
`AgentBook.register` through `https://x402-worldchain.vercel.app`, waits for the receipt, asserts
`lookupHuman != 0`.

**Bridge path** — `/api/agent/activate/bridge/start|status`, `lib/agents/worldIdBridge.server.ts`.
This exists because **World App does not render the verification sheet on top of a mini app**: it
queues it in the main World App UI, so the human must close the mini app to accept — which tears
down the page and kills any polling living in it. The bridge session therefore lives *server-side*
(the server holds the AES key, keeps polling `bridge.worldcoin.org`, registers on its own), and
the human comes back to a finished job. Only exercised from `app/test/agent_bridge` today; the
creation flow still uses the MiniKit path.

Key handling: `generatePrivateKey()` → AES-256-GCM under `ZG_AGENT_KEY_ENCRYPTION_KEY` →
`agent-keys/<address>` on 0G-KV. The `agent-owner/<wallet>` link is written **only after**
AgentBook accepts the proof, so an aborted activation can never repoint a wallet at an
unregistered agent (`agentKeyVault.server.ts:128`).

`lib/agents/identity.ts` also has `demoAgentAccount` — keys derived from public strings,
deterministic, worthless. Used by the headless scripts and the rogue beat. **Never fund them.**

---

## 7. Proposed UI for agent-driven decisions

The ask: *what UI can we give so the agent creates spend proposals that partners accept?*
Most of the machinery exists; what is missing is a **shared, two-sided proposal object**. Ordered
by ratio of value to work.

### 7.1 Fix first (small, and currently broken-ish)

1. **Accept ENS recipients in the agent approval.** `approveAgentSpend` hard-rejects anything not
   `0x…` (`app/agent/page.tsx:384`), but the chat system prompt explicitly tells the model it may
   return an ENS name, and every bond *has* a `<label>.humanbond.eth` name. `useResolveRecipient`
   already resolves bare labels, full names and addresses against the Durin L2Registry — it is
   used in `SendFundsForm` but not here. Reuse it, and show the resolved address on the approval
   card before the tap.
2. **Pass the real `willExecuteImmediately`.** The agent path always passes `false`
   (`app/agent/page.tsx:395`), so for a ≤10 USDC spend the partner gets "your signature is needed"
   for a payment that already settled. The bond page already computes this correctly
   (`app/bond/[bondId]/page.tsx:109`) — lift that calculation into a shared helper.
3. **Show the vault balance and the limit band on the approval card.** Right now the card states
   amount + recipient + bond. It should also say *"executes immediately"* vs *"needs
   {partner}'s signature"* — that single line is the difference between a confident tap and a
   confused one.

### 7.2 The Proposal object — the real unlock

Today a proposal exists in two disconnected places: `pendingAgentSpend` in **your** browser's
Zustand, and (after approval) a `VaultSpend` on chain. The partner never sees the *reasoning* — no
label, no detail, no agent rationale, because `proposeSpend(to, amount)` carries none of it.

Give the proposal a home on 0G-KV, keyed like the kvBus cases:

```
proposal/<bondId>/<proposalId>   { label, detail, recipient, amountUsdc, rationale,
                                   proposedBy, agentId, createdAt, status,
                                   spendId?, transcriptHash? }
```

Written by `/api/agent/chat` the moment the model calls `propose_spend`, read by both partners.
Then the on-chain `spendId` is the *settlement* of a proposal that both humans could already read,
argue with, and counter — instead of an amount appearing out of nowhere in the partner's app.

This is also the natural place to attach the negotiation transcript hash when section 7.4 lands.

### 7.3 Screens to build

**A. Proposal detail sheet** (`/bond/[bondId]/proposal/[id]`)

Reachable from `PendingMoney` on both sides. Contents, top to bottom:

```
┌──────────────────────────────────────────┐
│ KALORAMA TICKETS ×2          120.00 USDC │
│ to kalorama-tickets.eth · from your vault│
├──────────────────────────────────────────┤
│ WHY                                      │
│ "Both calendars free Fri Sep 4. Vault    │
│  covers it; Ben's buffer untouched."     │
│  — Ben's agent, 2 min ago                │
├──────────────────────────────────────────┤
│ WHAT IT DOES TO THE VAULT                │
│ 340.00 → 220.00 USDC                     │
│ Needs Alice's signature (over 10 USDC)   │
├──────────────────────────────────────────┤
│ [ APPROVE & SEND ]  [ Counter ]  [ No ]  │
└──────────────────────────────────────────┘
```

`Counter` is the piece with no equivalent today. It should open the partner's **own agent chat**
prefilled with the proposal in context — so the answer to a proposal is a conversation with your
own advocate, never a form. That is the product's whole thesis in one interaction.

**B. Agent-proposals section in `PendingMoney`** — already half-built. Extend the existing
`proposals` branch (`PendingMoney.tsx:131`) to render partner-originated proposals too, sourced
from 7.2 rather than from local Zustand, and route the tap to sheet A instead of `/agent`.

**C. "Your agent is negotiating" state.** Once 7.4 exists there is a real interval where the two
agents are exchanging turns. Do not fake it with a spinner — stream the turns. The `onTurn`
callback in `runAgentOnBus` (`kvBus.ts:101`) exists precisely for this. Render it in the
established reasoning style: the small uppercase `Reasoning` label + italic grey text already used
at `app/agent/page.tsx:455`, one line per turn, sequential through `_enqueue` (chat rule #1 — never
two bubbles at once).

**D. Decision inbox on `/home`.** One row per thing waiting on this human, across bonds: agent
proposals, partner signatures, heartbeat due, charter-rule co-signs. Today these are scattered
across `/agent`, `/bond/[id]` and `/vault`. The mental model to sell is *"the agents handled it;
here is the one thing that needs a human"* — a single list is that sentence made literal.

### 7.4 Connecting the settlement protocol to the UI

The honest end state, in order:

1. **`VaultRail implements PaymentRail`** — `pull` → `BondVaultModule.proposeSpend` via MiniKit,
   `swap` → the Uniswap route that `uniswap.ts` already quotes. This alone makes
   `TrusteeExecutor` operate on real money.
2. **Run the personal agent client-side over the bus.** `runAgentOnBus` in a browser effect, using
   the agent key — the key never leaves that device. Storage is the existing `ZeroGKvStorage`.
3. **Both signatures gate the on-chain tx.** The approval card only becomes tappable once
   `collectSignatures` (`kvBus.ts:149`) returns both — and the card shows *both agent addresses and
   the settlement hash*. That is the moment the "Released — you ✓ · Alice ✓" step walk in
   `ProposalCard` stops being `setTimeout` theater and starts being true.
4. **Retire the hardcoded 10/90.** Shares come from the accepted offer in the transcript.

Only step 1 is required for real money; steps 2–4 are what make the *protocol* claim honest.

---

## 8. Environment / operational notes

Required for the agent to work at all:

```
ZG_ROUTER_API_KEY            model router (chat, trustee, negotiation)
ZG_ROUTER_FAST_API_KEY       onboarding voice (can point at the free testnet router)
ZG_KV_PRIVATE_KEY            funded Galileo testnet key — faucet.0g.ai — pays 0G-KV writes
ZG_AGENT_KEY_ENCRYPTION_KEY  random 32-byte hex — encrypts agent private keys at rest
UNISWAP_API_KEY              trustee swap quotes; fails hard without one
WORLDCHAIN_RPC_URL           AgentBook reads/receipts (optional, falls back to public)
```

Every one of these fails **loudly** — no silent fallbacks anywhere in the agent code, per the
project's no-defensive-programming rule.

Deployment reality check:

- `.env.local` currently has `NEXT_PUBLIC_USE_MOCKS=1` and the **TEST** contract set
  (app `app_925d0aaa…`, ENS `humandbond.eth`). `next.config.ts:4` refuses a production Vercel
  build with mocks enabled, so production runs live contracts + live agent routes.
- In live mode `BONDS`, `VAULT_BALANCES` and `STANDING_ORDERS` are empty
  (`agentStore.ts:176`) — the chain seeds the store through `useLiveBondSync`, never the demo
  couples. The persist key is mode-scoped (`agentStore.ts:1025`) so a mock session can never
  rehydrate into the live app.
- `miniapp/` is its own git repo (`origin: FrancoAmicone/marriageDao`), nested inside the parent
  `herbstephens/Human-Bond`. Agent work commits to the inner repo.

### Known rough edges

- Chat routes default to `zai-org/GLM-5-FP8`, which `llmDriver.ts:21` documents as non-existent on
  the router. Verify against `GET /v1/models`.
- `activationSessions.server.ts` holds sessions in process memory — a server restart loses them
  (the status route says so explicitly).
- The 0G-KV in-process caches in `agentKeyVault.server.ts` assume a single server instance.
- The personal agent's knowledge is whatever the browser sends per request; nothing reads
  `brain/<human>` off 0G in the shipped path. Clearing localStorage amnesias the agent.
