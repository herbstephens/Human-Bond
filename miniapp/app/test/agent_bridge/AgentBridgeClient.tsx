'use client';

/**
 * Register an agent in AgentKit's GLOBAL AgentBook — from inside World App.
 *
 * Two facts shaped this screen, both learned the hard way:
 *
 * 1. AgentBook's EXTERNAL_NULLIFIER_HASH is immutable, bound to AgentKit's own
 *    app. MiniKit can only mint proofs under the app the mini app was opened as,
 *    so its proofs always fail with ProofInvalid(). The World ID *bridge* takes
 *    an explicit app_id, so it can target AgentKit's app. That is why we are here.
 *
 * 2. World App does NOT show its verification sheet on top of a mini app — it
 *    queues it in the main UI, so the human must CLOSE the mini app to accept.
 *    Any polling living in this page dies at that moment.
 *
 * So this page owns almost nothing: the server holds the bridge session, polls
 * it, and registers. Here we only kick it off, hand over the link, and remember
 * the session id in localStorage so reopening the mini app reattaches to work
 * that continued without us.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AliveCta } from '@/app/components/agent/AliveCta';

type StartResult = {
  sessionId: string;
  agentAddress: `0x${string}`;
  connectorURI: string;
  appId: string;
  action: string;
};

type Status = {
  phase: 'awaiting_connection' | 'awaiting_app' | 'registering' | 'complete' | 'failed';
  agentAddress: `0x${string}`;
  polls: number;
  txHash: string | null;
  error: string | null;
  events: string[];
};

const SESSION_KEY = 'hb-activation-session';

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      // Not JSON — raw text is the best detail available.
    }
    throw new Error(detail || `Request failed with HTTP ${response.status}`);
  }
  return JSON.parse(text) as T;
}

export function AgentBridgeClient() {
  const [start, setStart] = useState<StartResult | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  /** Follow a session until it settles. Safe to call on a fresh page load. */
  const track = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        const next = await responseJson<Status>(
          await fetch(`/api/agent/activate/bridge/status?sessionId=${sessionId}`),
        );
        setStatus(next);
        if (next.phase === 'complete' || next.phase === 'failed') {
          localStorage.removeItem(SESSION_KEY);
          return;
        }
      } catch (caught) {
        // A 404 means the server restarted and dropped the session — stop
        // pretending it is still running.
        setError(caught instanceof Error ? caught.message : String(caught));
        localStorage.removeItem(SESSION_KEY);
        return;
      }
      setTimeout(tick, 2000);
    };

    void tick();
    return () => {
      stopped = true;
    };
  }, []);

  // Reattach on mount: the interesting case is the human coming back AFTER
  // closing the mini app to accept, when the work already happened server-side.
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) track(saved);
  }, [track]);

  // Coming back to the foreground is exactly when there is news.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && sessionIdRef.current) {
        void fetch(`/api/agent/activate/bridge/status?sessionId=${sessionIdRef.current}`)
          .then((r) => r.json())
          .then((s: Status) => setStatus(s))
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const begin = async () => {
    setStarting(true);
    setError(null);
    setStatus(null);
    setStart(null);
    try {
      const result = await responseJson<StartResult>(
        await fetch('/api/agent/activate/bridge/start', { method: 'POST' }),
      );
      setStart(result);
      localStorage.setItem(SESSION_KEY, result.sessionId);
      track(result.sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the activation');
    } finally {
      setStarting(false);
    }
  };

  const phase = status?.phase;
  const settled = phase === 'complete' || phase === 'failed';

  return (
    <main className="min-h-screen bg-[#171512] px-5 py-12 text-[#f3eadb]">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development test · bridge
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">Register in the global AgentBook</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          The proof is minted under AgentKit&apos;s own app, so the global AgentBook accepts it.
          The server holds the session — closing this mini app to accept the verification is
          expected, and the work continues without you.
        </p>

        {!start && !settled && (
          <AliveCta
            onClick={begin}
            disabled={starting}
            className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
          >
            {starting ? 'starting…' : 'Create test agent'}
          </AliveCta>
        )}

        {start && !settled && (
          <>
            {/* A real anchor: World App's webview blocks programmatic popups. */}
            <a
              href={start.connectorURI}
              className="mt-8 block w-full rounded-full bg-amber-400 px-6 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-black"
            >
              Verify with World ID
            </a>
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
              <p className="text-[11px] leading-5 text-amber-200/90">
                <strong>Close this mini app</strong> after tapping. The verification waits for you
                in World App&apos;s main screen — accept it there, then come back. Nothing is lost.
              </p>
            </div>
          </>
        )}

        {settled && (
          <AliveCta onClick={begin} className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]">
            Run again
          </AliveCta>
        )}

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">Status</span>
            <span className="font-mono text-xs text-amber-300">
              {phase ?? (start ? 'starting' : 'idle')}
              {status?.polls ? ` · ${status.polls} polls` : ''}
            </span>
          </div>

          {(start?.agentAddress || status?.agentAddress) && (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">Agent address</p>
              <p className="mt-1 break-all font-mono text-xs">
                {status?.agentAddress ?? start?.agentAddress}
              </p>
            </div>
          )}

          {status?.txHash && (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                Registration transaction
              </p>
              <p className="mt-1 break-all font-mono text-xs text-emerald-300">{status.txHash}</p>
            </div>
          )}

          {(error || status?.error) && (
            <p className="mt-5 break-words text-sm text-red-400">{error ?? status?.error}</p>
          )}

          <ol className="mt-6 space-y-2 border-t border-white/10 pt-5">
            {!status?.events?.length ? (
              <li className="font-mono text-xs text-[#6f665a]">No activity yet.</li>
            ) : (
              status.events.map((event, index) => (
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
