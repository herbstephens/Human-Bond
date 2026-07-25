/**
 * Live onboarding voice — the agent's words during creation come from a real
 * model, not canned strings. The interview STRUCTURE stays deterministic
 * (fixed questions, chips); this route only generates the agent's phrasing:
 *
 *   mode 'react'   → one short message: react to the latest answer, ask the
 *                    next question in the agent's own words
 *   mode 'summary' → the profile-mirror card: 4 lines proving the agent
 *                    actually knows this human
 *
 * The router key stays server-side. Fast non-reasoning model by default —
 * onboarding needs chat latency, not chain-of-thought.
 */
import { NextResponse } from 'next/server';

const BASE_URL = process.env.ZG_ROUTER_BASE_URL ?? 'https://router-api.0g.ai/v1';

type HistoryItem = { question: string; answer: string };
type OnboardBody = {
  mode: 'react' | 'summary';
  imported: string[];
  history: HistoryItem[];
  /** For 'react': the next interview question (intent + chips) the agent must ask. */
  next?: { intent: string; options: string[] };
};

function reactMessages(body: OnboardBody) {
  const importedNote = body.imported.length
    ? `You already imported their public self from ${body.imported.join(', ')}: Ben, Product Lead in Lisbon, employed, roughly €4k+/month, careful planner who hates surprises.`
    : 'They skipped the import — everything you know comes from this conversation.';
  return [
    {
      role: 'system',
      content: `You are a personal financial agent being born, interviewing your future human. Warm, brief, first person. No emojis, no lists, no exclamation marks. ${importedNote}
${
  body.history.length === 0
    ? 'No answers yet: open the interview with the first question in your own words — one short sentence.'
    : 'First react to their LATEST answer in one short sentence that is specific to what they said (never generic praise), then ask the next question naturally.'
}
Your next question must gather exactly this: "${body.next?.intent}" (their quick-answer chips will be: ${body.next?.options.join(' / ')} — do not read the chips out loud).
Output plain text only. Maximum 40 words.`,
    },
    { role: 'user', content: JSON.stringify({ interviewSoFar: body.history }) },
  ];
}

function summaryMessages(body: OnboardBody) {
  return [
    {
      role: 'system',
      content: `You are this human's newborn personal financial agent writing your profile mirror — proof that you know them. Based on their interview answers, return ONLY a JSON array of exactly 4 strings, nothing else:
1. their income and the personal budget you will protect
2. how you will handle big bills, matched to how they said they react
3. their biggest money fear and what you will do about it
4. the ask-me-first rule they gave you
Each line: first person ("I will…" / "You …"), maximum 22 words, no emojis. Where they typed a custom answer, quote their own words.`,
    },
    { role: 'user', content: JSON.stringify({ imported: body.imported, interview: body.history }) },
  ];
}

export async function POST(req: Request) {
  const apiKey = process.env.ZG_ROUTER_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: 'ZG_ROUTER_API_KEY is not set in miniapp/.env.local' }, { status: 500 });

  const body = (await req.json()) as OnboardBody;
  const model = process.env.ZG_ROUTER_MODEL_FAST ?? 'deepseek-v4-flash';
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: body.mode === 'summary' ? summaryMessages(body) : reactMessages(body),
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `0G router ${res.status}: ${await res.text()}` }, { status: 502 });

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = (json.choices?.[0]?.message?.content ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
  if (!content)
    return NextResponse.json({ error: `0G router returned empty content (model ${model})` }, { status: 502 });

  if (body.mode === 'summary') {
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    if (start === -1 || end <= start)
      return NextResponse.json({ error: `No JSON array in model output: ${content.slice(0, 200)}` }, { status: 502 });
    const lines = JSON.parse(content.slice(start, end + 1)) as string[];
    return NextResponse.json({ lines });
  }
  return NextResponse.json({ text: content });
}
