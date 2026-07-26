/**
 * The real negotiation brain: an AgentDriver backed by 0G's model router
 * (OpenAI-compatible chat completions, TEE-hosted models).
 *
 * The LLM only ever produces AgentTurn JSON — say / offer / acceptOffer.
 * Everything with teeth (signing, verification, execution, thresholds) stays
 * in the deterministic protocol layer. A hallucinating model can talk
 * nonsense; it cannot move money.
 */
import type { AgentDriver, AgentTurn, NegotiationContext } from './runtime';

export type LlmConfig = {
  apiKey: string;
  /** 0G router default; any OpenAI-compatible endpoint works. */
  baseUrl?: string;
  model?: string;
  temperature?: number;
};

const DEFAULT_BASE_URL = 'https://router-api.0g.ai/v1';
/** Router model ids come from GET /v1/models — 'zai-org/GLM-5-FP8' from older
 *  docs does NOT exist there; the GLM family is 'glm-5' / 'glm-5.1' / 'glm-5.2'. */
const DEFAULT_MODEL = 'glm-5.2';

const INTERFACE_BLOCK = `
NEGOTIATION INTERFACE — you are in a live agent-to-agent negotiation.
Reply with EXACTLY ONE JSON object and nothing else:
{
  "say": "<one short message to the other agent, max 2 sentences>",
  "offer": { "shares": { "<agentId>": <USDC number>, ... }, "rationale": "<short>" },
  "acceptOffer": true
}
- "say" is always required.
- Include "offer" only when you put new terms on the table. Shares must cover BOTH agent ids and sum exactly to the amount.
- Include "acceptOffer": true only to accept the PEER's current offer (never your own).
- If the offer on the table already serves your human's interests, accept it — do not renegotiate for sport. Settle within a few turns.`;

async function chat(cfg: LlmConfig, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(`${cfg.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model ?? DEFAULT_MODEL,
      temperature: cfg.temperature ?? 0.3,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`0G router ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`0G router returned no content: ${JSON.stringify(json).slice(0, 400)}`);
  return content;
}

/** Reasoning models wrap answers in <think> blocks or prose — dig out the JSON object. */
function extractTurn(raw: string): AgentTurn {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`No JSON object in model output: ${raw.slice(0, 400)}`);
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as AgentTurn;
  if (typeof parsed.say !== 'string' || !parsed.say.trim())
    throw new Error(`Model turn is missing "say": ${cleaned.slice(start, end + 1)}`);
  return parsed;
}

function validateTurn(turn: AgentTurn, ctx: NegotiationContext): void {
  if (turn.offer) {
    const ids = Object.keys(turn.offer.shares).sort();
    const expected = [ctx.self.id, ctx.peer.id].sort();
    if (ids.join() !== expected.join())
      throw new Error(`Offer shares must cover exactly [${expected.join(', ')}], got [${ids.join(', ')}].`);
    const sum = Object.values(turn.offer.shares).reduce((a, v) => a + v, 0);
    if (Math.abs(sum - ctx.request.amountUsdc) > 0.005)
      throw new Error(`Offer shares sum to ${sum.toFixed(2)}, the amount is ${ctx.request.amountUsdc.toFixed(2)}.`);
  }
  if (turn.acceptOffer && (!ctx.currentOffer || ctx.currentOffer.by === ctx.self.id))
    throw new Error('acceptOffer is only valid on a peer offer currently on the table.');
}

export class LlmDriver implements AgentDriver {
  constructor(
    private cfg: LlmConfig,
    /** Rendered personal system prompt (prompts.ts) — the agent's identity. */
    private systemPrompt: string,
    /** Extra situation context, e.g. "your human said they feel bad about the last split". */
    private situationNote?: string,
  ) {}

  async next(ctx: NegotiationContext): Promise<AgentTurn> {
    const state = {
      you: ctx.self.id,
      peer: ctx.peer.id,
      request: {
        label: ctx.request.label,
        recipient: ctx.request.recipient,
        amountUsdc: ctx.request.amountUsdc,
        kind: ctx.request.kind,
      },
      transcriptSoFar: ctx.transcript.map((m) => ({ from: m.from, text: m.text })),
      offerOnTable: ctx.currentOffer,
    };
    const messages = [
      { role: 'system', content: this.systemPrompt + '\n' + INTERFACE_BLOCK },
      ...(this.situationNote ? [{ role: 'system', content: `SITUATION: ${this.situationNote}` }] : []),
      { role: 'user', content: JSON.stringify(state) },
    ];

    // One corrective retry with the validation error fed back; then fail hard.
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await chat(this.cfg, lastError
        ? [...messages, { role: 'user', content: `Your previous reply was invalid: ${lastError.message} Reply again with one valid JSON object.` }]
        : messages);
      let turn: AgentTurn;
      try {
        turn = extractTurn(raw);
        validateTurn(turn, ctx);
      } catch (e) {
        lastError = e as Error;
        continue;
      }
      return turn;
    }
    throw new Error(`LLM produced no valid turn for ${ctx.self.id} after 2 attempts: ${lastError?.message}`);
  }
}
