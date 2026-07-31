/**
 * S-A1: Personal-agent creation.
 *
 * Phase 1 — IMPORT: the agent pulls your existing self from LinkedIn / X /
 * ChatGPT / Claude (mocked) and makes it yours. Phase 2 — only the gaps
 * nobody else can answer get asked, chat-style: chips above a real input,
 * or voice. Ends in the profile-mirror card, then hands over to /agent.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check, Mic } from 'lucide-react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { solidityEncode } from '@worldcoin/idkit-core/hashing';
import {
  IMPORT_SOURCES,
  INTERVIEW_QUESTIONS,
  useAgentStore,
} from '@/lib/agent/agentStore';

/** Simulated voice answers per question — the dummy's stand-in for real STT. */
const VOICE_SAMPLES: Record<string, string> = {
  name: 'Just call me Ben.',
  job: "I'm employed, full time.",
  income: 'Around €3,500 a month.',
  budget: '€500 feels right.',
  stress: 'Honestly? I get stressed.',
  fear: 'Running out of buffer.',
  threshold: 'Ask me above €200.',
};

/** Animate-once registry — the import summary must not retype on remounts. */
const typedOnce = new Set<string>();

type AgentActivationState =
  | 'idle'
  | 'creating-key'
  | 'waiting-for-world-id'
  | 'registering'
  | 'complete';

/** Types text live, with a caret while writing. Animates once per id. */
function TypingText({ id, text }: { id: string; text: string }) {
  const [shown, setShown] = useState(() => (typedOnce.has(id) ? text.length : 0));
  useEffect(() => {
    if (shown >= text.length) {
      typedOnce.add(id);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 16);
    return () => clearTimeout(t);
  }, [shown, text.length, id]);
  return (
    <>
      {text.slice(0, shown)}
      {shown < text.length && (
        <span className="inline-block w-[2px] h-[1em] bg-gray-400 align-middle ml-0.5 animate-pulse" />
      )}
    </>
  );
}

export default function AgentCreatePage() {
  const router = useRouter();
  const { answers, askedIds, importedSources, agentReady, bonds, answer, connectSources, completeInterview, resetAgent } =
    useAgentStore();
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(['linkedin', 'chatgpt']);
  const [importState, setImportState] = useState<'pick' | 'importing' | 'done' | 'skipped'>(
    () => (importedSources.length > 0 ? 'done' : Object.keys(answers).length > 0 ? 'skipped' : 'pick'),
  );
  // LIVE voice: the agent's phrasing per question + the final mirror come from
  // the model (via /api/agent/onboard) — the question STRUCTURE stays fixed.
  const [liveAsk, setLiveAsk] = useState<Record<string, string>>({});
  const [askError, setAskError] = useState<string | null>(null);
  const [summaryLines, setSummaryLines] = useState<string[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activationState, setActivationState] = useState<AgentActivationState>('idle');
  const [activationError, setActivationError] = useState<string | null>(null);
  const fetchingFor = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The interview only covers what import couldn't answer.
  const current = INTERVIEW_QUESTIONS.find((q) => !answers[q.id]);
  const done = !current;
  const answeredCount = INTERVIEW_QUESTIONS.filter((q) => answers[q.id]).length;
  const inInterview = importState === 'done' || importState === 'skipped';

  const answerLabel = (qid: string) => {
    const q = INTERVIEW_QUESTIONS.find((x) => x.id === qid);
    const a = answers[qid];
    if (!q || !a) return '';
    return a.id ? q.options.find((o) => o.id === a.id)?.label ?? a.text : a.text;
  };

  const historyPayload = () =>
    askedIds.map((qid) => ({
      question: liveAsk[qid] ?? INTERVIEW_QUESTIONS.find((x) => x.id === qid)?.ask ?? '',
      answer: answerLabel(qid),
    }));

  const fetchAsk = (q: (typeof INTERVIEW_QUESTIONS)[number]) => {
    fetchingFor.current = q.id;
    setAskError(null);
    fetch('/api/agent/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'react',
        imported: importedSources,
        history: historyPayload(),
        next: { intent: q.ask, options: q.options.map((o) => o.label) },
      }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `onboard API ${res.status}`);
        setLiveAsk((m) => ({ ...m, [q.id]: j.text }));
      })
      .catch((e: Error) => setAskError(e.message))
      .finally(() => {
        fetchingFor.current = null;
      });
  };

  const fetchSummary = () => {
    fetchingFor.current = 'summary';
    setSummaryError(null);
    fetch('/api/agent/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'summary', imported: importedSources, history: historyPayload() }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `onboard API ${res.status}`);
        setSummaryLines(j.lines);
      })
      .catch((e: Error) => setSummaryError(e.message))
      .finally(() => {
        fetchingFor.current = null;
      });
  };

  // Ask the model for the agent's next words whenever a new question is up.
  useEffect(() => {
    if (!inInterview) return;
    if (current && !liveAsk[current.id] && fetchingFor.current !== current.id && !askError) fetchAsk(current);
    if (done && !summaryLines && fetchingFor.current !== 'summary' && !summaryError) fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inInterview, current?.id, done]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answeredCount, importState]);

  // Once the agent exists — whether the interview just finished or one existed
  // all along — the onboarding continues on the bond itself, not in the chat.
  useEffect(() => {
    if (agentReady) router.replace(bonds[0] ? `/bond/${bonds[0].id}` : '/agent');
  }, [agentReady, bonds, router]);

  const runImport = () => {
    setImportState('importing');
    setTimeout(() => {
      connectSources(selectedSources);
      setImportState('done');
    }, 1900);
  };

  const toggleSource = (id: string) =>
    setSelectedSources((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || !current) return;
    answer(current.id, { id: null, text });
    setDraft('');
  };

  /** Dummy voice input: "listen" briefly, then transcribe a sample into the field. */
  const listen = () => {
    if (listening || !current) return;
    setListening(true);
    setTimeout(() => {
      setDraft(VOICE_SAMPLES[current.id] ?? '');
      setListening(false);
    }, 1600);
  };

  const activateAgent = async () => {
    setActivationState('creating-key');
    setActivationError(null);

    try {
      const startResponse = await fetch('/api/agent/activate/start', { method: 'POST' });
      const start = (await startResponse.json()) as {
        agentAddress?: `0x${string}`;
        nonce?: string;
        appId?: `app_${string}`;
        action?: string;
        error?: string;
      };
      if (!startResponse.ok) throw new Error(start.error ?? `Agent activation start failed (${startResponse.status})`);
      if (!start.agentAddress || start.nonce === undefined || !start.appId || !start.action) {
        throw new Error('Agent activation start returned incomplete registration data');
      }

      setActivationState('waiting-for-world-id');
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: start.action,
        signal: solidityEncode(
          ['address', 'uint256'],
          [start.agentAddress, BigInt(start.nonce)],
        ),
        verification_level: VerificationLevel.Orb,
      });
      if (finalPayload.status === 'error') {
        throw new Error(`World ID verification failed: ${finalPayload.error_code}`);
      }

      // AgentBook only accepts proofs minted under AgentKit's own app_id — a
      // MiniKit proof from our app reverts with ProofInvalid() (verified on
      // 2026-07-26). The bridge path is the real fix; for the demo the env var
      // skips global registration after the human's World ID check passed.
      if (process.env.NEXT_PUBLIC_BYPASS_AGENTBOOK_REGISTRATION === '1') {
        setActivationState('complete');
        completeInterview();
        return;
      }

      setActivationState('registering');
      const completeResponse = await fetch('/api/agent/activate/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress: start.agentAddress,
          nonce: start.nonce,
          merkleRoot: finalPayload.merkle_root,
          nullifierHash: finalPayload.nullifier_hash,
          proof: finalPayload.proof,
        }),
      });
      const completed = (await completeResponse.json()) as { registered?: boolean; error?: string };
      if (!completeResponse.ok || !completed.registered) {
        throw new Error(completed.error ?? `AgentKit registration failed (${completeResponse.status})`);
      }
      setActivationState('complete');
      completeInterview();
    } catch (error) {
      setActivationState('idle');
      setActivationError(error instanceof Error ? error.message : 'Agent activation failed');
    }
  };

  const activationLabel: Record<AgentActivationState, string> = {
    idle: 'That’s me — activate my agent',
    'creating-key': 'Creating your agent…',
    'waiting-for-world-id': 'Verify in World App…',
    registering: 'Registering your agent…',
    complete: 'Agent activated',
  };

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 flex items-center gap-4">
        <Link
          href="/home"
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 tracking-tight">Meet your agent</h1>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.25em]">
            It works for you. Only you.
          </p>
        </div>
        <button
          onClick={() => {
            resetAgent();
            setImportState('pick');
            setDraft('');
          }}
          className="text-[9px] font-black text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors"
        >
          Reset
        </button>
        {/* Progress dots — imported answers count as filled */}
        <div className="flex gap-1">
          {INTERVIEW_QUESTIONS.map((q) => (
            <div
              key={q.id}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                answers[q.id] ? 'bg-black' : q.id === current?.id ? 'bg-gray-400' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Conversation */}
      <main className="flex-1 overflow-y-auto px-6 pb-56 space-y-4 max-w-lg w-full mx-auto">
        {/* Intro bubble */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gray-100 max-w-[85%]">
            <p className="text-sm text-gray-800 font-medium leading-relaxed">
              Hi — I’m about to become <span className="font-black">your</span> agent. I can learn
              you two ways: pull the self you’ve already built out there and make it yours — or
              you just tell me.
            </p>
          </div>
        </div>

        {/* Phase 1: source picker */}
        {importState === 'pick' && (
          <div className="bg-white rounded-[1.75rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-6 space-y-4 animate-in fade-in zoom-in duration-500">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400">
              Pull my existing self from
            </p>
            <div className="flex flex-wrap gap-2">
              {IMPORT_SOURCES.map((s) => {
                const on = selectedSources.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSource(s.id)}
                    className={`px-4 py-2.5 rounded-2xl text-[13px] font-bold border transition-all active:scale-95 ${
                      on
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {on && <Check size={12} className="inline mr-1.5 -mt-0.5" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={runImport}
              disabled={selectedSources.length === 0}
              className="w-full bg-black text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-gray-900 transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
            >
              Import & make it mine
            </button>
            <button
              onClick={() => setImportState('skipped')}
              className="w-full text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
            >
              Skip — just ask me everything
            </button>
          </div>
        )}

        {/* Importing */}
        {importState === 'importing' && (
          <div className="flex items-center gap-3 pl-1 animate-in fade-in duration-300">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" style={{ boxShadow: '0 0 12px 2px rgba(245,158,11,.4)' }} />
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              Reading your public self…
            </p>
          </div>
        )}

        {/* Import summary — one bubble, typed live */}
        {importState === 'done' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gray-100 max-w-[85%]">
              <p className="text-sm text-gray-800 font-medium leading-relaxed">
                <TypingText
                  id="import-summary"
                  text={
                    'Got it. LinkedIn: Ben, Product Lead in Lisbon — employed, I’ll assume €4k+ a month. ' +
                    (importedSources.includes('chatgpt') || importedSources.includes('claude')
                      ? 'Your AI history: careful planner, budget-aware, hates surprises. '
                      : '') +
                    'That self is mine now — ours. Four things nobody out there can tell me:'
                  }
                />
              </p>
            </div>
          </div>
        )}

        {/* Answered Q&A history — only questions actually asked here */}
        {inInterview &&
          askedIds.map((qid) => {
            const q = INTERVIEW_QUESTIONS.find((x) => x.id === qid);
            const a = answers[qid];
            if (!q || !a) return null;
            const label = a.id ? q.options.find((o) => o.id === a.id)?.label ?? a.text : a.text;
            return (
              <div key={qid} className="space-y-3">
                <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-3.5 border border-gray-100 max-w-[85%]">
                  <p className="text-sm text-gray-800 font-medium">{liveAsk[qid] ?? q.ask}</p>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gray-500 text-white rounded-3xl rounded-br-lg px-5 py-3 max-w-[85%]">
                    <p className="text-sm font-bold">{label}</p>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Current question — the agent's words arrive LIVE from the model */}
        {inInterview && !done && current && (
          <div key={current.id}>
            {liveAsk[current.id] ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gray-100 max-w-[85%]">
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">
                    <TypingText id={`ask-${current.id}`} text={liveAsk[current.id]} />
                  </p>
                </div>
              </div>
            ) : askError ? (
              <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 border border-red-200 max-w-[85%] space-y-2">
                <p className="text-[12px] text-red-500 font-bold break-words">{askError}</p>
                <button
                  onClick={() => fetchAsk(current)}
                  className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 pl-1 animate-in fade-in duration-300">
                <div
                  className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"
                  style={{ boxShadow: '0 0 12px 2px rgba(245,158,11,.4)' }}
                />
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Thinking…</p>
              </div>
            )}
          </div>
        )}

        {/* Profile mirror card */}
        {inInterview && done && (
          <div className="animate-in fade-in zoom-in duration-500 bg-[#1A1A1A] rounded-[2rem] p-7 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 blur-[50px]" />
            <div className="relative z-10">
              <h3 className="text-base font-black text-white tracking-tight">
                Here’s how I’ll advocate for you
              </h3>
              <p className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mt-1">
                Your profile · visible only to you
              </p>
            </div>
            {summaryLines ? (
              <ul className="space-y-3 relative z-10">
                {summaryLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={13} className="text-amber-400/80 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-gray-300 font-medium leading-relaxed">
                      <TypingText id={`sum-${i}`} text={line} />
                    </p>
                  </li>
                ))}
              </ul>
            ) : summaryError ? (
              <div className="relative z-10 space-y-2">
                <p className="text-[12px] text-red-400 font-bold break-words">{summaryError}</p>
                <button
                  onClick={fetchSummary}
                  className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="relative z-10 flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"
                  style={{ boxShadow: '0 0 12px 2px rgba(245,158,11,.4)' }}
                />
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                  Writing down who you are…
                </p>
              </div>
            )}
            <button
              onClick={activateAgent}
              disabled={!summaryLines || activationState !== 'idle'}
              className="relative z-10 w-full bg-white text-black px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-gray-100 transition-all active:scale-95 disabled:bg-white/20 disabled:text-white/40"
            >
              {activationLabel[activationState]}
            </button>
            {activationError ? (
              <p className="relative z-10 text-[11px] text-red-400 font-bold text-center break-words">
                {activationError}
              </p>
            ) : null}
            <p className="relative z-10 text-[10px] text-gray-500 font-medium text-center">
              Connect bank account — later. You can refine all of this anytime.
            </p>
          </div>
        )}

        <div ref={endRef} />
      </main>

      {/* Answer chips above a real input — interview phase only. Gated on the
          LIVE question having arrived: answering earlier let the static fallback
          text speak and made parallel fetches land out of order. */}
      {inInterview && !done && current && liveAsk[current.id] && (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
          <div className="max-w-lg mx-auto space-y-3">
            <div className="flex flex-wrap gap-2 justify-end">
              {current.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => answer(current.id, { id: o.id, text: o.label })}
                  className="px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-[13px] font-bold text-gray-800 hover:bg-black hover:text-white hover:border-black transition-all active:scale-95 shadow-sm"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 pl-2 pr-2 py-2 flex items-center gap-2">
              <button
                onClick={listen}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                  listening ? 'bg-amber-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title="Answer with your voice"
              >
                <Mic size={16} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                placeholder={listening ? 'Listening…' : 'Or type your own answer…'}
                className="flex-1 bg-transparent text-sm text-gray-800 font-medium placeholder:text-gray-300 outline-none"
              />
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
