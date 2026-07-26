import { NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { worldchain } from 'viem/chains';
import { createAndStoreAgentKey, markAgentRegistered } from '@/lib/agents/agentKeyVault.server';
import { startActivation } from '@/lib/agents/activationSessions.server';
import {
  AGENTKIT_AGENT_BOOK,
  AGENTKIT_AGENT_BOOK_ABI,
  AGENTKIT_ACTION,
  AGENTKIT_APP_ID,
  AGENTKIT_RELAY_URL,
  normalizeWorldIdProof,
} from '@/lib/agents/agentkitRegistration';

/**
 * Bridge activation — the variant that survives the mini app being closed.
 *
 * Mints the agent key, opens a World ID bridge session under AGENTKIT's app (the
 * only app the global AgentBook accepts), and hands the waiting to the server.
 * The client gets a link to tap and a session id to check back on.
 *
 * `owner` is the partner wallet this agent will act for — required, because an
 * agent nobody can claim is useless to the bond. The wallet→agent link is
 * persisted only after AgentBook accepts the proof.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      owner?: string;
      bondId?: string;
    };
    if (!body.owner || !isAddress(body.owner)) {
      return NextResponse.json(
        { error: 'owner (the partner wallet this agent acts for) is required' },
        { status: 400 },
      );
    }
    const owner = body.owner as `0x${string}`;

    const client = createPublicClient({
      chain: worldchain,
      transport: http(process.env.WORLDCHAIN_RPC_URL),
    });

    const agent = await createAndStoreAgentKey(BigInt(0), { owner, bondId: body.bondId });
    const nonce = await client.readContract({
      address: AGENTKIT_AGENT_BOOK,
      abi: AGENTKIT_AGENT_BOOK_ABI,
      functionName: 'getNextNonce',
      args: [agent.address],
    });
    if (nonce !== BigInt(0)) {
      throw new Error(`Fresh agent ${agent.address} unexpectedly has AgentBook nonce ${nonce}`);
    }

    const session = await startActivation({
      agentAddress: agent.address,
      nonce: nonce.toString(),
      appId: AGENTKIT_APP_ID,
      action: AGENTKIT_ACTION,
      register: async ({ merkleRoot, nullifierHash, proof }) => {
        const relay = await fetch(`${AGENTKIT_RELAY_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: agent.address,
            root: merkleRoot,
            nonce: nonce.toString(),
            nullifierHash,
            proof: normalizeWorldIdProof(proof),
            contract: AGENTKIT_AGENT_BOOK,
          }),
        });
        if (!relay.ok) {
          throw new Error(`AgentKit relay ${relay.status}: ${await relay.text()}`);
        }
        const { txHash } = (await relay.json()) as { txHash?: `0x${string}` };
        if (!txHash) throw new Error('AgentKit relay returned no transaction hash');

        const receipt = await client.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') throw new Error(`Registration tx ${txHash} reverted`);

        // The whole point of the exercise: a non-zero humanId is the proof that a
        // verified human stands behind this agent.
        //
        // Read with retries: the public RPC load-balances across nodes, so the
        // one answering this call can lag the one that mined the receipt. Reading
        // once reported a successful registration as a failure — the agent was
        // registered, we just asked too early.
        let humanId = BigInt(0);
        for (let attempt = 1; attempt <= 6 && humanId === BigInt(0); attempt++) {
          if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 2000));
          humanId = await client.readContract({
            address: AGENTKIT_AGENT_BOOK,
            abi: AGENTKIT_AGENT_BOOK_ABI,
            functionName: 'lookupHuman',
            args: [agent.address],
          });
        }
        if (humanId === BigInt(0)) {
          throw new Error(
            `AgentBook did not link ${agent.address} to a verified human after tx ${txHash}`,
          );
        }
        console.info(`[activation] ${agent.address} is human-backed — humanId ${humanId}`);

        // Persist the outcome: agent record → registered (with humanId), and
        // the owner wallet → agent link that verify-backing resolves later.
        await markAgentRegistered(agent, txHash, humanId.toString());
        console.info(`[activation] linked owner ${owner} → agent ${agent.address}`);
        return txHash;
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      agentAddress: session.agentAddress,
      connectorURI: session.connectorURI,
      appId: AGENTKIT_APP_ID,
      action: AGENTKIT_ACTION,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error('[activation] bridge start failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
