/**
 * The bond's charter on the shared store — the rules both humans signed that
 * BIND every negotiation (split rule, joint hito threshold, heirs). Keyed by
 * bondId: `charter/<bondId>`.
 */
import { NextResponse } from 'next/server';
import { getHbStorage } from '@/lib/agents/hbStorage.server';
import type { StoredCharter } from '@/lib/agents/storage';

const charterKey = (bondId: string) => `charter/${bondId}`;

export async function POST(req: Request) {
  const c = (await req.json()) as StoredCharter;
  if (
    !c ||
    typeof c.bondId !== 'string' ||
    !Array.isArray(c.partners) ||
    c.partners.length !== 2 ||
    typeof c.jointHitoThresholdUsdc !== 'number'
  )
    return NextResponse.json({ error: 'charter must be a full StoredCharter' }, { status: 400 });

  await getHbStorage().putJson(charterKey(c.bondId), c);
  return NextResponse.json({ ok: true, key: charterKey(c.bondId) });
}

export async function GET(req: Request) {
  const bondId = new URL(req.url).searchParams.get('bondId');
  if (!bondId) return NextResponse.json({ error: 'bondId query param required' }, { status: 400 });
  const charter = await getHbStorage().getJsonOrNull<StoredCharter>(charterKey(bondId));
  if (!charter) return NextResponse.json({ error: 'no charter for that bond yet' }, { status: 404 });
  return NextResponse.json({ charter });
}
