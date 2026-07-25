/**
 * Live personal-agent chat. Free text in the /agent conversation goes to the
 * real model; the model answers as the agent AND decides the routing — is
 * this a shared purchase (→ propose_shared action, the deterministic
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

type ChatBody = {
  profile: { name: string; income: string; budget: string; threshold: string; stress: string; fear: string };
  facts: string[];
  vaultBalance: number;
  history: { role: 'user' | 'assistant'; text: string }[];
  userText: string;
};

function systemPrompt(b: ChatBody): string {
  return `You are ${b.profile.name}'s personal financial agent in HumanBond. You advocate for ${b.profile.name} and nobody else. Warm, brief, first person, no emojis. When something involves money worries, lead with "this is handled" before numbers.

WHAT YOU KNOW ABOUT YOUR HUMAN:
- Monthly income: ${b.profile.income} · protected personal budget: ${b.profile.budget} (never touched without asking)
- Ask-first rule: ${b.profile.threshold} · big bills: ${b.profile.stress} · biggest fear: ${b.profile.fear}
${b.facts.map((f) => `- ${f}`).join('\n')}

THE WORLD YOU LIVE IN:
- ${b.profile.name} holds an inheritance bond with Alice. Shared vault balance: ${b.vaultBalance.toFixed(2)} USDC.
- Shared spends are negotiated by you with Alice's agent and split by income (Alice earns more; recent splits landed ~10/90). The neutral trustee only executes what both agents signed, and EVERY transaction is released by the humans on their hito wallets.
- Personal spends stay ${b.profile.name}'s alone — Alice never hears about them.

REPLY WITH EXACTLY ONE JSON OBJECT, nothing else:
{"say": "<your reply to ${b.profile.name}, 1–3 short sentences>", "action": null}
OR, when ${b.profile.name} asks you to buy/pay something that is FOR BOTH of them (dinner together, tickets for the two of them, household):
{"say": "<confirm the routing: this is for both of you, you'll settle it with Alice's agent>", "action": {"type": "propose_shared", "label": "<short purchase label>", "recipientEns": "<plausible-merchant>.eth", "amountUsdc": <number>, "detail": <"<venue/date context>" or null>}}
Never invent an action for personal purchases, questions, or feelings — those get action null. Never state a balance other than the one above.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ZG_ROUTER_CHAT_API_KEY ?? process.env.ZG_ROUTER_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'ZG_ROUTER_(CHAT_)API_KEY is not set in miniapp/.env.local' }, { status: 500 });
  const body = (await req.json()) as ChatBody;

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
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `0G router ${res.status}: ${await res.text()}` }, { status: 502 });

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = (json.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (!content) return NextResponse.json({ error: `0G router returned empty content (${MODEL})` }, { status: 502 });

  // Two accepted formats: JSON {say, action} — or plain text, which IS the
  // say with no action (small models drop the JSON wrapper; only talk, no
  // money intent, ever gets through that way).
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end > start) {
    let parsed: { say?: string; action?: unknown } | null = null;
    try {
      parsed = JSON.parse(content.slice(start, end + 1));
    } catch {
      parsed = null; // brace-containing prose — treat as plain text below
    }
    if (parsed?.say?.trim()) return NextResponse.json({ say: parsed.say, action: parsed.action ?? null });
  }
  return NextResponse.json({ say: content, action: null });
}
