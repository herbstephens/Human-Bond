/**
 * HumanBond AgentBook human-backing check — the trustee's door policy.
 *
 * For each agent seed we derive the demo agent address and look it up in
 * HumanBondAgentBook on World Chain 480. A non-null anonymous human id means
 * a real World ID-verified human registered this agent wallet.
 * Two agents backed by the SAME human return the same id — so we can also
 * assert that a bond's two agents answer to two DISTINCT humans.
 */
import { NextResponse } from 'next/server';
import { createPublicClient, http, toHex } from 'viem';
import { worldchain } from 'viem/chains';
import { AGENTKIT_AGENT_BOOK_ABI } from '@/lib/agents/agentkitRegistration';
import {
  assertHumanBondAgentBookDeployed,
  humanBondAgentBookAddress,
} from '@/lib/agents/humanBondAgentBook.server';
import { demoAgentAccount } from '@/lib/agents/identity';

type VerifyBody = { seeds: string[] };

export async function POST(req: Request) {
  const { seeds } = (await req.json()) as VerifyBody;
  if (!Array.isArray(seeds) || seeds.length === 0)
    return NextResponse.json({ error: 'seeds[] required' }, { status: 400 });

  const agentBookAddress = humanBondAgentBookAddress();
  const client = createPublicClient({
    chain: worldchain,
    transport: http(process.env.WORLDCHAIN_RPC_URL),
  });
  await assertHumanBondAgentBookDeployed(client, agentBookAddress);

  const agents = await Promise.all(
    seeds.map(async (seed) => {
      const address = demoAgentAccount(seed).address;
      const humanId = await client.readContract({
        address: agentBookAddress,
        abi: AGENTKIT_AGENT_BOOK_ABI,
        functionName: 'lookupHuman',
        args: [address],
      });
      return {
        seed,
        address,
        backed: humanId !== BigInt(0),
        humanId: humanId === BigInt(0) ? null : toHex(humanId),
      };
    }),
  );

  const backedIds = agents.filter((a) => a.backed).map((a) => a.humanId);
  const distinctHumans = new Set(backedIds).size === backedIds.length;

  return NextResponse.json({ agentBook: agentBookAddress, agents, distinctHumans });
}
