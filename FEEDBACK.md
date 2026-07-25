# Uniswap Developer Feedback — HumanBond (ETHGlobal Lisbon 2026)

## How we use Uniswap

HumanBond is a three-agent system for shared money between two humans: each
human runs a personal AI agent, a neutral trustee executes only what both
agents have cryptographically co-signed, and every transaction is released by
the humans on hardware (hito) wallets.

We integrate the **Uniswap Trade API** as the trustee's market access — the
prize's "coordination between agents or systems" case, literally:

1. The trustee pulls a real quote (`miniapp/lib/agents/uniswap.ts`).
2. The two personal agents vet the quote against their humans' profiles and
   negotiate the attribution; the EXACT swap terms — tokenIn, tokenOut, the
   slippage floor `minAmountOut` — are part of the canonical settlement hash
   both agents sign (`miniapp/lib/agents/protocol.ts`).
3. The trustee verifies both signatures, stops at the human-release gate, and
   only then executes the API's swap (`miniapp/lib/agents/runtime.ts`,
   `TrusteeExecutor` — kind `'swap'`).

Run the full choreography incl. attacked guardrails:
`cd miniapp && npm run agents:demo`

## Feedback

- (filled in during the hackathon as we integrate the quote/swap endpoints)
