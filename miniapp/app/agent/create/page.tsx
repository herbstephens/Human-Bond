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
import {
  IMPORT_SOURCES,
  INTERVIEW_QUESTIONS,
  profileSummary,
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

/** Types text live, with a caret while writing. */
function TypingText({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 16);
    return () => clearTimeout(t);
  }, [shown, text.length]);
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
  const { answers, askedIds, importedSources, agentReady, answer, connectSources, completeInterview, resetAgent } =
    useAgentStore();
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(['linkedin', 'chatgpt']);
  const [importState, setImportState] = useState<'pick' | 'importing' | 'done' | 'skipped'>(
    () => (importedSources.length > 0 ? 'done' : Object.keys(answers).length > 0 ? 'skipped' : 'pick'),
  );
  const endRef = useRef<HTMLDivElement>(null);

  // The interview only covers what import couldn't answer.
  const current = INTERVIEW_QUESTIONS.find((q) => !answers[q.id]);
  const done = !current;
  const answeredCount = INTERVIEW_QUESTIONS.filter((q) => answers[q.id]).length;
  const inInterview = importState === 'done' || importState === 'skipped';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answeredCount, importState]);

  useEffect(() => {
    if (agentReady) router.replace('/agent');
  }, [agentReady, router]);

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
                  <p className="text-sm text-gray-800 font-medium">{q.ask}</p>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#1A1A1A] text-white rounded-3xl rounded-br-lg px-5 py-3 max-w-[85%]">
                    <p className="text-sm font-bold">{label}</p>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Current question */}
        {inInterview && !done && current && (
          <div key={current.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gray-100 max-w-[85%]">
              <p className="text-sm text-gray-800 font-medium leading-relaxed">{current.ask}</p>
            </div>
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
            <ul className="space-y-3 relative z-10">
              {profileSummary(answers).map((line, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check size={13} className="text-amber-400/80 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-gray-300 font-medium leading-relaxed">{line}</p>
                </li>
              ))}
            </ul>
            <button
              onClick={completeInterview}
              className="relative z-10 w-full bg-white text-black px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-gray-100 transition-all active:scale-95"
            >
              That’s me — activate my agent
            </button>
            <p className="relative z-10 text-[10px] text-gray-500 font-medium text-center">
              Connect bank account — later. You can refine all of this anytime.
            </p>
          </div>
        )}

        <div ref={endRef} />
      </main>

      {/* Answer chips above a real input — interview phase only */}
      {inInterview && !done && current && (
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
