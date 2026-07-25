import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import { createAndStoreAgentKey } from '@/lib/agents/agentKeyVault.server';
import {
  AGENTKIT_AGENT_BOOK_ABI,
  AGENTKIT_ACTION,
} from '@/lib/agents/agentkitRegistration';
import {
  assertHumanBondAgentBookDeployed,
  humanBondAgentBookAddress,
} from '@/lib/agents/humanBondAgentBook.server';
import { WORLD_APP_CONFIG } from '@/lib/contracts';

export async function POST() {
  try {
    return await start();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error('[agentkit] start failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function start() {
  const agentBookAddress = humanBondAgentBookAddress();
  const client = createPublicClient({
    chain: worldchain,
    transport: http(process.env.WORLDCHAIN_RPC_URL),
  });
  await assertHumanBondAgentBookDeployed(client, agentBookAddress);

  // A new address always starts at nonce zero, but reading AgentBook keeps the
  // registration nonce explicit and catches a reused key immediately.
  const provisional = await createAndStoreAgentKey(BigInt(0));
  const nonce = await client.readContract({
    address: agentBookAddress,
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
    appId: WORLD_APP_CONFIG.APP_ID,
    action: AGENTKIT_ACTION,
  });
}
