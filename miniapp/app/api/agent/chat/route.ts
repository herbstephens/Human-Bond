/**
 * Live personal-agent chat. Free text in the /agent conversation goes to the
 * real model; the model answers as the agent AND decides the routing — is
 * this a shared purchase (→ propose_spend tool call, the deterministic
 * choreography takes over) or just conversation?
 *
 * Chat = model. Money = protocol. The model can only TALK and flag intent;
 * every payment still walks through proposal → dual agreement → hito.
 *
 * ZG_ROUTER_CHAT_* overrides let chat run on a different router/model than
 * the negotiations (e.g. while mainnet balance is pending).
 */
import { NextResponse } from 'next/server';

const BASE_URL =
  process.env.ZG_ROUTER_CHAT_BASE_URL ?? process.env.ZG_ROUTER_BASE_URL ?? 'https://router-api.0g.ai/v1';
const MODEL = process.env.ZG_ROUTER_CHAT_MODEL ?? process.env.ZG_ROUTER_MODEL ?? 'zai-org/GLM-5-FP8';
const DEBUG_AGENT_TOOLS = process.env.NODE_ENV !== 'production' || process.env.ZG_AGENT_DEBUG === '1';

function debugAgentTool(message: string, data?: unknown): void {
  if (!DEBUG_AGENT_TOOLS) return;
  if (data === undefined) {
    console.info(`[agent-tools] ${message}`);
    return;
  }
  console.info(`[agent-tools] ${message}`, data);
}

function isConcreteSharedSpendRequest(userText: string): boolean {
  const text = userText.toLowerCase();
  return /\b(pay|send|transfer|buy|purchase|spend)\b/.test(text) &&
    /\b(for us|together|shared|our|partner|dinner|tickets)\b/.test(text);
}

type ChatBody = {
  profile: { name: string; income: string; budget: string; threshold: string; stress: string; fear: string };
  facts: string[];
  /** Custom rules the couple wrote into the charter — binding context. */
  rules?: string[];
  /** Every active bond the human holds — the agent routes shared spends to the fitting one. */
  bonds: { id: string; partner: string; type: string; isDefault: boolean; vaultBalanceUsdc: number }[];
  history: { role: 'user' | 'assistant'; text: string }[];
  userText: string;
};

type AgentAction =
  | {
      type: 'propose_spend';
      bondId: string;
      label: string;
      recipient: string;
      amountUsdc: number;
      detail: string | null;
    }
  | {
      type: 'cancel_spend';
      spendId: `0x${string}`;
      reason: string;
    };

type ToolCall = {
  function: {
    name: string;
    arguments: string;
  };
};

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_spend',
      description:
        'Create a shared-vault USDC spend proposal for human review. Always use this for a concrete shared payment, including amounts at or below 10 USDC. After the human approves, the vault contract may execute a spend immediately when it is within the small-spend and daily-free limits; the agent itself never signs or executes.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          bondId: {
            type: 'string',
            description: 'The exact id of the active bond whose shared vault should fund the spend.',
          },
          label: {
            type: 'string',
            description: 'A short human-readable purchase label.',
          },
          recipient: {
            type: 'string',
            description: 'The recipient ENS name or 0x-prefixed EVM address.',
          },
          amountUsdc: {
            type: 'number',
            description: 'The positive USDC amount to propose.',
          },
          detail: {
            type: ['string', 'null'],
            description: 'Optional venue, date, or payment context.',
          },
        },
        required: ['bondId', 'label', 'recipient', 'amountUsdc', 'detail'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_spend',
      description:
        'Draft cancellation of an existing pending shared-vault spend for human review.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          spendId: {
            type: 'string',
            description: 'The pending spend identifier as a 32-byte 0x-prefixed hex string.',
            pattern: '^0x[a-fA-F0-9]{64}$',
          },
          reason: {
            type: 'string',
            description: 'A short explanation for cancelling the spend.',
          },
        },
        required: ['spendId', 'reason'],
      },
    },
  },
] as const;

function systemPrompt(b: ChatBody): string {
  return `You are ${b.profile.name}'s personal financial agent in HumanBond. You advocate for ${b.profile.name} and nobody else. Warm, brief, first person, no emojis. Always answer the CONCRETE message — never a stock phrase, and never repeat a sentence you already used in this conversation.

WHAT YOU KNOW ABOUT YOUR HUMAN:
- Monthly income: ${b.profile.income} · protected personal budget: ${b.profile.budget} (never touched without asking)
- Ask-first rule: ${b.profile.threshold} · big bills: ${b.profile.stress} · biggest fear: ${b.profile.fear}
${b.facts.map((f) => `- ${f}`).join('\n')}

THE WORLD YOU LIVE IN:
- ${b.profile.name}'s bonds — each one has its OWN partner agent, its OWN funded shared vault, its OWN bond manager:
${b.bonds.map((bd) => `  - bondId "${bd.id}": ${bd.type} bond with ${bd.partner} — vault ${bd.vaultBalanceUsdc.toFixed(2)} USDC${bd.isDefault ? ' (DEFAULT)' : ''}`).join('\n')}
- Personal or shared is decided in THIS conversation with ${b.profile.name}. When shared, pick the bond that fits the situation (household/family → the partner bond it belongs to; work → a business bond). Only one bond, or unclear → the DEFAULT bond.
- A shared spend is paid straight FROM that bond's vault balance. Money is NEVER pulled from anyone's personal wallet for it, and a payment is never split across personal accounts. Income splits are pure bookkeeping attribution between the two humans — never separate transfers.
- You never sign or execute anything yourself. For every concrete shared payment request, you MUST call propose_spend, including requests at or below 10 USDC. The human approval in the chat is the authority boundary; after approval, the vault contract may execute a small spend immediately when its configured per-spend and daily-free limits allow it.
- For amounts above the small-spend threshold, the proposal continues through partner-agent agreement, trustee execution, and the required human release flow. Small spends are the explicit contract-level exception: one partner proposal can execute immediately when the daily-free allowance also permits it.
- For a small shared payment, do not reply with a generic refusal such as "I can't execute payments" and do not merely promise to register it. Call propose_spend now, then explain that it is ready for the human's approval.
- Never propose more than that bond's vault balance.
- Personal spends stay ${b.profile.name}'s alone — no partner ever hears about them.
${b.rules?.length ? `\nRULES YOU TWO WROTE INTO THE CHARTER (binding — follow them over everything else):\n${b.rules.map((r) => `- ${r}`).join('\n')}` : ''}

Answer ${b.profile.name} in 1–3 short sentences. When they ask to buy or pay for something SHARED ("for us", dinner together, tickets for two, or anything for a bond's household or business), call propose_spend with the exact bondId from the list above. If no amount is given, estimate a realistic one. If your previous message said you would settle something with a partner agent and the human now confirms (yes / do it / go), call propose_spend for exactly that request. When they explicitly ask to cancel a known pending spend and provide its spend ID, call cancel_spend.

Never call a tool for personal purchases, questions, feelings, or vague cancellation requests. A propose_spend tool call creates the approval step; it never authorizes the payment by itself. Never state a vault balance other than the ones above.`;
}

function actionFromToolCall(call: ToolCall): AgentAction | null {
  const args: unknown = JSON.parse(call.function.arguments);
  if (!args || typeof args !== 'object') throw new Error(`${call.function.name} returned invalid arguments`);
  const value = args as Record<string, unknown>;

  if (call.function.name === 'propose_spend') {
    if (
      typeof value.bondId !== 'string' ||
      typeof value.label !== 'string' ||
      typeof value.recipient !== 'string' ||
      typeof value.amountUsdc !== 'number' ||
      value.amountUsdc <= 0 ||
      (typeof value.detail !== 'string' && value.detail !== null)
    ) {
      throw new Error('propose_spend returned invalid arguments');
    }
    return {
      type: 'propose_spend',
      bondId: value.bondId,
      label: value.label,
      recipient: value.recipient,
      amountUsdc: value.amountUsdc,
      detail: value.detail,
    };
  }

  if (call.function.name === 'cancel_spend') {
    if (
      typeof value.spendId !== 'string' ||
      !/^0x[a-fA-F0-9]{64}$/.test(value.spendId) ||
      typeof value.reason !== 'string'
    ) {
      throw new Error('cancel_spend returned invalid arguments');
    }
    return {
      type: 'cancel_spend',
      spendId: value.spendId as `0x${string}`,
      reason: value.reason,
    };
  }

  throw new Error(`0G router returned unknown tool: ${call.function.name}`);
}

export async function POST(req: Request) {
  const apiKey = process.env.ZG_ROUTER_CHAT_API_KEY ?? process.env.ZG_ROUTER_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'ZG_ROUTER_(CHAT_)API_KEY is not set in miniapp/.env.local' }, { status: 500 });
  const body = (await req.json()) as ChatBody;
  const sharedSpendRequest = isConcreteSharedSpendRequest(body.userText);
  debugAgentTool('sending chat request to 0G', {
    model: MODEL,
    historyMessages: body.history.length,
    availableTools: AGENT_TOOLS.map((tool) => tool.function.name),
    sharedSpendRequest,
  });

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt(body) },
        ...body.history.map((m) => ({ role: m.role, content: m.text })),
        { role: 'user', content: body.userText },
      ],
      tools: AGENT_TOOLS,
      tool_choice: sharedSpendRequest
        ? { type: 'function', function: { name: 'propose_spend' } }
        : 'auto',
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `0G router ${res.status}: ${await res.text()}` }, { status: 502 });

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  };
  const message = json.choices?.[0]?.message;
  if (!message) return NextResponse.json({ error: `0G router returned no message (${MODEL})` }, { status: 502 });

  const content = (message.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const calls = message.tool_calls ?? [];
  debugAgentTool('received 0G response', {
    toolCalls: calls.map((call) => ({
      name: call.function.name,
      arguments: call.function.arguments,
    })),
    hasText: content.length > 0,
    trace: (json as { x_0g_trace?: unknown }).x_0g_trace,
  });
  if (calls.length > 1) {
    return NextResponse.json({ error: 'The agent returned more than one vault action' }, { status: 502 });
  }

  const action = calls.length === 1 ? actionFromToolCall(calls[0]) : null;
  debugAgentTool(action ? `normalized ${action.type}` : 'no tool call selected', action);
  if (action?.type === 'propose_spend') {
    console.info('[agent-tools] propose_spend activated', {
      model: MODEL,
      bondId: action.bondId,
      label: action.label,
      recipient: action.recipient,
      amountUsdc: action.amountUsdc,
      detail: action.detail,
    });
  }
  if (!content && !action) {
    return NextResponse.json({ error: `0G router returned an empty response (${MODEL})` }, { status: 502 });
  }

  const say =
    content ||
    (action?.type === 'propose_spend'
      ? `I’ll settle ${action.label} with the partner agent and prepare it for your review.`
      : `I’ll prepare that cancellation for your review.`);

  return NextResponse.json({ say, action });
}
