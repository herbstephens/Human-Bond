/**
 * S-A1: Personal-agent creation — the interview IS the first conversation.
 * Chat shell, Typeform behavior: the agent asks one question at a time,
 * the user answers via chips. Ends in a profile-mirror card, then hands
 * over to /agent (the everyday chat on the same visual surface).
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import {
  INTERVIEW_QUESTIONS,
  profileSummary,
  useAgentStore,
} from '@/lib/agent/agentStore';

function AgentAvatar() {
  return (
    <div className="w-8 h-8 shrink-0 rounded-full bg-black flex items-center justify-center">
      <Sparkles size={14} className="text-white" />
    </div>
  );
}

export default function AgentCreatePage() {
  const router = useRouter();
  const { step, answers, agentReady, answer, completeInterview } = useAgentStore();
  const done = step >= INTERVIEW_QUESTIONS.length;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (agentReady) router.replace('/agent');
  }, [agentReady, router]);

  const current = INTERVIEW_QUESTIONS[step];

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
      <main className="flex-1 overflow-y-auto px-6 pb-40 space-y-4 max-w-lg w-full mx-auto">
        {/* Intro bubble */}
        <div className="flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <AgentAvatar />
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
          const chosen = q.options.find((o) => o.id === answers[q.id]);
          return (
            <div key={q.id} className="space-y-3">
              <div className="flex items-end gap-2">
                <AgentAvatar />
                <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-3.5 border border-gray-100 max-w-[85%]">
                  <p className="text-sm text-gray-800 font-medium">{q.ask}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[#1A1A1A] text-white rounded-3xl rounded-br-lg px-5 py-3">
                  <p className="text-sm font-bold">{chosen?.label}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Current question */}
        {!done && current && (
          <div
            key={current.id}
            className="flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <AgentAvatar />
            <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gray-100 max-w-[85%]">
              <p className="text-sm text-gray-800 font-medium leading-relaxed">{current.ask}</p>
            </div>
          </div>
        )}

        {/* Profile mirror card */}
        {done && (
          <div className="animate-in fade-in zoom-in duration-500 bg-[#1A1A1A] rounded-[2rem] p-7 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 blur-[50px]" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-11 h-11 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Here’s how I’ll advocate for you
                </h3>
                <p className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest">
                  Your profile · visible only to you
                </p>
              </div>
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

      {/* Answer chips */}
      {!done && current && (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-8 pb-8 px-6">
          <div className="max-w-lg mx-auto flex flex-wrap gap-2.5 justify-end">
            {current.options.map((o) => (
              <button
                key={o.id}
                onClick={() => answer(current.id, o.id)}
                className="px-5 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 hover:bg-black hover:text-white hover:border-black transition-all active:scale-95 shadow-sm"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
