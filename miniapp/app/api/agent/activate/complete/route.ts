import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import {
  getStoredAgentKey,
  markAgentRegistered,
} from '@/lib/agents/agentKeyVault.server';
import {
  AGENTKIT_AGENT_BOOK,
  AGENTKIT_AGENT_BOOK_ABI,
  AGENTKIT_RELAY_URL,
  normalizeWorldIdProof,
} from '@/lib/agents/agentkitRegistration';

type CompleteActivationBody = {
  agentAddress: `0x${string}`;
  nonce: string;
  merkleRoot: string;
  nullifierHash: string;
  proof: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CompleteActivationBody;
  if (!/^0x[0-9a-fA-F]{40}$/.test(body.agentAddress)) {
    throw new Error('Agent activation returned an invalid agent address');
  }
  if (!/^\d+$/.test(body.nonce)) throw new Error('Agent activation returned an invalid nonce');
  if (!/^\d+$|^0x[0-9a-fA-F]+$/.test(body.merkleRoot)) {
    throw new Error('Agent activation returned an invalid Merkle root');
  }
  if (!/^\d+$|^0x[0-9a-fA-F]+$/.test(body.nullifierHash)) {
    throw new Error('Agent activation returned an invalid nullifier hash');
  }

  const stored = await getStoredAgentKey(body.agentAddress);
  if (stored.agentBook.status !== 'pending') {
    throw new Error(`Agent ${body.agentAddress} is not awaiting registration`);
  }
  if (stored.agentBook.nonce !== body.nonce) {
    throw new Error('AgentBook nonce does not match the stored activation');
  }

  const relayResponse = await fetch(`${AGENTKIT_RELAY_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: body.agentAddress,
      root: body.merkleRoot,
      nonce: body.nonce,
      nullifierHash: body.nullifierHash,
      proof: normalizeWorldIdProof(body.proof),
      contract: AGENTKIT_AGENT_BOOK,
    }),
  });
  if (!relayResponse.ok) {
    throw new Error(`AgentKit registration relay ${relayResponse.status}: ${await relayResponse.text()}`);
  }

  const result = (await relayResponse.json()) as { txHash?: `0x${string}` };
  if (!result.txHash) throw new Error('AgentKit registration relay returned no transaction hash');

  const client = createPublicClient({
    chain: worldchain,
    transport: http(process.env.WORLDCHAIN_RPC_URL),
  });
  const receipt = await client.waitForTransactionReceipt({ hash: result.txHash });
  if (receipt.status !== 'success') {
    throw new Error(`AgentKit registration transaction ${result.txHash} reverted`);
  }
  const humanId = await client.readContract({
    address: AGENTKIT_AGENT_BOOK,
    abi: AGENTKIT_AGENT_BOOK_ABI,
    functionName: 'lookupHuman',
    args: [body.agentAddress],
  });
  if (humanId === BigInt(0)) {
    throw new Error(`AgentBook did not link ${body.agentAddress} to a verified human`);
  }

  await markAgentRegistered(stored, result.txHash);

  return NextResponse.json({
    agentAddress: body.agentAddress,
    txHash: result.txHash,
    registered: true,
    humanBacked: true,
  });
}
