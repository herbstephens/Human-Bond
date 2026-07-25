import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import {
  getStoredAgentKey,
  markAgentRegistered,
} from '@/lib/agents/agentKeyVault.server';
import {
  AGENTKIT_AGENT_BOOK_ABI,
  AGENTKIT_REGISTER_SIGNATURE,
  normalizeWorldIdProof,
} from '@/lib/agents/agentkitRegistration';
import {
  agentRegistrarAccount,
  assertHumanBondAgentBookDeployed,
  humanBondAgentBookAddress,
} from '@/lib/agents/humanBondAgentBook.server';

type CompleteActivationBody = {
  agentAddress: `0x${string}`;
  nonce: string;
  merkleRoot: string;
  nullifierHash: string;
  proof: string;
};

type WorldIdProofTuple = [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
];

function worldIdProofValues(rawProof: string): WorldIdProofTuple {
  const proof = normalizeWorldIdProof(rawProof);
  if (proof.length !== 8) throw new Error('World ID proof must contain exactly eight field elements');
  return proof.map((word) => BigInt(word)) as unknown as WorldIdProofTuple;
}

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
  const agentBookAddress = humanBondAgentBookAddress();
  const registrar = agentRegistrarAccount();
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
  // whether a HumanBond-scoped AgentBook accepts the MiniKit proof minted under
  // our app_id. The transaction receipt is the evidence.
  const proof = worldIdProofValues(body.proof);

  console.info('[agentkit] registering', {
    agent: body.agentAddress,
    nonce: body.nonce,
    nullifierHash: body.nullifierHash,
  });
  console.info('[agentkit] registration contract call', {
    contract: agentBookAddress,
    registrar: registrar.address,
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

  const client = createPublicClient({
    chain: worldchain,
    transport: http(process.env.WORLDCHAIN_RPC_URL),
  });
  await assertHumanBondAgentBookDeployed(client, agentBookAddress);
  const walletClient = createWalletClient({
    account: registrar,
    chain: worldchain,
    transport: http(process.env.WORLDCHAIN_RPC_URL),
  });

  const txHash = await walletClient.writeContract({
    address: agentBookAddress,
    abi: AGENTKIT_AGENT_BOOK_ABI,
    functionName: 'register',
    args: [
      body.agentAddress,
      BigInt(body.merkleRoot),
      BigInt(body.nonce),
      BigInt(body.nullifierHash),
      proof,
    ],
  });
  console.info('[agentkit] HumanBond AgentBook transaction submitted', { txHash });

  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`HumanBond AgentBook registration transaction ${txHash} reverted`);
  }
  const humanId = await client.readContract({
    address: agentBookAddress,
    abi: AGENTKIT_AGENT_BOOK_ABI,
    functionName: 'lookupHuman',
    args: [body.agentAddress],
  });
  if (humanId === BigInt(0)) {
    throw new Error(`AgentBook did not link ${body.agentAddress} to a verified human`);
  }

  await markAgentRegistered(stored, txHash);

  return NextResponse.json({
    agentAddress: body.agentAddress,
    txHash,
    registered: true,
    humanBacked: true,
  });
}
