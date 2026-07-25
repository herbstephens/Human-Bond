import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import { createAndStoreAgentKey } from '@/lib/agents/agentKeyVault.server';
import {
  AGENTKIT_AGENT_BOOK,
  AGENTKIT_AGENT_BOOK_ABI,
  AGENTKIT_ACTION,
  AGENTKIT_APP_ID,
} from '@/lib/agents/agentkitRegistration';

export async function POST() {
  const client = createPublicClient({
    chain: worldchain,
    transport: http(process.env.WORLDCHAIN_RPC_URL),
  });

  // A new address always starts at nonce zero, but reading AgentBook keeps this
  // flow identical to the official CLI and makes the assumption explicit.
  const provisional = await createAndStoreAgentKey(BigInt(0));
  const nonce = await client.readContract({
    address: AGENTKIT_AGENT_BOOK,
    abi: AGENTKIT_AGENT_BOOK_ABI,
    functionName: 'getNextNonce',
    args: [provisional.address],
  });
  if (nonce !== BigInt(0)) {
    throw new Error(`Fresh agent ${provisional.address} unexpectedly has AgentBook nonce ${nonce}`);
  }

  return NextResponse.json({
    agentAddress: provisional.address,
    nonce: nonce.toString(),
    appId: AGENTKIT_APP_ID,
    action: AGENTKIT_ACTION,
  });
}
