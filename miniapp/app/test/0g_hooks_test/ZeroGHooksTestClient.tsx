'use client';

import { useState } from 'react';
import { AliveCta } from '@/app/components/agent/AliveCta';

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

type ChatResult = {
  say: string;
  action: AgentAction | null;
};

type TestState = 'idle' | 'calling' | 'complete' | 'failed';

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    const parsed = JSON.parse(text) as { error?: string };
    throw new Error(parsed.error ?? `Request failed with HTTP ${response.status}`);
  }
  return JSON.parse(text) as T;
}

export function ZeroGHooksTestClient() {
  const [state, setState] = useState<TestState>('idle');
  const [result, setResult] = useState<ChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const log = (message: string) =>
    setEvents((current) => [...current, `${new Date().toLocaleTimeString()} - ${message}`]);

  const run = async () => {
    setState('calling');
    setResult(null);
    setError(null);
    setEvents([]);
    log('Sending shared-spend prompt to /api/agent/chat');

    try {
      const completed = await responseJson<ChatResult>(
        await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              name: 'Ben',
              income: 'EUR 4k+',
              budget: 'EUR 500',
              threshold: 'Over EUR 200',
              stress: 'Stress, instantly',
              fear: 'No emergency buffer',
            },
            facts: ['Cash flow is tight this month.'],
            rules: ['Shared dinners for both partners can be paid from the shared vault.'],
            bonds: [
              {
                id: 'alice',
                partner: 'Alice',
                type: 'inheritance',
                isDefault: true,
                vaultBalanceUsdc: 1000,
              },
            ],
            history: [],
            userText: 'Pay 42 USDC to ramiro.eth for dinner for us tonight.',
          }),
        }),
      );

      setResult(completed);
      if (completed.action?.type !== 'propose_spend') {
        throw new Error(`Expected propose_spend, got ${completed.action?.type ?? 'no action'}`);
      }
      log('propose_spend action returned by the chat route');
      setState('complete');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '0G hook test failed';
      setError(message);
      log(`FAILED: ${message}`);
      setState('failed');
    }
  };

  return (
    <main className="min-h-screen bg-[#171512] px-5 py-12 text-[#f3eadb]">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development test
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">0G chat tool hook</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          Calls the personal agent chat route with one shared dinner request.
        </p>

        <AliveCta
          onClick={run}
          disabled={state === 'calling'}
          className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
        >
          {state === 'calling' ? 'Calling 0G router' : 'Trigger propose_spend'}
        </AliveCta>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Status
            </span>
            <span className="font-mono text-xs text-amber-300">{state}</span>
          </div>

          {error && <p className="mt-5 break-words text-sm text-red-400">{error}</p>}

          {result && (
            <div className="mt-5 space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                  Agent said
                </p>
                <p className="mt-1 text-sm leading-6 text-[#f3eadb]">{result.say}</p>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                  Action
                </p>
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/30 p-4 font-mono text-xs text-[#b9ad9b]">
                  {JSON.stringify(result.action, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <ol className="mt-6 space-y-2 border-t border-white/10 pt-5">
            {events.length === 0 ? (
              <li className="font-mono text-xs text-[#6f665a]">No test started.</li>
            ) : (
              events.map((event, index) => (
                <li key={`${index}-${event}`} className="font-mono text-xs text-[#b9ad9b]">
                  {event}
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
    </main>
  );
}
