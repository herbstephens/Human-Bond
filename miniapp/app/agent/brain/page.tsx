/**
 * S-A3: Your second brain — everything the agent knows about you, visible,
 * editable, playable. Encrypted in YOUR 0G profile: it belongs to no one
 * but you and moves with you. Also home of your bonds — one human can hold
 * several; the inheritance bond is the default route for shared money.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowUp, Lock, X } from 'lucide-react';
import {
  BONDS,
  INTERVIEW_QUESTIONS,
  useAgentStore,
  type BrainFact,
} from '@/lib/agent/agentStore';

/** Interview + import answers become derived facts with provenance. */
function derivedFacts(
  answers: ReturnType<typeof useAgentStore.getState>['answers'],
  importedSources: string[],
): BrainFact[] {
  const facts: BrainFact[] = [];
  if (importedSources.includes('linkedin')) {
    facts.push({ id: 'd-li', text: 'Product Lead in Lisbon — employed', source: 'LinkedIn' });
  }
  if (importedSources.includes('x')) {
    facts.push({ id: 'd-x', text: 'Deep in crypto and festivals', source: 'X' });
  }
  if (importedSources.includes('chatgpt') || importedSources.includes('claude')) {
    facts.push({ id: 'd-ai', text: 'Careful planner, budget-aware, hates surprises', source: 'AI history' });
  }
  for (const q of INTERVIEW_QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;
    const label = a.id ? q.options.find((o) => o.id === a.id)?.label ?? a.text : a.text;
    const prefix =
      q.id === 'income' ? 'Monthly income' :
      q.id === 'budget' ? 'Protected personal budget' :
      q.id === 'stress' ? 'Big bills' :
      q.id === 'fear' ? 'Biggest money fear' :
      q.id === 'threshold' ? 'Ask-me-first rule' :
      q.id === 'job' ? 'Work' : 'Name';
    facts.push({ id: `d-${q.id}`, text: `${prefix}: ${label}`, source: 'Interview' });
  }
  return facts;
}

const SOURCE_COLORS: Record<string, string> = {
  You: 'text-amber-600 border-amber-200 bg-amber-50',
  Interview: 'text-gray-500 border-gray-200 bg-gray-50',
  LinkedIn: 'text-sky-700 border-sky-200 bg-sky-50',
  X: 'text-gray-700 border-gray-300 bg-gray-100',
  'AI history': 'text-violet-700 border-violet-200 bg-violet-50',
  Learned: 'text-emerald-700 border-emerald-200 bg-emerald-50',
};

export default function SecondBrainPage() {
  const router = useRouter();
  const {
    agentReady,
    answers,
    importedSources,
    customFacts,
    payments,
    defaultBondId,
    addFact,
    removeFact,
    setDefaultBond,
  } = useAgentStore();
  const [draft, setDraft] = useState('');

  if (!agentReady) {
    router.replace('/agent/create');
    return null;
  }

  // Learned facts fall out of what actually happened in the chat.
  const learned: BrainFact[] = Object.values(payments)
    .filter((p) => p.stage === 'paid')
    .map((p) =>
      p.personal
        ? { id: `l-${p.id}`, text: `Treated Alice at ${p.label} — paid solo, no trust entry`, source: 'Learned' }
        : p.shareYou === 0
          ? { id: `l-${p.id}`, text: `${p.label}: Alice covered it — you take the next one`, source: 'Learned' }
          : { id: `l-${p.id}`, text: `${p.label}: settled 10/90 by income`, source: 'Learned' },
    );

  const facts = [...derivedFacts(answers, importedSources), ...learned, ...customFacts];

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addFact(text);
    setDraft('');
  };

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 flex items-center gap-4">
        <Link
          href="/agent"
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 tracking-tight">Second brain</h1>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.25em] flex items-center gap-1.5">
            <Lock size={9} className="text-amber-500" />
            Encrypted in your 0G profile · yours alone · moves with you
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-40 space-y-8 max-w-lg w-full mx-auto">
        {/* Bonds */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
            Your bonds · shared money routes to the default
          </h2>
          {BONDS.map((b) => {
            const isDefault = b.id === defaultBondId;
            return (
              <button
                key={b.id}
                onClick={() => setDefaultBond(b.id)}
                className={`w-full text-left bg-white rounded-2xl px-5 py-4 border transition-all flex items-center justify-between ${
                  isDefault ? 'border-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.12)]' : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div>
                  <p className="text-sm font-black text-gray-900">
                    You &amp; {b.partner}
                    <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                      {b.type === 'inheritance' ? 'Inheritance bond' : 'Business bond'}
                    </span>
                  </p>
                  <p className="text-[10px] font-mono font-bold text-gray-400 mt-0.5">
                    ben-{b.partner.toLowerCase()}.humanbond.eth
                  </p>
                </div>
                {isDefault && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                    Default
                  </span>
                )}
              </button>
            );
          })}
          <p className="text-[10px] text-gray-400 font-medium px-1">
            The inheritance bond is your default — it holds the charter your life savings follow. Tap a bond to route shared requests there instead.
          </p>
        </section>

        {/* What the agent knows */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
            What your agent knows about you
          </h2>
          <div className="space-y-2">
            {facts.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center gap-3"
              >
                <span
                  className={`text-[8px] font-black uppercase tracking-widest border rounded-full px-2 py-0.5 shrink-0 ${
                    SOURCE_COLORS[f.source] ?? SOURCE_COLORS.Interview
                  }`}
                >
                  {f.source}
                </span>
                <p className="text-[13px] font-medium text-gray-800 flex-1">{f.text}</p>
                {f.source === 'You' && (
                  <button
                    onClick={() => removeFact(f.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 font-medium px-1">
            Every fact lives encrypted in your own 0G profile — the platform can’t read it, and if you ever leave, it leaves with you.
          </p>
        </section>
      </main>

      {/* Add a fact */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
        <div className="max-w-lg mx-auto bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 pl-5 pr-2 py-2 flex items-center gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add something about yourself…"
            className="flex-1 bg-transparent text-sm text-gray-800 font-medium placeholder:text-gray-300 outline-none"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
