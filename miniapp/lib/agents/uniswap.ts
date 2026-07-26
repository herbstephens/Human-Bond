/**
 * Uniswap Trade API client — the trustee's market eyes and hands.
 *
 * The API prize's target case verbatim: "coordination between agents or
 * systems". Flow: the trustee pulls a REAL quote here, the two personal
 * agents vet it against their humans' profiles and sign the terms
 * (tokenIn/tokenOut/minAmountOut live in the settlement hash), the humans
 * release on hito — only then does the trustee execute the API's swap.
 *
 * Needs UNISWAP_API_KEY (developer key, hackathon portal). Fails hard
 * without one — a demo quote is not a quote.
 */
const TRADE_API = process.env.UNISWAP_API_BASE ?? 'https://trade-api.gateway.uniswap.org/v1';

export type UniQuote = {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  /** Quoted output in tokenOut units. */
  amountOut: number;
  /** Agents typically sign amountOut minus slippage as minAmountOut. */
  raw: unknown;
};

export async function getSwapQuote(opts: {
  tokenIn: string;   // token address
  tokenOut: string;  // token address
  amountIn: string;  // raw units, e.g. USDC 6 decimals
  chainId: number;   // 480 = World Chain
  swapper: string;   // the bond vault (Safe) address
}): Promise<UniQuote> {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) throw new Error('UNISWAP_API_KEY is not set — get a developer key and put it in miniapp/.env.local.');

  const res = await fetch(`${TRADE_API}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-universal-router-version': '2.0' },
    body: JSON.stringify({
      type: 'EXACT_INPUT',
      tokenIn: opts.tokenIn,
      tokenOut: opts.tokenOut,
      amount: opts.amountIn,
      tokenInChainId: opts.chainId,
      tokenOutChainId: opts.chainId,
      swapper: opts.swapper,
    }),
  });
  if (!res.ok) throw new Error(`Uniswap Trade API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { quote: { output: { amount: string }; input: { amount: string } } };
  return {
    tokenIn: opts.tokenIn,
    tokenOut: opts.tokenOut,
    amountIn: Number(json.quote.input.amount),
    amountOut: Number(json.quote.output.amount),
    raw: json,
  };
}
