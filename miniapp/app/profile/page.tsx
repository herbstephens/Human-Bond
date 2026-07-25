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
import { ArrowLeft, ArrowUp, Lock, MessageCircle, Plus, X } from 'lucide-react';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { SelfieCheckOverlay } from '@/app/components/agent/SelfieCheck';
import {
  HEARTBEAT_CYCLE_DAYS,
  INTERVIEW_QUESTIONS,
  useAgentStore,
  type Bond,
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
    heartbeatDaysLeft,
    heartbeatChecked,
    bonds,
    addBond,
    addFact,
    removeFact,
  } = useAgentStore();
  const [draft, setDraft] = useState('');
  const [showSelfie, setShowSelfie] = useState(false);
  const [addingBond, setAddingBond] = useState(false);
  const [bondPartner, setBondPartner] = useState('');
  const [bondType, setBondType] = useState<Bond['type']>('business');

  // Guard in an effect (never during render — the store hydrates client-side).
  useEffect(() => {
    if (!agentReady) router.replace('/home');
  }, [agentReady, router]);

  if (!agentReady) return null;
  if (showSelfie)
    return (
      <SelfieCheckOverlay
        onDone={() => {
          setShowSelfie(false);
          heartbeatChecked();
        }}
      />
    );

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

  const submitBond = () => {
    const partner = bondPartner.trim();
    if (!partner) return;
    addBond(partner, bondType);
    setBondPartner('');
    setAddingBond(false);
  };

  // Dead-man's timer: calm and green far out, louder and redder as it runs down.
  const daysLeft = heartbeatDaysLeft;
  const timerPct = Math.max(0.02, Math.min(1, daysLeft / HEARTBEAT_CYCLE_DAYS));
  const zone: 'green' | 'amber' | 'red' = daysLeft > 30 ? 'green' : daysLeft > 7 ? 'amber' : 'red';

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
        {/* Proof of life — PERSON-level dead-man's timer. Always visible: the
            countdown is the product. Green far out, red when it gets tight. */}
        <div
          className={`bg-white rounded-2xl border p-5 space-y-3 transition-colors duration-700 ${
            zone === 'red'
              ? 'border-red-300 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]'
              : zone === 'amber'
                ? 'border-amber-200 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]'
                : 'border-emerald-100'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  zone === 'red'
                    ? 'bg-red-500 animate-pulse'
                    : zone === 'amber'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-emerald-500'
                }`}
              />
              <p
                className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  zone === 'red' ? 'text-red-600' : zone === 'amber' ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {zone === 'green' ? 'Proof of life ✓' : 'Proof of life due'}
              </p>
            </div>
            <p
              className={`text-sm font-black font-mono tabular-nums ${
                zone === 'red' ? 'text-red-600' : zone === 'amber' ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
            </p>
          </div>

          {/* The timer bar — drains over 90 days, refills on a Selfie Check. */}
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                zone === 'red' ? 'bg-red-500' : zone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${timerPct * 100}%` }}
            />
          </div>

          <p className="text-[12px] font-medium text-gray-600 leading-relaxed">
            {zone === 'red'
              ? 'Almost out. At zero your bonds stop trusting silence — Alice gets asked, the estate clock starts. Ten seconds resets you to 90 days.'
              : zone === 'amber'
                ? 'Getting closer. One Selfie Check resets the timer to 90 days — for every bond you hold, at once.'
                : 'All green — one check covers every bond you hold. Your agent reminds you before it gets tight.'}
          </p>

          {zone === 'green' ? (
            <button
              onClick={() => setShowSelfie(true)}
              className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              Check early
            </button>
          ) : (
            <AliveCta onClick={() => setShowSelfie(true)} className="w-full px-5 py-3.5 rounded-xl text-[11px] tracking-[0.15em]">
              Do the Selfie Check
            </AliveCta>
          )}
        </div>

        {/* Your bonds */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Your bonds</h2>
          {bonds.map((b) => {
            const isInheritance = b.type === 'inheritance';
            const pending = b.status === 'awaiting-partner';
            const typeLabel = b.type.charAt(0).toUpperCase() + b.type.slice(1);
            if (pending)
              return (
                <div
                  key={b.id}
                  className="w-full bg-white/60 rounded-2xl px-5 py-4 border border-dashed border-amber-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-900">You &amp; {b.partner}</p>
                      <p className="text-[10px] font-bold text-amber-600 mt-0.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Invite sent — waiting for {b.partner} to sign
                      </p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 border text-amber-600 bg-amber-50 border-amber-200">
                      {typeLabel}
                    </span>
                  </div>
                  <p className="mt-3 pt-3 border-t border-amber-100 text-[11px] font-medium text-gray-400">
                    A bond only exists once both of you sign — the shared address forms then.
                  </p>
                </div>
              );
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
                      ben-{b.partner.toLowerCase().split(/\s+/)[0]}.humanbond.eth
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 border ${
                      isInheritance
                        ? 'text-amber-600 bg-amber-50 border-amber-200'
                        : 'text-gray-400 bg-gray-50 border-gray-200'
                    }`}
                  >
                    {typeLabel}
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

          {/* Start a new bond — inheritance is unique, everything else is open. */}
          {addingBond ? (
            <div className="bg-white rounded-2xl px-5 py-4 border border-gray-200 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">New bond</p>
              <input
                value={bondPartner}
                onChange={(e) => setBondPartner(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitBond()}
                placeholder="Partner — e.g. Joana, or her World username"
                autoFocus
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none border border-gray-100 focus:border-gray-300 transition-colors"
              />
              <div className="flex flex-wrap gap-2">
                {(['business', 'friends'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBondType(t)}
                    className={`text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 border transition-colors ${
                      bondType === t
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 border text-gray-300 border-gray-100 bg-gray-50 cursor-not-allowed">
                  Inheritance
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">
                You already hold an inheritance bond — your estate lives there. One per human.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={submitBond}
                  disabled={!bondPartner.trim()}
                  className="flex-1 bg-black text-white rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
                >
                  Send bond invite
                </button>
                <button
                  onClick={() => setAddingBond(false)}
                  className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingBond(true)}
              className="w-full rounded-2xl px-5 py-4 border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              <span className="text-[11px] font-black uppercase tracking-[0.15em]">Start a new bond</span>
            </button>
          )}

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
