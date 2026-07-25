/**
 * S-A5: Bond profile — a small bank dashboard in crypto terms.
 *
 * Balance & receive address, the TRUSTEE ROOM (you talk to the bond's
 * neutral manager HERE, not in your personal chat — your agent advocates,
 * the trustee administers), idle-money proposals (proactive when funds sit
 * parked), charter settings, heirs (add your kid — claims bind to the
 * human via World ID, active at 18 via NFC), and activity.
 */
'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check, Landmark, X } from 'lucide-react';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { BONDS, VAULT_BALANCES, useAgentStore } from '@/lib/agent/agentStore';

// --- tiny self-contained chat for the trustee room ------------------------

type RoomMsg = { id: number; who: 'trustee' | 'you'; text: string; typed?: boolean };
let rid = 1;

function TypeOnce({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 16);
    return () => clearTimeout(t);
  }, [n, text.length]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="inline-block w-[2px] h-[1em] bg-gray-400 align-middle ml-0.5 animate-pulse" />}
    </>
  );
}

type YieldState = 'none' | 'proposed' | 'you-ok' | 'done';

export default function BondProfilePage() {
  const router = useRouter();
  const params = useParams<{ bondId: string }>();
  const bond = BONDS.find((b) => b.id === params.bondId) ?? BONDS[0];
  const isInheritance = bond.type === 'inheritance';
  const balance = VAULT_BALANCES[bond.id] ?? 0;

  const { agentReady, answers, payments, heirs, addHeir, removeHeir } = useAgentStore();

  const [msgs, setMsgs] = useState<RoomMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [yieldState, setYieldState] = useState<YieldState>('none');
  const [heirName, setHeirName] = useState('');
  const [heirShare, setHeirShare] = useState(100);
  const endRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  useEffect(() => {
    if (!agentReady) router.replace('/home');
  }, [agentReady, router]);

  // The proactive loop: idle money makes the trustee speak first.
  useEffect(() => {
    if (!agentReady || greeted.current || !isInheritance) return;
    greeted.current = true;
    setBusy(true);
    const t = setTimeout(() => {
      setMsgs([
        {
          id: rid++,
          who: 'trustee',
          text: `I manage this bond for both of you — neutrally. Right now ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC sits idle here. Want a proposal for what to do with it?`,
          typed: true,
        },
      ]);
      setBusy(false);
    }, 900);
    return () => clearTimeout(t);
  }, [agentReady, isInheritance, balance]);

  // Scroll only within reach of the chat — never yank the page to the bottom.
  useEffect(() => {
    if (msgs.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, yieldState, busy]);

  if (!agentReady) return null;

  const threshold = answers.threshold?.id === 't50' ? '€50' : answers.threshold?.id === 'unusual' ? 'unusual only' : '€200';

  const pushTrustee = (text: string, after?: () => void) => {
    setBusy(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { id: rid++, who: 'trustee', text, typed: true }]);
      setBusy(false);
      if (after) setTimeout(after, text.length * 16 + 800);
    }, 800);
  };

  const askProposal = () => {
    setMsgs((m) => [...m, { id: rid++, who: 'you', text: 'Yes — what would you do with it?' }]);
    pushTrustee(
      'Your joint runway needs ~1,800 for six months of shared expenses. I would keep 2,000 liquid and move 8,000 into the USDC yield vault at 4.1% — projected +328 a year for the family. Nothing moves without both of you releasing it.',
      () => setYieldState('proposed'),
    );
  };

  const releaseYield = () => {
    setYieldState('you-ok');
    setTimeout(() => {
      setYieldState('done');
      pushTrustee('Done — Alice released on her device too. 8,000 USDC are earning for the family now. I’ll report monthly.');
    }, 2600);
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setMsgs((m) => [...m, { id: rid++, who: 'you', text }]);
    setDraft('');
    if (/propos|vorschlag|yield|10|money|geld|idle/i.test(text) && yieldState === 'none') {
      pushTrustee(
        'On the idle funds: I would keep 2,000 liquid for shared expenses and move 8,000 into the USDC yield vault at 4.1% — projected +328 a year. Both of you release, or nothing moves.',
        () => setYieldState('proposed'),
      );
    } else {
      pushTrustee('Noted for the charter. If it needs a rule change, I’ll draft it and ask both of you to release it.');
    }
  };

  const submitHeir = () => {
    const name = heirName.trim();
    if (!name) return;
    addHeir(name, heirShare);
    setHeirName('');
  };

  const activity = [
    ...Object.values(payments)
      .filter((p) => p.stage === 'paid' && !p.personal)
      .map((p) => ({ id: p.id, text: `${p.label} — ${p.amountUsdc.toFixed(2)} to ${p.recipientEns}`, tag: 'Agent payment' })),
    { id: 'so-1', text: 'Standing order — 500.00 from Ben, monthly', tag: 'Standing order' },
    { id: 'so-2', text: 'Standing order — 500.00 from Alice, monthly', tag: 'Standing order' },
  ];

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header */}
      <header className="px-6 pt-4 pb-4 flex items-center gap-4">
        <Link
          href="/profile"
          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 tracking-tight">You &amp; {bond.partner}</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em]">
            <span className={isInheritance ? 'text-amber-600' : 'text-gray-400'}>
              {isInheritance ? 'Inheritance bond · your estate flows here' : 'Business bond'}
            </span>
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-16 space-y-8 max-w-lg w-full mx-auto">
        {/* Balance — the bank card, in crypto terms */}
        <section className="bg-[#1A1A1A] rounded-[2rem] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 blur-[50px]" />
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.25em] relative z-10">Parked in the vault</p>
          <p className="text-4xl font-black text-white font-mono tracking-tight mt-1 relative z-10">
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-sm text-gray-500 ml-2">USDC</span>
          </p>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Receive · give this to anyone</p>
              <p className="text-[12px] font-mono font-bold text-amber-100">ben-{bond.partner.toLowerCase()}.humanbond.eth</p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">fed by standing orders</span>
          </div>
        </section>

        {/* Trustee room */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 flex items-center gap-1.5">
            <Landmark size={10} className="text-amber-500" />
            The trustee room · it serves the bond, not either of you
          </h2>
          <div className="bg-white rounded-[1.75rem] border border-gray-100 p-4 space-y-3">
            {msgs.map((m) =>
              m.who === 'trustee' ? (
                <div key={m.id} className="bg-amber-50 border border-amber-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%]">
                  <p className="text-[13px] text-gray-800 font-medium leading-relaxed">
                    {m.typed ? <TypeOnce text={m.text} /> : m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-[#1A1A1A] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[90%]">
                    <p className="text-[13px] font-bold">{m.text}</p>
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}

            {/* Yield proposal card */}
            {yieldState !== 'none' && (
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className={`px-4 py-3 ${yieldState === 'done' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Trustee proposal · both must release</p>
                  <p className="text-[13px] font-black text-gray-900 mt-0.5">8,000 → USDC yield vault · 4.1% · +328/yr</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Check size={12} className={yieldState !== 'proposed' ? 'text-emerald-500' : 'text-gray-300'} />
                    You {yieldState !== 'proposed' ? '— released on your hito' : '— waiting'}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Check size={12} className={yieldState === 'done' ? 'text-emerald-500' : 'text-gray-300'} />
                    Alice {yieldState === 'done' ? '— released on hers' : '— waiting'}
                  </div>
                  {yieldState === 'proposed' && (
                    <AliveCta onClick={releaseYield} className="w-full px-4 py-3 rounded-xl text-[10px] tracking-[0.15em] mt-1">
                      Release on your hito
                    </AliveCta>
                  )}
                  {yieldState === 'done' && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 text-center pt-1">
                      Executed · earning for the family
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick ask + input */}
            {msgs.length > 0 && yieldState === 'none' && !busy && (
              <button
                onClick={askProposal}
                className="px-4 py-2 bg-white border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >
                Yes — make a proposal
              </button>
            )}
            <div className="flex items-center gap-2 pt-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                placeholder="Tell the trustee something…"
                className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none border border-gray-100"
              />
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white active:scale-90 transition-all disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
              >
                <ArrowUp size={14} />
              </button>
            </div>
            {/* chat scroll anchor — lives INSIDE the room */}
            <div ref={endRef} />
          </div>
        </section>

        {/* Charter settings */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Charter · rules both of you released</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {[
              { k: 'Split of shared expenses', v: 'By income — currently you 10% · Alice 90%' },
              { k: 'Your hardware threshold', v: `hito above ${threshold}` },
              { k: 'Proof of life', v: 'Selfie Check · every 90 days' },
              { k: 'Charter document', v: 'v2 · encrypted on 0G storage' },
            ].map((row) => (
              <div key={row.k} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <p className="text-[12px] font-bold text-gray-500">{row.k}</p>
                <p className="text-[12px] font-medium text-gray-800 text-right">{row.v}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 font-medium px-1">
            Changing a rule = a new charter version — drafted by the trustee, released by both of you.
          </p>
        </section>

        {/* Heirs — the estate lives inside this bond */}
        {isInheritance && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
              Heirs · who claims when you’re both gone
            </h2>
            {heirs.map((h) => (
              <div key={h.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-gray-900">{h.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                    {h.status === 'pending-nfc' ? 'No wallet yet · claimable at 18 via NFC' : 'Verified'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-black text-gray-900 font-mono">{h.sharePct}%</p>
                  <button
                    onClick={() => removeHeir(h.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5 space-y-4">
              <input
                value={heirName}
                onChange={(e) => setHeirName(e.target.value)}
                placeholder="Name — e.g. your son Paul"
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium placeholder:text-gray-300 outline-none border border-gray-100"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Share of the estate</p>
                  <p className="text-sm font-black text-gray-900 font-mono">{heirShare}%</p>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={heirShare}
                  onChange={(e) => setHeirShare(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <AliveCta onClick={submitHeir} className="w-full px-6 py-3.5 rounded-xl text-[11px] tracking-[0.15em]">
                Add to the charter
              </AliveCta>
              <p className="text-[10px] text-gray-400 font-medium">
                No wallet needed — the claim binds to the human. It unlocks with NFC age verification at 18,
                and only after both of you are gone.
              </p>
            </div>
          </section>
        )}

        {/* Activity */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Activity</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {activity.map((a) => (
              <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-gray-800 flex-1">{a.text}</p>
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-300 shrink-0">{a.tag}</span>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
