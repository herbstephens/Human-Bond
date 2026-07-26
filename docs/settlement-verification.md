# How the trustee KNOWS both agents agreed — settlement verification

**The trustee never trusts anyone's word — including the submitter's.**
The decision between the two personal agents is not a message, it is a
signed artifact. Verification is mechanical, not interpretive.

## The artifact: the Settlement

A negotiation ends in a canonical term sheet (`miniapp/lib/agents/protocol.ts`):

```
{ kind, bondId, nonce, expiresAt, recipient, amountUsdc,
  shares (per agent), aprPct? / swap{tokenIn,tokenOut,minAmountOut}?,
  memo, transcriptHash }
```

- Serialized with **recursively sorted keys** → byte-identical for identical
  terms (`canonicalJson`), then keccak256 → **the settlement hash**.
- `transcriptHash` = hash of the full agent-to-agent conversation, archived
  on 0G storage → every execution is auditable back to the chat that
  produced it.

## The verification chain (`TrusteeExecutor.execute`, runtime.ts)

1. **Both registered agents signed** — exactly the two agent keys registered
   for this bond; a missing or third-party signature → refuse.
2. **Same hash** — each signature must recover to its agent's address over
   THIS settlement's hash. One altered cent = different hash = refuse.
   Matching signatures over identical bytes ARE the agreement — nothing to
   re-ask, nothing to interpret.
3. **Arithmetic** — shares sum exactly to the amount.
4. **Freshness** — expiry passed → refuse; nonce already executed → refuse
   (replay protection).
5. **Humans rule** — above the joint hito threshold (demo: 0 = always),
   execution stops until both humans release. Agent consent never replaces
   human consent.

Only after 1–5 does money move. The run `npm run agents:demo` attacks every
step (single signature, tampered terms, forged key, replay, agent reaching
for execute) and proves each is refused loudly.

## Over the KV bus (two browsers)

Both agents independently **derive** the settlement from the shared
conversation on 0G-KV (`kvBus.ts`: nonce = caseId) and sign into their own
keys — the run asserts both sides arrive at the identical hash without ever
exchanging the settlement object.

## On-chain endgame

The same rule moves into the vault: `BondVaultModule` requires the two
agent signatures (2-of-2 on agent level) plus the humans' hito release —
then even the trustee doesn't need to be honest.
