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
import { Link2, MessageCircle, Plus, Upload, X } from 'lucide-react';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { useMarriage } from '@/lib/marriage/context';
import { useLiveBondSync } from '@/lib/agent/useLiveBondSync';
import { useWorldProfile } from '@/lib/worldcoin/useWorldProfile';
import { USE_MOCKS } from '@/lib/config';
import { META } from '@/lib/design';
import { formatMoney } from '@/lib/vault/usdc';
import { useRouteGuard } from '@/lib/hooks/useLiveStage';
import { useAgentHydrated } from '@/lib/agent/useAgentHydrated';
import { StageLoading } from '@/app/components/StageLoading';
import { ENS_PARENT } from '@/lib/contracts/registrar';
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
  // The imported-source facts are playground fiction (there is no real import
  // pipeline) — they must never surface in live, even if an old live session
  // persisted importedSources before the import UI was mock-gated.
  if (USE_MOCKS) {
    if (importedSources.includes('linkedin')) {
      facts.push({ id: 'd-li', text: 'Product Lead in Lisbon — employed', source: 'LinkedIn' });
    }
    if (importedSources.includes('x')) {
      facts.push({ id: 'd-x', text: 'Deep in crypto and festivals', source: 'X' });
    }
    if (importedSources.includes('chatgpt') || importedSources.includes('claude')) {
      facts.push({ id: 'd-ai', text: 'Careful planner, budget-aware, hates surprises', source: 'AI history' });
    }
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

/** Social accounts the user can link into their second brain. AI sources
 *  (chatgpt/claude) live under the AI-history card, not here. */
const ACCOUNT_CATALOG: { id: string; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
];

export default function ProfilePage() {
  const router = useRouter();
  const {
    agentReady,
    answers,
    importedSources,
    customFacts,
    payments,
    vaultBalances,
    heartbeatDaysLeft,
    heartbeatChecked,
    bonds,
    bondEnsLabel,
    addBond,
    addFact,
    removeFact,
  } = useAgentStore();
  // Live: this page is the dashboard — it reads the chain directly. The sync
  // also mirrors the ONE real bond into the store (Mika & co are mock-only).
  useLiveBondSync();
  const { address } = useMarriage();
  const { profile: myProfile } = useWorldProfile(address ?? '');
  const [draft, setDraft] = useState('');
  const [showSelfie, setShowSelfie] = useState(false);
  const [addingBond, setAddingBond] = useState(false);
  const [bondPartner, setBondPartner] = useState('');
  const [bondType, setBondType] = useState<Bond['type']>('business');
  // Second brain: which category card is expanded + the add-content popup.
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [addBrainOpen, setAddBrainOpen] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);

  // Live routing belongs to the contract (lib/hooks/useLiveStage.ts): it sends
  // anyone below the dashboard stage back to /home — and /home, reading the SAME
  // contract, will not bounce them here again. Mock keeps its local agent gate.
  const stage = useRouteGuard('/profile');
  // Hold until the persisted store has landed: `agentReady` reads false on the
  // first render, and redirecting on that bounced every reload back to /home.
  const agentHydrated = useAgentHydrated();
  useEffect(() => {
    if (!agentHydrated) return;
    if (USE_MOCKS && !agentReady) router.replace('/home');
  }, [agentHydrated, agentReady, router]);

  if (!agentHydrated) return <StageLoading />;
  if (USE_MOCKS ? !agentReady : stage !== 'dashboard') return <StageLoading />;
  if (showSelfie)
    return (
      <SelfieCheckOverlay
        onDone={() => {
          setShowSelfie(false);
          heartbeatChecked();
        }}
      />
    );

  const name = USE_MOCKS
    ? answers.name?.text?.replace(/^just call me /i, '') || 'Ben'
    : myProfile.username ?? answers.name?.text?.replace(/^just call me /i, '') ?? 'you';

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

  // Second brain, grouped: interview + learned = "Info", AI history its own
  // card, custom entries + uploads = "Added by you". Linked accounts come from
  // importedSources (social only — AI sources stay under AI history). Each card
  // is a single summary row — the count lives on the right, no expand.
  const infoFacts = facts.filter((f) => f.source === 'Interview' || f.source === 'Learned');
  const aiFacts = facts.filter((f) => f.source === 'AI history');
  const youFacts = facts.filter((f) => f.source === 'You');
  const linkedAccounts = ACCOUNT_CATALOG.filter((a) => importedSources.includes(a.id));

  const linkAccount = (id: string) => {
    if (importedSources.includes(id)) return;
    useAgentStore.setState((s) => ({ importedSources: [...s.importedSources, id] }));
  };

  const saveBrain = () => {
    const text = draft.trim();
    if (!text && !uploadName) return;
    if (text) addFact(text);
    if (uploadName) addFact(`📄 ${uploadName}`);
    setDraft('');
    setUploadName(null);
    setAddBrainOpen(false);
  };

  // "Linked accounts" is a playground card: linking does nothing real (it just
  // flags importedSources), so live never offers it. Live shows what is real:
  // interview answers, learned behavior, and what you typed in yourself.
  const brainCards: { key: string; label: string; sub: string; items: BrainFact[]; kind: 'facts' | 'accounts' | 'you' }[] = [
    { key: 'info', label: 'Info', sub: `${infoFacts.length} ${infoFacts.length === 1 ? 'thing' : 'things'} your agent knows`, items: infoFacts, kind: 'facts' },
    ...(aiFacts.length ? [{ key: 'ai', label: 'AI history', sub: `${aiFacts.length} insight${aiFacts.length === 1 ? '' : 's'}`, items: aiFacts, kind: 'facts' as const }] : []),
    ...(USE_MOCKS
      ? [{ key: 'accounts', label: 'Linked accounts', sub: `${linkedAccounts.length} connected`, items: [] as BrainFact[], kind: 'accounts' as const }]
      : []),
    ...(youFacts.length ? [{ key: 'you', label: 'Added by you', sub: `${youFacts.length} ${youFacts.length === 1 ? 'entry' : 'entries'}`, items: youFacts, kind: 'you' as const }] : []),
  ];

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
      {/* No wallet balance here — this page is about the BONDS, and the
          personal wallet number was one more place for mock/real to diverge. */}
      <header className="px-6 pt-6 pb-2 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-anton text-black tracking-wide truncate">HEY {name.toUpperCase()}!</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-40 pt-6 space-y-8 max-w-lg w-full mx-auto">
        {/* Proof of life — PERSON-level dead-man's timer. Always visible: the
            countdown is the product. Green far out, red when it gets tight. */}
        <div
          className={`bg-white rounded-2xl p-5 space-y-3 transition-colors duration-700 ${
            zone === 'red' ? 'shadow-[0_0_0_3px_rgba(239,68,68,0.10)]' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  zone === 'red'
                    ? 'bg-red-500 animate-pulse'
                    : zone === 'amber'
                      ? 'bg-gray-400 animate-pulse'
                      : 'bg-emerald-500'
                }`}
              />
              <p
                className={`text-xl font-anton tracking-wide ${
                  zone === 'red' ? 'text-red-600' : zone === 'amber' ? 'text-gray-700' : 'text-emerald-600'
                }`}
              >
                {zone === 'green' ? 'PROOF OF LIFE ✓' : 'PROOF OF LIFE DUE'}
              </p>
            </div>
            <p
              className={`text-xl font-anton tracking-wide ${
                zone === 'red' ? 'text-red-600' : zone === 'amber' ? 'text-gray-700' : 'text-emerald-600'
              }`}
            >
              {daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'}
            </p>
          </div>

          {/* The timer bar — drains over 90 days, refills on a Selfie Check. */}
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                zone === 'red' ? 'bg-red-500' : zone === 'amber' ? 'bg-gray-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${timerPct * 100}%` }}
            />
          </div>

          <p className={META}>
            Your Selfie Check is valid for {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
          </p>

          {zone !== 'green' && (
            <AliveCta glow={false} onClick={() => setShowSelfie(true)} className="w-full px-5 py-3.5 rounded-xl text-[11px] tracking-[0.15em]">
              Do the Selfie Check
            </AliveCta>
          )}
        </div>

        {/* Your bonds */}
        <section className="space-y-3">
          <h2 className="text-2xl font-anton text-black tracking-wide">YOUR BONDS</h2>
          {bonds.map((b) => {
            const pending = b.status === 'awaiting-partner';
            const typeLabel = b.type.charAt(0).toUpperCase() + b.type.slice(1);
            // A dissolved bond stays on the list as a headstone — it happened,
            // it is over, and there is nothing left to open. Never a link: the
            // vault is settled and the page behind it no longer has a subject.
            if (b.status === 'dissolved')
              return (
                <div key={b.id} className="w-full bg-white/50 rounded-2xl px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-anton text-gray-400 tracking-wide truncate min-w-0 line-through">
                      YOU &amp; {b.partner.toUpperCase()}
                    </h3>
                    <span className={`${META} shrink-0`}>Dissolved</span>
                  </div>
                  <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] font-medium text-gray-400">
                    Settled 50/50. You can bond again in 30 days — the cooldown is on-chain.
                  </p>
                </div>
              );
            if (pending)
              return (
                <div
                  key={b.id}
                  className="w-full bg-white/60 rounded-2xl px-5 py-4 border border-dashed border-gray-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-900">You &amp; {b.partner}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                        Invite sent — waiting for {b.partner} to sign
                      </p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 text-gray-500 bg-gray-100">
                      {typeLabel}
                    </span>
                  </div>
                  <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] font-medium text-gray-400">
                    A bond only exists once both of you sign — the shared address forms then.
                  </p>
                </div>
              );
            return (
              <Link
                href={`/bond/${b.id}`}
                key={b.id}
                className="block w-full bg-white rounded-2xl px-5 py-4 transition-all hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Live shows the REGISTERED name or none — a made-up ENS on a
                      money row reads as payable. The ben-… name is mock-only. */}
                  <h3 className="text-xl font-anton text-black tracking-wide truncate min-w-0">
                    {USE_MOCKS ? (
                      <>
                        {`ben-${b.partner.toLowerCase().split(/\s+/)[0]}`.toUpperCase()}
                        <span className={META}>.{ENS_PARENT.toUpperCase()}</span>
                      </>
                    ) : bondEnsLabel ? (
                      <>
                        {bondEnsLabel.toUpperCase()}
                        <span className={META}>.{ENS_PARENT.toUpperCase()}</span>
                      </>
                    ) : (
                      <>YOU &amp; {b.partner.toUpperCase()}</>
                    )}
                  </h3>
                  <p className="text-2xl font-anton text-black tracking-wide tabular-nums shrink-0">
                    {formatMoney(vaultBalances[b.id] ?? 0)}
                    <span className={`${META} ml-1`}>USDC</span>
                  </p>
                </div>
              </Link>
            );
          })}

          {/* Start a new bond — mock choreography; live bonding runs through the
              real proposal flow. */}
          {USE_MOCKS && (addingBond ? (
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
          ))}
        </section>

        {/* Second brain */}
        <section className="space-y-3">
          <h2 className="text-2xl font-anton text-black tracking-wide">SECOND BRAIN</h2>
          {/* Grouped categories — each a bond-sized card: label left, summary
              right in uppercase (like the ENS suffix). Tap to expand; no icon. */}
          {brainCards.map((cat) => {
            const open = openCat === cat.key;
            return (
              <div key={cat.key} className="bg-white rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenCat(open ? null : cat.key)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform"
                >
                  <h3 className="text-xl font-anton text-black tracking-wide shrink-0">{cat.label.toUpperCase()}</h3>
                  <p className={`${META} text-right`}>{cat.sub}</p>
                </button>
                {open && (
                  <div className="px-5 pb-4 pt-1 border-t border-gray-100 space-y-2">
                    {cat.kind === 'accounts' ? (
                      <>
                        {linkedAccounts.length > 0 ? (
                          linkedAccounts.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 py-1 text-[13px] font-medium text-gray-800">
                              <Link2 size={13} className="text-gray-400 shrink-0" />
                              {a.label} <span className="text-gray-400">· connected</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-gray-400 py-1">No accounts connected yet.</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {ACCOUNT_CATALOG.filter((a) => !importedSources.includes(a.id)).map((a) => (
                            <button
                              key={a.id}
                              onClick={() => linkAccount(a.id)}
                              className="text-[11px] font-bold rounded-full px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1"
                            >
                              <Plus size={11} /> {a.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : cat.items.length > 0 ? (
                      cat.items.map((f) => (
                        <div key={f.id} className="flex items-start gap-2 py-1">
                          <p className="text-[13px] font-medium text-gray-800 flex-1">{f.text}</p>
                          {cat.kind === 'you' && (
                            <button
                              onClick={() => removeFact(f.id)}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-[12px] text-gray-400 py-1">Nothing here yet.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add something about yourself — same affordance as "Start a new bond" */}
          <button
            onClick={() => setAddBrainOpen(true)}
            className="w-full rounded-2xl px-5 py-4 border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            <span className="text-[11px] font-black uppercase tracking-[0.15em]">Add something about yourself</span>
          </button>

          <p className="text-[10px] text-gray-400 font-medium px-1">
            The platform can’t read any of this — and if you ever leave, it leaves with you.
          </p>
        </section>

        {/* Dev-only entry to the AgentKit test routes. It lives here too because
            the route guard sends anyone at the dashboard stage away from /home,
            where Misha's original link sits — inside World App there is no URL
            bar to reach /test with. */}
        {process.env.NODE_ENV !== 'production' && (
          <Link
            href="/test"
            className="block pb-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 transition-colors hover:text-black"
          >
            test · agentkit
          </Link>
        )}
      </main>

      {/* The one big action — back into the conversation */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
        <div className="max-w-lg mx-auto">
          <AliveCta
            glow={false}
            onClick={() => router.push('/agent')}
            className="w-full px-8 py-5 rounded-[1.75rem] text-sm tracking-[0.2em] flex items-center justify-center gap-3"
          >
            <MessageCircle size={18} />
            Your agent
          </AliveCta>
        </div>
      </div>

      {/* Add-to-brain popup — write an instruction or upload a document */}
      {addBrainOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setAddBrainOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h3 className="text-2xl font-anton text-black tracking-wide">ADD TO YOUR BRAIN</h3>
              <p className="text-[12px] text-gray-500 font-medium mt-0.5">
                An instruction or a document — encrypted in your 0G profile, only your agent reads it.
              </p>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Always keep €500 for emergencies. Never invest in memecoins."
              className="w-full h-28 bg-gray-50 rounded-2xl px-4 py-3 text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none resize-none"
            />
            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors">
              <Upload size={16} className="text-gray-500 shrink-0" />
              <span className="text-[13px] font-medium text-gray-600 flex-1 truncate">
                {uploadName ?? 'Upload a PDF — résumé, contract…'}
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setUploadName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveBrain}
                disabled={!draft.trim() && !uploadName}
                className="flex-1 bg-black text-white rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
              >
                Save to brain
              </button>
              <button
                onClick={() => {
                  setAddBrainOpen(false);
                  setUploadName(null);
                }}
                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
