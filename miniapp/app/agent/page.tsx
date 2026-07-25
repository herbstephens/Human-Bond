/**
 * S-A2: Conversation with your personal agent.
 *
 * Includes: the "your agent is alive" birth celebration (morphing blob),
 * one-bubble live typing, visible reasoning on receipt scans, the funding
 * moment (grant the bond pull access — card on file), and the fair-split
 * choreography: agents compare incomes → 10/90 → each share pulled from
 * its own wallet in the moment, like a card charge.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check, ScanLine } from 'lucide-react';
import { useAgentStore, type ChoreoStage, type Payment } from '@/lib/agent/agentStore';

// ---------------------------------------------------------------------------

/** Types text live into a single bubble, with a caret while writing. */
function TypingText({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 18);
    return () => clearTimeout(t);
  }, [shown, text.length]);
  const done = shown >= text.length;
  return (
    <span className={className}>
      {text.slice(0, shown)}
      {!done && <span className="inline-block w-[2px] h-[1em] bg-gray-400 align-middle ml-0.5 animate-pulse" />}
    </span>
  );
}

/**
 * The proposal card: what the agents negotiated, waiting for the HUMAN to
 * release it on hito — with the feelings loop one tap away. After release
 * it walks through pull → paid.
 */
function ProposalCard({ payment }: { payment: Payment }) {
  const { confirmOnHito, renegotiate } = useAgentStore();
  const p = payment;
  const isProposed = p.stage === 'proposed';
  const isPaid = p.stage === 'paid';

  const execSteps: { stage: ChoreoStage; label: string }[] = [
    { stage: 'confirmed', label: 'Released — you ✓ on your hito · Alice ✓ on hers' },
    {
      stage: 'pulled',
      label:
        p.shareYou === 0
          ? `${p.sharePartner.toFixed(2)} USDC pulled from Alice’s wallet`
          : `${p.shareYou.toFixed(2)} pulled from you · ${p.sharePartner.toFixed(2)} from Alice`,
    },
    { stage: 'paid', label: `${p.amountUsdc.toFixed(2)} USDC paid to ${p.recipientEns}` },
  ];
  const order: ChoreoStage[] = ['proposed', 'confirmed', 'pulled', 'paid'];
  const idx = order.indexOf(p.stage);

  return (
    <div className="w-full bg-white rounded-[1.75rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden animate-in fade-in zoom-in duration-500">
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between gap-4 ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
            {isProposed ? 'Proposal · negotiated by your agents' : 'Payment'}
          </p>
          <p className="text-[13px] font-black text-gray-900 mt-0.5">{p.label}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-gray-900 font-mono">{p.amountUsdc.toFixed(2)} USDC</p>
          <p className="text-[9px] font-mono font-bold text-gray-400">{p.recipientEns}</p>
        </div>
      </div>

      {/* The negotiated split — always visible */}
      <div className="px-6 pt-4 pb-1">
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">You</p>
            <p className="text-sm font-black text-gray-900 font-mono">{p.shareYou.toFixed(2)}</p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Alice</p>
            <p className="text-sm font-black text-gray-900 font-mono">{p.sharePartner.toFixed(2)}</p>
          </div>
        </div>
        {p.note && (
          <p className="mt-2.5 text-[11px] font-medium text-amber-600">↺ Renegotiated: {p.note}</p>
        )}
      </div>

      {/* Awaiting the human: hito release + the feelings loop */}
      {isProposed && (
        <div className="px-6 py-5 space-y-2.5">
          <button
            onClick={() => confirmOnHito(p.id)}
            className="w-full bg-black text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-all active:scale-[0.97] shadow-lg"
          >
            Release on your hito
          </button>
          {!p.renegotiated && (
            <button
              onClick={() => renegotiate(p.id)}
              className="w-full px-6 py-3 rounded-2xl text-[11px] font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-all"
            >
              I don’t feel good about this
            </button>
          )}
        </div>
      )}

      {/* Execution steps after release */}
      {!isProposed && (
        <div className="px-6 py-5 space-y-3.5">
          {execSteps.map((s) => {
            const si = order.indexOf(s.stage);
            const reached = si <= idx;
            const isCurrent = si === idx && !isPaid;
            return (
              <div key={s.stage} className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    reached ? (isCurrent ? 'bg-amber-500 text-white' : 'bg-black text-white') : 'bg-gray-100 text-gray-300'
                  }`}
                >
                  {reached && !isCurrent ? (
                    <Check size={11} />
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
                  )}
                </div>
                <p className={`text-[13px] font-medium flex-1 ${reached ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</p>
              </div>
            );
          })}
          {isPaid && (
            <div className="w-full bg-emerald-50 border border-emerald-100 text-emerald-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-center">
              Settled · released by humans, executed by the bond
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pull-access confirmation — the "card on file" moment, for both partners. */
function GrantCard() {
  return (
    <div className="w-full bg-white rounded-[1.75rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] px-6 py-5 animate-in fade-in zoom-in duration-500">
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 mb-2">Pull access granted</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Check size={13} className="text-emerald-500" />
          <p className="text-[13px] font-medium text-gray-800">You — wallet linked to the bond</p>
        </div>
        <div className="flex items-center gap-2">
          <Check size={13} className="text-emerald-500" />
          <p className="text-[13px] font-medium text-gray-800">Alice — wallet linked to the bond</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-gray-400 font-medium">
        The bond can now charge each of you your fair share — like a card on file.
      </p>
    </div>
  );
}

/** Birth celebration: a breathing blob — someone lives now, and it's yours. */
function BornOverlay({ onHello }: { onHello: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#E8E8E8] flex flex-col items-center justify-center px-8 text-center">
      <style>{`
        @keyframes hbBlob {
          0%, 100% { border-radius: 46% 54% 52% 48% / 55% 46% 54% 45%; transform: rotate(0deg) scale(1); }
          33% { border-radius: 55% 45% 42% 58% / 47% 57% 43% 53%; transform: rotate(4deg) scale(1.04); }
          66% { border-radius: 42% 58% 57% 43% / 52% 44% 56% 48%; transform: rotate(-4deg) scale(0.97); }
        }
        @keyframes hbBlobGlow {
          0%, 100% { box-shadow: 0 0 30px 6px rgba(245,158,11,.30); }
          50% { box-shadow: 0 0 55px 14px rgba(245,158,11,.15); }
        }
      `}</style>
      <div
        className="w-36 h-36 bg-amber-400 mb-10"
        style={{ animation: 'hbBlob 6s ease-in-out infinite, hbBlobGlow 4s ease-in-out infinite' }}
      />
      <h1 className="text-4xl font-black text-gray-900 tracking-tighter leading-[0.95] animate-in fade-in slide-in-from-bottom-3 duration-1000">
        Your agent<br />is alive.
      </h1>
      <p className="mt-4 text-sm text-gray-500 font-medium max-w-[300px] leading-relaxed animate-in fade-in duration-1000 delay-300">
        A personality on-chain. It belongs to no one but you — and it moves with you, wherever you go.
      </p>
      <button
        onClick={onHello}
        className="mt-10 w-full max-w-xs bg-black text-white px-8 py-5 rounded-[1.75rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-gray-900 transition-all shadow-2xl shadow-gray-300 active:scale-[0.98] animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-500"
      >
        Say hello
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function AgentChatPage() {
  const router = useRouter();
  const {
    agentReady,
    bornPending,
    partnerAgentReady,
    pullGranted,
    pendingReceipt,
    messages,
    payments,
    celebrateBorn,
    scanBill,
    requestPay,
    grantPull,
    buyShared,
    buyPersonal,
    say,
    agentSay,
    resetAgent,
  } = useAgentStore();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentReady) router.replace('/agent/create');
  }, [agentReady, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, payments]);

  if (!agentReady) return null;
  if (bornPending) return <BornOverlay onHello={celebrateBorn} />;

  const lastAgentText = [...messages].reverse().find((m) => m.kind === 'text' && m.role === 'agent');
  const offerPay =
    pendingReceipt !== null &&
    lastAgentText?.kind === 'text' &&
    lastAgentText.text.startsWith('Want me to settle');
  const offerGrant =
    pendingReceipt !== null &&
    !pullGranted &&
    lastAgentText?.kind === 'text' &&
    lastAgentText.text.startsWith('One thing first');

  const askFinances = () => {
    say('How are our finances?');
    setTimeout(
      () =>
        agentSay(
          'Clean. The shared account settles per expense — nothing parked there. You have used €62 of your protected budget, Alice €118 of hers. Your emergency buffer is untouched; I know that matters to you.',
          { typed: true },
        ),
      800,
    );
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    say(text);
    setDraft('');
    setTimeout(
      () => agentSay('Noted — I’ll factor that in. If it should become a shared rule, I’ll take it to the trustee.', { typed: true }),
      800,
    );
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
          <h1 className="text-base font-black text-gray-900 tracking-tight">Your agent</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${partnerAgentReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-gray-400">{partnerAgentReady ? 'Trustee active' : 'Waiting for Alice’s agent'}</span>
          </p>
        </div>
        <button
          onClick={resetAgent}
          className="text-[9px] font-black text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors"
        >
          Reset
        </button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-6 pb-48 space-y-4 max-w-lg w-full mx-auto">
        {messages.map((m) => {
          if (m.kind === 'choreo') {
            const p = payments[m.paymentId];
            return p ? <ProposalCard key={m.id} payment={p} /> : null;
          }
          if (m.kind === 'grant') return <GrantCard key={m.id} />;
          if (m.kind === 'receipt') {
            return (
              <div key={m.id} className="animate-in fade-in zoom-in duration-500">
                <div className="bg-white rounded-3xl rounded-bl-lg p-4 border border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.04)] w-[75%]">
                  <div className="pb-3 border-b border-dashed border-gray-200">
                    <p className="text-sm font-black text-gray-900">{m.vendor}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Scanned · tonight</p>
                  </div>
                  <div className="pt-3 flex items-baseline justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                    <span className="text-lg font-black text-gray-900 font-mono">
                      {m.amountUsdc.toFixed(2)} <span className="text-xs text-gray-400">USDC</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          }
          if (m.role === 'agent') {
            // Thinking: the agent's visible reasoning — smaller, quieter, typed.
            if (m.thinking) {
              return (
                <div key={m.id} className="animate-in fade-in duration-400 pl-1 max-w-[85%]">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-gray-300 mb-1">Reasoning</p>
                  <p className="text-[12.5px] text-gray-400 font-medium italic leading-relaxed">
                    {m.typed ? <TypingText text={m.text} /> : m.text}
                  </p>
                </div>
              );
            }
            return (
              <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-3.5 border border-gray-100 max-w-[85%]">
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">
                    {m.typed ? <TypingText text={m.text} /> : m.text}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-400">
              <div className="bg-[#1A1A1A] text-white rounded-3xl rounded-br-lg px-5 py-3 max-w-[85%]">
                <p className="text-sm font-bold">{m.text}</p>
              </div>
            </div>
          );
        })}

        {/* Contextual action: settle the bill */}
        {offerPay && (
          <div className="flex flex-col gap-2 items-end animate-in fade-in duration-500">
            <button
              onClick={requestPay}
              className="bg-black text-white px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-all active:scale-95 shadow-lg"
            >
              Yes — settle it fairly
            </button>
            <button
              onClick={() => say('Not now.')}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors px-2"
            >
              Not now
            </button>
          </div>
        )}

        {/* Contextual action: the funding moment */}
        {offerGrant && (
          <div className="flex justify-end animate-in fade-in duration-500">
            <button
              onClick={grantPull}
              className="bg-black text-white px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-all active:scale-95 shadow-lg"
            >
              Grant pull access
            </button>
          </div>
        )}

        <div ref={endRef} />
      </main>

      {/* Input bar with the three openers */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={scanBill}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Pay a receipt
            </button>
            <button
              onClick={buyShared}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Buy for us
            </button>
            <button
              onClick={buyPersonal}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Buy for me
            </button>
            <button
              onClick={askFinances}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Our finances
            </button>
          </div>
          <div className="bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 pl-2 pr-2 py-2 flex items-center gap-3">
            <button
              onClick={scanBill}
              className="w-11 h-11 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 shrink-0"
              title="Scan a bill"
            >
              <ScanLine size={18} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
              placeholder="Message your agent…"
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
    </div>
  );
}
