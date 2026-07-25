/**
 * World AgentKit human-backing check — the trustee's door policy.
 *
 * For each agent seed we derive the demo agent address and look it up in
 * AgentBook (canonical deployment on World Chain 480). A non-null anonymous
 * human id means a real World ID-verified human registered this agent wallet.
 * Two agents backed by the SAME human return the same id — so we can also
 * assert that a bond's two agents answer to two DISTINCT humans.
 *
 * Registration (one-time, gasless, World App prompt):
 *   npx @worldcoin/agentkit-cli register <agent-address>
 */
import { NextResponse } from 'next/server';
import { createAgentBookVerifier } from '@worldcoin/agentkit';
import { demoAgentAccount } from '@/lib/agents/identity';

type VerifyBody = { seeds: string[] };

const agentBook = createAgentBookVerifier();

export async function POST(req: Request) {
  const { seeds } = (await req.json()) as VerifyBody;
  if (!Array.isArray(seeds) || seeds.length === 0)
    return NextResponse.json({ error: 'seeds[] required' }, { status: 400 });

  const agents = await Promise.all(
    seeds.map(async (seed) => {
      const address = demoAgentAccount(seed).address;
      const humanId = await agentBook.lookupHuman(address);
      return { seed, address, backed: humanId !== null, humanId };
    }),
  );

  const backedIds = agents.filter((a) => a.backed).map((a) => a.humanId);
  const distinctHumans = new Set(backedIds).size === backedIds.length;

  return NextResponse.json({ agents, distinctHumans });
}
