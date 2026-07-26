/**
 * REAL two-agent negotiation — the thing the hackathon scripted but never wired.
 *
 * Two personal agents (each grounded ONLY in its own human's StoredProfile +
 * the shared charter) exchange live LLM turns via `negotiate()` until one
 * accepts the other's offer. The result is a real transcript and a settlement
 * whose `shares` are NEGOTIATED — income-derived, situation-dependent, varying
 * run to run — never the old hardcoded 10/90.
 *
 * This is the server-orchestrated form: one request runs both agents, so a
 * negotiation completes even when the partner isn't online. Each turn's prompt
 * only ever carries ONE human's private profile — the agents exchange messages,
 * never raw profiles. The cross-browser 0G-KV transport (kvBus.ts) is the same
 * driver + protocol, swapped in later for full profile locality.
 */
import { NextResponse } from 'next/server';
import { negotiate, type PaymentRequest } from '@/lib/agents/runtime';
import { LlmDriver, type LlmConfig } from '@/lib/agents/llmDriver';
import { personalSystemPrompt } from '@/lib/agents/prompts';
import type { AgentIdentity } from '@/lib/agents/protocol';
import type { StoredCharter, StoredProfile } from '@/lib/agents/storage';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

type Party = {
  /** Agent id used as the key in settlement.shares, e.g. "agent-ben". */
  id?: string;
  /** The activated agent address (only needed later for signing); optional here. */
  address?: `0x${string}`;
  profile: StoredProfile;
};

type NegotiateBody = {
  request: Omit<PaymentRequest, 'kind'> & { kind?: PaymentRequest['kind'] };
  charter?: StoredCharter | null;
  a: Party;
  b: Party;
  /** e.g. "your human said they feel bad about the last split" — reopens leverage. */
  situationNote?: string;
};

function identityOf(p: Party): AgentIdentity {
  return {
    id: p.id ?? `agent-${p.profile.human.toLowerCase().replace(/\s+/g, '-')}`,
    human: p.profile.human,
    address: p.address ?? ZERO,
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.ZG_ROUTER_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'ZG_ROUTER_API_KEY is not set in miniapp/.env.local' }, { status: 500 });

  const body = (await req.json()) as NegotiateBody;
  if (!body?.a?.profile || !body?.b?.profile || !body?.request)
    return NextResponse.json({ error: 'negotiate needs { request, a.profile, b.profile }' }, { status: 400 });

  const cfg: LlmConfig = {
    apiKey,
    baseUrl: process.env.ZG_ROUTER_BASE_URL,
    // The engine's own note: 'zai-org/GLM-5-FP8' does not exist on the router;
    // the GLM family is glm-5 / glm-5.1 / glm-5.2. Overridable per deployment.
    model: process.env.ZG_ROUTER_NEGOTIATE_MODEL ?? 'glm-5.2',
    temperature: 0.4,
  };

  const idA = identityOf(body.a);
  const idB = identityOf(body.b);
  const charter = body.charter ?? undefined;

  const request: PaymentRequest = {
    kind: body.request.kind ?? 'payment',
    bondId: body.request.bondId,
    label: body.request.label,
    recipient: body.request.recipient,
    amountUsdc: body.request.amountUsdc,
    aprPct: body.request.aprPct,
    swap: body.request.swap,
    requestedBy: body.request.requestedBy,
  };

  const partyA = {
    identity: idA,
    profile: body.a.profile,
    driver: new LlmDriver(cfg, personalSystemPrompt(body.a.profile, idB.human, charter), body.situationNote),
  };
  const partyB = {
    identity: idB,
    profile: body.b.profile,
    driver: new LlmDriver(cfg, personalSystemPrompt(body.b.profile, idA.human, charter)),
  };

  const { transcript, settlement } = await negotiate(partyA, partyB, request);
  return NextResponse.json({
    transcript,
    settlement,
    // Convenience: human-readable split derived from the negotiated shares.
    split: Object.fromEntries(
      Object.entries(settlement.shares).map(([id, usdc]) => [
        id,
        { usdc, pct: Math.round((usdc / settlement.amountUsdc) * 1000) / 10 },
      ]),
    ),
  });
}
