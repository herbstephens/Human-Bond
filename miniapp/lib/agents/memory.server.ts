/**
 * Agent memory — the distillation step that lets agents get to know each other.
 *
 * After a case settles we keep the raw transcript (audit) AND distill it into:
 *   - a SHARED bond memo (patterns both agents may see)
 *   - each agent's PRIVATE partner-model (what it learned about the peer's style
 *     and red lines — leverage, never shared with the peer)
 * These are small enough to inject into the next negotiation's prompt, so the
 * agents open from what they've learned instead of cold. Raw stays for audit
 * and re-distillation; a vector layer can come later if history outgrows a memo.
 */
import type { LlmConfig } from './llmDriver';
import type { NegotiationTranscript, Settlement } from './protocol';

const DEFAULT_BASE_URL = 'https://router-api.0g.ai/v1';

export type DistillInput = {
  humanA: string;
  humanB: string;
  priorBondMemo: string;
  /** A's prior private notes about B. */
  priorModelAboutB: string;
  /** B's prior private notes about A. */
  priorModelAboutA: string;
  transcript: NegotiationTranscript;
  settlement: Settlement;
  label: string;
  amountUsdc: number;
};

export type DistillOutput = { bondMemo: string; modelAboutB: string; modelAboutA: string };

async function chatJson(cfg: LlmConfig, system: string, user: string): Promise<string> {
  const res = await fetch(`${cfg.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model ?? 'glm-5.2',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`0G router ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('memory distill: router returned no content');
  return content;
}

function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`memory distill: no JSON object in: ${raw.slice(0, 300)}`);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

const SYSTEM = `You maintain the memory of a two-agent partnership after each shared-money negotiation. You update three memories and return them SHORTER than you received, not longer — merge, generalize, drop one-off noise, keep only what changes how the NEXT negotiation opens.

Return EXACTLY ONE JSON object, nothing else:
{
  "bondMemo": "<shared: recurring patterns BOTH agents may see — how they split, standing agreements, off-limits funds. Max 4 short lines, '·'-separated. Neutral, no private leverage.>",
  "modelAboutB": "<PRIVATE to A: what A learned about how B negotiates — style, concessions, red lines. Max 3 short phrases.>",
  "modelAboutA": "<PRIVATE to B: same, about A. Max 3 short phrases.>"
}
Empty strings are fine when there is nothing worth keeping. Never invent facts not supported by the conversation.`;

export async function distillCase(cfg: LlmConfig, i: DistillInput): Promise<DistillOutput> {
  const user = JSON.stringify({
    agents: { A: i.humanA, B: i.humanB },
    priorMemory: { bondMemo: i.priorBondMemo, modelAboutB: i.priorModelAboutB, modelAboutA: i.priorModelAboutA },
    latestNegotiation: {
      about: i.label,
      amountUsdc: i.amountUsdc,
      finalShares: i.settlement.shares,
      memo: i.settlement.memo,
      messages: i.transcript.messages.map((m) => ({ from: m.from, text: m.text })),
    },
  });
  const out = extractJson<Partial<DistillOutput>>(await chatJson(cfg, SYSTEM, user));
  return {
    bondMemo: (out.bondMemo ?? i.priorBondMemo ?? '').trim(),
    modelAboutB: (out.modelAboutB ?? i.priorModelAboutB ?? '').trim(),
    modelAboutA: (out.modelAboutA ?? i.priorModelAboutA ?? '').trim(),
  };
}
