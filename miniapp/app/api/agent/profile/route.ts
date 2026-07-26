/**
 * Server-side profile persistence on 0G-KV — the enabler for real, live,
 * cross-user negotiation.
 *
 * A negotiation needs BOTH humans' private profiles, but a profile only lives
 * in its owner's browser. So each human publishes their negotiation profile to
 * 0G-KV under `brain/<address>` (lowercased). The negotiate route then loads
 * both partners' profiles by their bond addresses — neither device needs the
 * other online.
 *
 * Writes go through the funded Galileo key (ZG_KV_PRIVATE_KEY); the profile
 * itself carries only what a negotiation needs (income band, protected budget,
 * hito threshold, a few facts) — not the raw second brain.
 */
import { NextResponse } from 'next/server';
import { getHbStorage } from '@/lib/agents/hbStorage.server';
import type { StoredProfile } from '@/lib/agents/storage';

const brainKey = (address: string) => `brain/${address.toLowerCase()}`;
const isAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

type PutBody = { address: string; profile: StoredProfile };

export async function POST(req: Request) {
  const body = (await req.json()) as PutBody;
  if (!isAddress(body?.address))
    return NextResponse.json({ error: 'profile needs a 0x wallet address' }, { status: 400 });
  const p = body.profile;
  if (
    !p ||
    typeof p.human !== 'string' ||
    typeof p.monthlyIncomeUsdc !== 'number' ||
    typeof p.protectedBudgetUsdc !== 'number' ||
    typeof p.hitoThresholdUsdc !== 'number' ||
    !Array.isArray(p.facts)
  )
    return NextResponse.json({ error: 'profile must be a full StoredProfile' }, { status: 400 });

  const key = brainKey(body.address);
  await getHbStorage().putJson(key, p);
  return NextResponse.json({ ok: true, key });
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get('address');
  if (!isAddress(address))
    return NextResponse.json({ error: 'address query param required' }, { status: 400 });
  const profile = await getHbStorage().getJsonOrNull<StoredProfile>(brainKey(address));
  if (!profile) return NextResponse.json({ error: 'no profile at that address yet' }, { status: 404 });
  return NextResponse.json({ profile });
}
