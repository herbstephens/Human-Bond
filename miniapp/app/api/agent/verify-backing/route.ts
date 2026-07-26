/**
 * World AgentKit human-backing check — the trustee's door policy.
 *
 * Two ways to name an agent:
 *
 *   { wallets: ["0x…"] }  LIVE — each wallet resolves through the 0G-KV
 *                         owner→agent link written when that partner finished
 *                         bridge activation, then AgentBook (World Chain 480)
 *                         answers whether a verified human stands behind it.
 *   { seeds: ["rogue"] }  DEMO — derives a deterministic demo address. Kept for
 *                         the rogue-agent beat: an address nobody registered,
 *                         refused at the door.
 *
 * Two agents backed by the SAME human return the same anonymous id — so we can
 * also assert that a bond's two agents answer to two DISTINCT humans.
 */
import { NextResponse } from 'next/server';
import { createAgentBookVerifier } from '@worldcoin/agentkit';
import { demoAgentAccount } from '@/lib/agents/identity';
import { agentAddressForOwner } from '@/lib/agents/agentKeyVault.server';

type VerifyBody = { seeds?: string[]; wallets?: string[] };

type AgentCheck = {
  /** What the caller asked about — a seed or a wallet, echoed back. */
  seed?: string;
  wallet?: string;
  /** The agent address that was (or would be) checked; null if the wallet has no agent. */
  address: `0x${string}` | null;
  backed: boolean;
  humanId: string | null;
};

const agentBook = createAgentBookVerifier();

async function checkAddress(address: `0x${string}`): Promise<{ backed: boolean; humanId: string | null }> {
  const humanId = await agentBook.lookupHuman(address);
  return { backed: humanId !== null, humanId: humanId === null ? null : String(humanId) };
}

export async function POST(req: Request) {
  const { seeds, wallets } = (await req.json()) as VerifyBody;
  const useWallets = Array.isArray(wallets) && wallets.length > 0;
  const useSeeds = Array.isArray(seeds) && seeds.length > 0;
  if (!useWallets && !useSeeds)
    return NextResponse.json({ error: 'wallets[] or seeds[] required' }, { status: 400 });

  const agents: AgentCheck[] = useWallets
    ? await Promise.all(
        wallets.map(async (wallet): Promise<AgentCheck> => {
          const address = await agentAddressForOwner(wallet as `0x${string}`);
          if (!address) return { wallet, address: null, backed: false, humanId: null };
          return { wallet, address, ...(await checkAddress(address)) };
        }),
      )
    : await Promise.all(
        seeds!.map(async (seed): Promise<AgentCheck> => {
          const address = demoAgentAccount(seed).address;
          return { seed, address, ...(await checkAddress(address)) };
        }),
      );

  const backedIds = agents.filter((a) => a.backed).map((a) => a.humanId);
  const distinctHumans = new Set(backedIds).size === backedIds.length;

  return NextResponse.json({ agents, distinctHumans });
}
