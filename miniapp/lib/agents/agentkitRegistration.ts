import { decodeAbiParameters } from 'viem';

export const AGENTKIT_AGENT_BOOK = '0xA23aB2712eA7BBa896930544C7d6636a96b944dA' as const;
export const AGENTKIT_APP_ID = 'app_a7c3e2b6b83927251a0db5345bd7146a' as const;
export const AGENTKIT_ACTION = 'agentbook-registration';
export const AGENTKIT_RELAY_URL = 'https://x402-worldchain.vercel.app';

export const AGENTKIT_AGENT_BOOK_ABI = [
  {
    type: 'function',
    name: 'getNextNonce',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lookupHuman',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: 'humanId', type: 'uint256' }],
  },
] as const;

export function normalizeWorldIdProof(rawProof: string): `0x${string}`[] {
  if (rawProof.startsWith('[')) {
    const parsed: unknown = JSON.parse(rawProof);
    if (
      Array.isArray(parsed) &&
      parsed.length === 8 &&
      parsed.every((entry) => typeof entry === 'string' && /^0x[0-9a-fA-F]+$/.test(entry))
    ) {
      return parsed as `0x${string}`[];
    }
    throw new Error('AgentKit registration proof is not an eight-element hex array');
  }

  const decoded = decodeAbiParameters([{ type: 'uint256[8]' }], rawProof as `0x${string}`)[0];
  return decoded.map((value) => `0x${value.toString(16).padStart(64, '0')}` as const);
}
