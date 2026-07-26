/**
 * The wire between the three agents.
 *
 * Core idea: negotiation may be fuzzy (LLM chatter between the two personal
 * agents), but the ORDER handed to the trustee is a canonical, hash-signed
 * term sheet — the Settlement. The trustee never interprets language and
 * never trusts the submitter: it verifies that BOTH registered agents signed
 * the exact same settlement hash. One signature = no order. Different terms =
 * different hash = no order. The chat is color; the settlement is law.
 *
 * The full negotiation transcript is archived on 0G storage and referenced
 * from the settlement by hash, so any execution is auditable back to the
 * conversation that produced it.
 */
import { keccak256, stringToHex } from 'viem';

export type AgentRole = 'personal' | 'trustee';

export type AgentIdentity = {
  /** Stable id, e.g. 'agent-ben'. On-chain this becomes an ERC-7857 identity. */
  id: string;
  /** The human this agent advocates for (trustee has none). */
  human: string;
  /** Address of the agent's signing key. */
  address: `0x${string}`;
};

export type Settlement = {
  kind: 'payment' | 'investment' | 'swap';
  bondId: string;
  /** Replay protection — the trustee executes each nonce at most once. */
  nonce: string;
  /** Unix ms. Stale settlements are dead settlements. */
  expiresAt: number;
  /** ENS name or 0x address receiving the funds. */
  recipient: string;
  amountUsdc: number;
  /** agentId -> share in USDC pulled from that agent's human. Must sum to amountUsdc. */
  shares: Record<string, number>;
  /** Investment terms are SIGNED terms — required when kind is 'investment'. */
  aprPct?: number;
  /** Swap terms (Uniswap) are SIGNED terms — required when kind is 'swap'.
   *  minAmountOut is the slippage floor BOTH agents agreed to. */
  swap?: { tokenIn: string; tokenOut: string; minAmountOut: number };
  memo: string;
  /** keccak of the negotiation transcript archived on 0G storage. */
  transcriptHash: `0x${string}`;
};

export type SettlementSignature = {
  agentId: string;
  address: `0x${string}`;
  signature: `0x${string}`;
};

export type SignedSettlement = {
  settlement: Settlement;
  signatures: SettlementSignature[];
};

export type NegotiationMessage = {
  from: string;
  to: string;
  text: string;
  at: number;
};

export type NegotiationTranscript = {
  bondId: string;
  subject: string;
  messages: NegotiationMessage[];
};

/** Deterministic JSON: recursively sorted keys, so both agents and the
 *  trustee derive byte-identical bytes for identical terms. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function settlementHash(s: Settlement): `0x${string}` {
  return keccak256(stringToHex(canonicalJson(s)));
}

export function transcriptHash(t: NegotiationTranscript): `0x${string}` {
  return keccak256(stringToHex(canonicalJson(t)));
}
