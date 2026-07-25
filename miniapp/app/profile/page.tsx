/**
 * S-A4: Your profile — reached via the ring logo, top-left of the chat.
 *
 * One place for the whole "you": your bonds (the inheritance bond carries
 * your estate; heirs live INSIDE its charter), your second brain (visible,
 * editable, encrypted in your own 0G profile), and the one big action:
 * message your agent. No bottom menu — the chat stays the center.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUp, Lock, MessageCircle, X } from 'lucide-react';
import { AliveCta } from '@/app/components/agent/AliveCta';
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

export default function ProfilePage() {
  const router = useRouter();
  const {
    agentReady,
    answers,
    importedSources,
    customFacts,
    payments,
    vaultBalances,
    heartbeatOk,
    addFact,
    removeFact,
  } = useAgentStore();
  const [draft, setDraft] = useState('');

  // Guard in an effect (never during render — the store hydrates client-side).
  useEffect(() => {
    if (!agentReady) router.replace('/home');
  }, [agentReady, router]);

  if (!agentReady) return null;

  const name = answers.name?.text?.replace(/^just call me /i, '') || 'Ben';

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
  const hasTickets = Object.values(payments).some(
    (p) => p.stage === 'paid' && !p.personal && p.label.toLowerCase().includes('kalorama'),
  );

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addFact(text);
    setDraft('');
  };

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header — you */}
      <header className="px-6 pt-6 pb-2 flex items-center gap-4">
        <Link
          href="/agent"
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter">{name}</h1>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.25em]">
            World ID · Orb verified
            {heartbeatOk && <span className="text-emerald-500"> · proof of life ✓</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-gray-900 font-mono">1,240.00</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Your wallet · USDC</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-40 pt-6 space-y-8 max-w-lg w-full mx-auto">
        {/* Your bonds */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Your bonds</h2>
          {BONDS.map((b) => {
            const isInheritance = b.type === 'inheritance';
            return (
              <Link
                href={`/bond/${b.id}`}
                key={b.id}
                className={`block w-full bg-white rounded-2xl px-5 py-4 border transition-all hover:shadow-md active:scale-[0.99] ${
                  isInheritance ? 'border-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.10)]' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-gray-900">You &amp; {b.partner}</p>
                    <p className="text-[10px] font-mono font-bold text-gray-400 mt-0.5">
                      ben-{b.partner.toLowerCase()}.humanbond.eth
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 border ${
                      isInheritance
                        ? 'text-amber-600 bg-amber-50 border-amber-200'
                        : 'text-gray-400 bg-gray-50 border-gray-200'
                    }`}
                  >
                    {isInheritance ? 'Inheritance' : 'Business'}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-[11px] font-medium text-gray-400">
                    {isInheritance
                      ? hasTickets
                        ? 'Standing orders · 2× Kalorama ticket NFT in the vault'
                        : 'Fed by standing orders from both of you'
                      : 'No activity yet'}
                  </p>
                  <p className="text-[11px] font-black text-gray-900 font-mono">
                    {(vaultBalances[b.id] ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
                  </p>
                </div>
              </Link>
            );
          })}
          <p className="text-[10px] text-gray-400 font-medium px-1">
            Your estate flows to your <span className="font-bold text-gray-500">inheritance bond</span> —
            who gets what is written inside its charter (heirs &amp; shares). Tap a bond to open its dashboard.
          </p>
        </section>

        {/* Second brain */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 flex items-center gap-1.5">
            <Lock size={9} className="text-amber-500" />
            Second brain · encrypted in your 0G profile · moves with you
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
          {/* Add a fact — inline, part of the brain */}
          <div className="bg-white rounded-full border border-gray-100 pl-4 pr-1.5 py-1.5 flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Add something about yourself…"
              className="flex-1 bg-transparent text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none"
            />
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
            >
              <ArrowUp size={13} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium px-1">
            The platform can’t read any of this — and if you ever leave, it leaves with you.
          </p>
        </section>
      </main>

      {/* The one big action — back into the conversation */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
        <div className="max-w-lg mx-auto">
          <AliveCta
            onClick={() => router.push('/agent')}
            className="w-full px-8 py-5 rounded-[1.75rem] text-sm tracking-[0.2em] flex items-center justify-center gap-3"
          >
            <MessageCircle size={18} />
            Message your agent
          </AliveCta>
        </div>
      </div>
    </div>
  );
}
