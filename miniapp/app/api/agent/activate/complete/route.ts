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
  AGENTKIT_APP_ID,
  AGENTKIT_REGISTER_SIGNATURE,
  AGENTKIT_ACTION,
  AGENTKIT_RELAY_URL,
  decodeKnownAgentBookError,
  normalizeWorldIdProof,
} from '@/lib/agents/agentkitRegistration';
import { WORLD_APP_CONFIG } from '@/lib/contracts';

type CompleteActivationBody = {
  agentAddress: `0x${string}`;
  nonce: string;
  merkleRoot: string;
  nullifierHash: string;
  proof: string;
};

export async function POST(request: Request) {
  // Surfacing, not swallowing: this runs on a phone with no terminal attached,
  // and Next returns a bodyless 500 for a thrown error — which reads as "HTTP 500"
  // and nothing else. The message is the whole point of this test, so it is
  // re-raised as JSON and logged. Nothing is recovered or retried.
  try {
    return await activate(request);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error('[agentkit] activation failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function activate(request: Request) {
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

  // Verbose by design: this route is where the open question gets answered —
  // whether AgentBook accepts a proof minted under our app_id (MiniKit path) or
  // only under AgentKit's (bridge path). The relay's reply is the evidence.
  const proof = normalizeWorldIdProof(body.proof);
  const relayPayload = {
    agent: body.agentAddress,
    root: body.merkleRoot,
    nonce: body.nonce,
    nullifierHash: body.nullifierHash,
    proof,
    contract: AGENTKIT_AGENT_BOOK,
  };

  console.info('[agentkit] registering', {
    agent: body.agentAddress,
    nonce: body.nonce,
    nullifierHash: body.nullifierHash,
  });
  console.info('[agentkit] registration contract call', {
    appIds: {
      humanBondMiniKitAppId: WORLD_APP_CONFIG.APP_ID,
      nextPublicWorldAppId: process.env.NEXT_PUBLIC_WORLD_APP_ID ?? null,
      defaultHumanBondAppId: 'app_bfc3261816aeadc589f9c6f80a98f5df',
      agentKitAppId: AGENTKIT_APP_ID,
      action: AGENTKIT_ACTION,
    },
    contract: AGENTKIT_AGENT_BOOK,
    function: AGENTKIT_REGISTER_SIGNATURE,
    args: {
      agent: body.agentAddress,
      root: body.merkleRoot,
      nonce: body.nonce,
      nullifierHash: body.nullifierHash,
      proofWords: proof.length,
    },
    abi: AGENTKIT_AGENT_BOOK_ABI,
    knownErrorSelectors: {
      '0x7fcdd1f4': 'ProofInvalid()',
    },
  });

  const relayResponse = await fetch(`${AGENTKIT_RELAY_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relayPayload),
  });
  if (!relayResponse.ok) {
    const detail = await relayResponse.text();
    const decodedError = decodeKnownAgentBookError(detail);
    console.error('[agentkit] relay rejected', {
      status: relayResponse.status,
      decodedError,
      contract: AGENTKIT_AGENT_BOOK,
      function: AGENTKIT_REGISTER_SIGNATURE,
      abi: AGENTKIT_AGENT_BOOK_ABI,
      detail,
    });
    throw new Error(
      `AgentKit registration relay ${relayResponse.status}${decodedError ? ` (${decodedError})` : ''}: ${detail}`,
    );
  }
  console.info('[agentkit] relay accepted the proof');

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
