/**
 * S-A2: Everyday conversation with your personal agent — including the
 * three-agent payment choreography (you → your agent → trustee → shared
 * account) rendered as a live status card. Clickable dummy: the trustee
 * advances on a timer; the partner approval is a visible demo control.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Landmark,
  ReceiptText,
  ScanLine,
  Sparkles,
  User,
} from 'lucide-react';
import { useAgentStore, type ChoreoStage, type Payment } from '@/lib/agent/agentStore';

// ---------------------------------------------------------------------------

function AgentAvatar() {
  return (
    <div className="w-8 h-8 shrink-0 rounded-full bg-black flex items-center justify-center">
      <Sparkles size={14} className="text-white" />
    </div>
  );
}

const CHOREO_STEPS: { stage: ChoreoStage; label: string; who: string }[] = [
  { stage: 'requested', label: 'Request sent to the trustee', who: 'Your agent' },
  { stage: 'charter_checked', label: 'Checked against your charter', who: 'Trustee' },
  { stage: 'proposal_created', label: 'Spend proposed on the shared account', who: 'Trustee' },
  { stage: 'awaiting_partner', label: 'You approved — waiting for Alice', who: 'Partners' },
  { stage: 'paid', label: 'Paid from the shared account', who: 'Safe' },
];

function stageIndex(stage: ChoreoStage): number {
  return CHOREO_STEPS.findIndex((s) => s.stage === stage);
}

/** The money shot: the three-agent system made visible in one card. */
function ChoreographyCard({ payment }: { payment: Payment }) {
  const { approveAsPartner } = useAgentStore();
  const idx = stageIndex(payment.stage);
  const isPaid = payment.stage === 'paid';

  return (
    <div className="w-full bg-white rounded-[1.75rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden animate-in fade-in zoom-in duration-500">
      {/* Header: the three actors */}
      <div className={`px-6 py-4 flex items-center justify-between ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center">
            <Sparkles size={12} className="text-white" />
          </div>
          <div className="w-6 h-px bg-gray-300" />
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center">
            <Landmark size={12} className="text-white" />
          </div>
          <div className="w-6 h-px bg-gray-300" />
          <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center">
            <User size={12} className="text-gray-500" />
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-gray-900 font-mono">{payment.amountUsdc.toFixed(2)} USDC</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{payment.vendor}</p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 py-5 space-y-3.5">
        {CHOREO_STEPS.map((s, i) => {
          const reached = i <= idx;
          const isCurrent = i === idx && !isPaid;
          return (
            <div key={s.stage} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  reached
                    ? isCurrent
                      ? 'bg-amber-500 text-white'
                      : 'bg-black text-white'
                    : 'bg-gray-100 text-gray-300'
                }`}
              >
                {reached && !isCurrent ? (
                  <Check size={11} />
                ) : (
                  <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
                )}
              </div>
              <p className={`text-[13px] font-medium flex-1 ${reached ? 'text-gray-800' : 'text-gray-400'}`}>
                {s.label}
              </p>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">{s.who}</span>
            </div>
          );
        })}
      </div>

      {/* Demo control: the partner's hito confirmation, made tangible */}
      {payment.stage === 'awaiting_partner' && (
        <div className="px-6 pb-5">
          <button
            onClick={() => approveAsPartner(payment.id)}
            className="w-full bg-amber-500 text-white px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:bg-amber-600 transition-all active:scale-95"
          >
            Demo · Alice confirms on her hito
          </button>
        </div>
      )}
      {isPaid && (
        <div className="px-6 pb-5">
          <div className="w-full bg-emerald-50 border border-emerald-100 text-emerald-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-center">
            Executed · both partners confirmed
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function AgentChatPage() {
  const router = useRouter();
  const {
    agentReady,
    partnerAgentReady,
    messages,
    payments,
    scanBill,
    startPayment,
    say,
    agentSay,
    resetAgent,
  } = useAgentStore();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentReady) router.replace('/agent/create');
  }, [agentReady, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, payments]);

  if (!agentReady) return null;

  const lastReceipt = [...messages].reverse().find((m) => m.kind === 'receipt');
  const hasOpenReceipt =
    lastReceipt &&
    !messages.some((m) => m.kind === 'choreo' && messages.indexOf(m) > messages.indexOf(lastReceipt));

  const askFinances = () => {
    say('How are our finances this month?');
    setTimeout(
      () =>
        agentSay(
          'Solid. The shared account holds 1,000 USDC, you have spent €62 of your protected budget, and Alice is at €118 of hers. No open proposals. Your emergency buffer is untouched — I know that matters to you.',
        ),
      900,
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
        <AgentAvatar />
        <div className="flex-1">
          <h1 className="text-base font-black text-gray-900 tracking-tight">Your agent</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] flex items-center gap-1.5">
            {partnerAgentReady ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-gray-400">Trustee active</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-gray-400">Waiting for Alice’s agent</span>
              </>
            )}
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
      <main className="flex-1 overflow-y-auto px-6 pb-44 space-y-4 max-w-lg w-full mx-auto">
        {messages.map((m) => {
          if (m.kind === 'choreo') {
            const p = payments[m.paymentId];
            return p ? <ChoreographyCard key={m.id} payment={p} /> : null;
          }
          if (m.kind === 'receipt') {
            return (
              <div key={m.id} className="flex items-end gap-2 animate-in fade-in zoom-in duration-500">
                <AgentAvatar />
                <div className="bg-white rounded-3xl rounded-bl-lg p-4 border border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.04)] w-[75%]">
                  <div className="flex items-center gap-3 pb-3 border-b border-dashed border-gray-200">
                    <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                      <ReceiptText size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{m.vendor}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        Scanned · tonight
                      </p>
                    </div>
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
          return m.role === 'agent' ? (
            <div key={m.id} className="flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-400">
              <AgentAvatar />
              <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-3.5 border border-gray-100 max-w-[85%]">
                <p className="text-sm text-gray-800 font-medium leading-relaxed">{m.text}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-400">
              <div className="bg-[#1A1A1A] text-white rounded-3xl rounded-br-lg px-5 py-3 max-w-[85%]">
                <p className="text-sm font-bold">{m.text}</p>
              </div>
            </div>
          );
        })}

        {/* Pay CTA under an open receipt */}
        {hasOpenReceipt && lastReceipt?.kind === 'receipt' && (
          <div className="flex flex-col gap-2 items-end animate-in fade-in duration-500">
            <button
              onClick={() => startPayment(lastReceipt.vendor, lastReceipt.amountUsdc)}
              className="bg-black text-white px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-all active:scale-95 shadow-lg"
            >
              Pay from shared account
            </button>
            <button
              onClick={() => say('Not now.')}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors px-2"
            >
              Not now
            </button>
          </div>
        )}

        <div ref={endRef} />
      </main>

      {/* Input bar */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Quick asks */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={askFinances}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              How are our finances?
            </button>
          </div>
          {/* Bar */}
          <div className="bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 pl-2 pr-5 py-2 flex items-center gap-3">
            <button
              onClick={scanBill}
              className="w-11 h-11 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 shrink-0"
              title="Scan a bill"
            >
              <ScanLine size={18} />
            </button>
            <p className="flex-1 text-sm text-gray-300 font-medium select-none">Message your agent…</p>
            <Camera size={16} className="text-gray-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
