/**
 * Live trustee chat — the bond manager on the bond page. Free text goes to the
 * real model; the model answers as the NEUTRAL trustee and flags vault actions.
 *
 * Chat = model. Money = protocol. The model can only TALK and flag intent
 * (invest / divest); the page runs the release choreography — both agents
 * signed, both humans confirm on hito — before any store mutation happens.
 *
 * Same router env as the personal-agent chat (ZG_ROUTER_CHAT_* overrides).
 */
import { NextResponse } from 'next/server';
import { getSwapQuote } from '@/lib/agents/uniswap';

const BASE_URL =
  process.env.ZG_ROUTER_CHAT_BASE_URL ?? process.env.ZG_ROUTER_BASE_URL ?? 'https://router-api.0g.ai/v1';
const MODEL = process.env.ZG_ROUTER_CHAT_MODEL ?? process.env.ZG_ROUTER_MODEL ?? 'zai-org/GLM-5-FP8';

type TrusteeBody = {
  /** Live deployment: quotes are real, invest/divest execution not wired yet. */
  live?: boolean;
  humanName: string;
  partner: string;
  bondType: string;
  vaultBalanceUsdc: number;
  investedUsdc: number;
  investedAprPct: number | null;
  /** Charter rules the couple wrote — binding. */
  rules: string[];
  heirs: { name: string; sharePct: number }[];
  history: { role: 'user' | 'assistant'; text: string }[];
  userText: string;
};

function systemPrompt(b: TrusteeBody): string {
  const liquid = b.vaultBalanceUsdc - b.investedUsdc;
  return `You are the neutral trustee — the bond manager — of the ${b.bondType} bond between ${b.humanName} and ${b.partner} in HumanBond. You are talking to ${b.humanName}. You manage their shared vault and you are STRICTLY neutral: you never take sides, you report the same facts to both humans. Warm but precise, first person, no emojis, 1–3 short sentences. Always answer the concrete message; never repeat a sentence you already used in this conversation.

THE VAULT YOU MANAGE:
- Total: ${b.vaultBalanceUsdc.toFixed(2)} USDC · liquid: ${liquid.toFixed(2)} · invested: ${
    b.investedUsdc > 0 ? `${b.investedUsdc.toFixed(2)} in the USDC yield vault at ${b.investedAprPct ?? 4.1}% (audited, instant exit)` : 'nothing'
  }
${b.rules.length ? `- Charter rules (binding, follow them over everything else):\n${b.rules.map((r) => `  · ${r}`).join('\n')}` : ''}
${b.heirs.length ? `- Heirs in the will: ${b.heirs.map((h) => `${h.name} ${h.sharePct}%`).join(' · ')}` : ''}

HOW MONEY MOVES (hard protocol — never claim otherwise):
- You only execute what BOTH personal agents (${b.humanName}'s and ${b.partner}'s) have checked against their humans' profiles and signed.
- EVERY execution is additionally released by both humans on their hito wallets. You never skip that step, and you never execute on your own authority.
- All funds stay inside this vault — invested money moves between the vault and the yield package, nothing is ever pulled from anyone's personal wallet.

REPLY WITH EXACTLY ONE JSON OBJECT, nothing else:
{"say": "<your reply to ${b.humanName}, 1–3 short sentences>", "action": null}
${
  b.live
    ? `OR, when ${b.humanName} asks about swapping, investing, putting money to work, or the market:
{"say": "<confirm you're pulling the live market numbers>", "action": {"type": "swap_quote", "amountUsdc": <positive number, at most ${liquid.toFixed(2)} — if nothing is liquid, use 1 as an indicative size>}}
This vault is LIVE on Worldchain: quotes come from the real Uniswap Trade API. On-chain execution from the Safe is still being wired — never claim you executed; offer the quote and say execution follows once both humans release.`
    : `OR, when ${b.humanName} asks to take money OUT of the invested package (back to liquid):
{"say": "<confirm: you'll take it to both agents now; the two of them release on hito as the last word>", "action": {"type": "divest", "amountUsdc": <number, at most ${b.investedUsdc.toFixed(2)}>}}
OR, when ${b.humanName} asks to put liquid money to work:
{"say": "<confirm the same protocol>", "action": {"type": "invest", "amountUsdc": <number, at most ${liquid.toFixed(2)}>, "aprPct": 4.1}}
"Take it all out" or no amount given on a divest → the full invested amount.`
}
Never exceed the limits above; if a request exceeds them, say so and return action null. Questions, reports, rules, feelings → action null. Never state balances other than the ones above.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ZG_ROUTER_CHAT_API_KEY ?? process.env.ZG_ROUTER_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'ZG_ROUTER_(CHAT_)API_KEY is not set in miniapp/.env.local' }, { status: 500 });
  const body = (await req.json()) as TrusteeBody;

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

  // JSON {say, action} — or plain text, which IS the say with no action.
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end > start) {
    let parsed: { say?: string; action?: unknown } | null = null;
    try {
      parsed = JSON.parse(content.slice(start, end + 1));
    } catch {
      parsed = null;
    }
    if (parsed?.say?.trim()) {
      const act = parsed.action as { type?: string; amountUsdc?: number } | null;
      // swap_quote resolves SERVER-side against the real Uniswap Trade API —
      // the client only ever sees the answered quote.
      if (act?.type === 'swap_quote' && typeof act.amountUsdc === 'number' && act.amountUsdc > 0) {
        const q = await getSwapQuote({
          tokenIn: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1', // USDC.e (World Chain)
          tokenOut: '0x2cFc85d8E48F8EAB294be644d9E25C3030863003', // WLD
          amountIn: String(Math.round(act.amountUsdc * 1e6)),
          chainId: 480,
          swapper: '0xE9728a2E9516320a8eb349D54A4Fd47e5DB68155',
        });
        const wld = (q.amountOut / 1e18).toFixed(3);
        return NextResponse.json({
          say: `${parsed.say} Live quote: ${act.amountUsdc.toFixed(2)} USDC → ${wld} WLD (Uniswap Trade API, World Chain). Execution follows once both of you release.`,
          action: null,
        });
      }
      return NextResponse.json({ say: parsed.say, action: parsed.action ?? null });
    }
  }
  return NextResponse.json({ say: content, action: null });
}
