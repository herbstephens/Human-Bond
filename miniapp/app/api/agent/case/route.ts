/**
 * The negotiation room — Option A (server-orchestrated).
 *
 * POST opens a case: load BOTH partners' profiles + the bond charter from the
 * shared store, run the real two-agent negotiation to a settlement, and persist
 * the whole room (thread + settlement) so both humans can open it and release.
 * GET lists a bond's cases for the bond page.
 *
 * Server-orchestrated so a decision settles even when the partner is offline;
 * each agent's turn still only ever sees its own private profile. The transport
 * swaps to the on-device 0G-KV bus later without touching this contract.
 */
import { NextResponse } from 'next/server';
import { getHbStorage } from '@/lib/agents/hbStorage.server';
import { llmCfgFromEnv, runCase, type NegParty } from '@/lib/agents/negotiationRun.server';
import { caseIndexKey, caseKey, type CaseRecord } from '@/lib/agents/case';
import type { PaymentRequest } from '@/lib/agents/runtime';
import type { AgentIdentity } from '@/lib/agents/protocol';
import type { StoredCharter, StoredProfile } from '@/lib/agents/storage';

const brainKey = (address: string) => `brain/${address.toLowerCase()}`;
const isAddress = (v: unknown): v is `0x${string}` => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);
const agentId = (human: string) => `agent-${human.toLowerCase().replace(/\s+/g, '-')}`;
const newCaseId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type Side = { address: string; id?: string };
type OpenBody = {
  bondId: string;
  request: { label: string; recipient: string; amountUsdc: number; kind?: PaymentRequest['kind']; aprPct?: number };
  a: Side;
  b: Side;
  situationNote?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as OpenBody;
  if (!body?.bondId || !isAddress(body?.a?.address) || !isAddress(body?.b?.address) || !body?.request?.label)
    return NextResponse.json({ error: 'case needs { bondId, request.label, a.address, b.address }' }, { status: 400 });
  if (typeof body.request.amountUsdc !== 'number' || body.request.amountUsdc <= 0)
    return NextResponse.json({ error: 'request.amountUsdc must be a positive number' }, { status: 400 });

  const store = getHbStorage();
  const [profileA, profileB] = await Promise.all([
    store.getJsonOrNull<StoredProfile>(brainKey(body.a.address)),
    store.getJsonOrNull<StoredProfile>(brainKey(body.b.address)),
  ]);
  if (!profileA || !profileB)
    return NextResponse.json(
      { error: 'both partners must publish their profile (POST /api/agent/profile) before a negotiation can open' },
      { status: 409 },
    );
  const charter = (await store.getJsonOrNull<StoredCharter>(`charter/${body.bondId}`)) ?? undefined;

  const idA: AgentIdentity = { id: body.a.id ?? agentId(profileA.human), human: profileA.human, address: body.a.address };
  const idB: AgentIdentity = { id: body.b.id ?? agentId(profileB.human), human: profileB.human, address: body.b.address };
  const partyA: NegParty = { identity: idA, profile: profileA };
  const partyB: NegParty = { identity: idB, profile: profileB };

  const request: PaymentRequest = {
    kind: body.request.kind ?? 'payment',
    bondId: body.bondId,
    label: body.request.label,
    recipient: body.request.recipient,
    amountUsdc: body.request.amountUsdc,
    aprPct: body.request.aprPct,
    requestedBy: idA.human,
  };

  const { transcript, settlement } = await runCase(llmCfgFromEnv(), partyA, partyB, charter, request, body.situationNote);

  const record: CaseRecord = {
    caseId: newCaseId(),
    bondId: body.bondId,
    request,
    status: 'negotiated',
    transcript,
    settlement,
    createdAt: Date.now(),
    releases: [],
  };
  await store.putJson(caseKey(record.bondId, record.caseId), record);
  await store.append(caseIndexKey(record.bondId), record.caseId);
  return NextResponse.json({ case: record });
}

export async function GET(req: Request) {
  const bondId = new URL(req.url).searchParams.get('bondId');
  if (!bondId) return NextResponse.json({ error: 'bondId query param required' }, { status: 400 });
  const store = getHbStorage();
  const ids = (await store.readLog(caseIndexKey(bondId))) as string[];
  const cases = (
    await Promise.all(ids.map((id) => store.getJsonOrNull<CaseRecord>(caseKey(bondId, id))))
  ).filter((c): c is CaseRecord => c !== null);
  // Newest first — the bond page shows the latest decision on top.
  cases.sort((x, y) => y.createdAt - x.createdAt);
  return NextResponse.json({ cases });
}
