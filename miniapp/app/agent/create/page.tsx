/**
 * S-A1: Personal-agent creation — the interview IS the first conversation.
 * Chat shell, Typeform behavior: the agent asks one question at a time,
 * the user answers via chips above a real text input — or types their own
 * answer. Ends in a profile-mirror card, then hands over to /agent.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check } from 'lucide-react';
import {
  INTERVIEW_QUESTIONS,
  profileSummary,
  useAgentStore,
} from '@/lib/agent/agentStore';

export default function AgentCreatePage() {
  const router = useRouter();
  const { step, answers, agentReady, answer, completeInterview } = useAgentStore();
  const [draft, setDraft] = useState('');
  const done = step >= INTERVIEW_QUESTIONS.length;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (agentReady) router.replace('/agent');
  }, [agentReady, router]);

  const current = INTERVIEW_QUESTIONS[step];

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || !current) return;
    answer(current.id, { id: null, text });
    setDraft('');
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
        {/* Progress dots */}
        <div className="flex gap-1">
          {INTERVIEW_QUESTIONS.map((q, i) => (
            <div
              key={q.id}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i < step ? 'bg-black' : i === step ? 'bg-gray-400' : 'bg-gray-300'
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
              Hi — I’m about to become <span className="font-black">your</span> agent. Not your
              partner’s, not the trust’s. To advocate for you I need to actually know you.
              Seven questions, one minute.
            </p>
          </div>
        </div>

        {/* Answered Q&A history */}
        {INTERVIEW_QUESTIONS.slice(0, step).map((q) => {
          const a = answers[q.id];
          const label = a ? (a.id ? q.options.find((o) => o.id === a.id)?.label ?? a.text : a.text) : '';
          return (
            <div key={q.id} className="space-y-3">
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
        {!done && current && (
          <div key={current.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gray-100 max-w-[85%]">
              <p className="text-sm text-gray-800 font-medium leading-relaxed">{current.ask}</p>
            </div>
          </div>
        )}

        {/* Profile mirror card */}
        {done && (
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

      {/* Answer chips above a real input */}
      {!done && current && (
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
            <div className="bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 pl-5 pr-2 py-2 flex items-center gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                placeholder="Or type your own answer…"
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
