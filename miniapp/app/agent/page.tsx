/**
 * S-A2: Conversation with your personal agent.
 *
 * Includes: the "your agent is alive" birth celebration (morphing blob),
 * one-bubble live typing, visible reasoning on receipt scans, the funding
 * moment (grant the bond pull access — card on file), and the fair-split
 * choreography: agents compare incomes → 10/90 attribution on the books —
 * but the money itself always moves from the SHARED vault, executed by the
 * bond manager (trustee) only after both agents signed and both humans
 * released on hito. Personal agents never move funds.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ScanLine } from 'lucide-react';
import { useAgentStore, type ChoreoStage, type Payment } from '@/lib/agent/agentStore';
import { USE_MOCKS } from '@/lib/config';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { SelfieCheckOverlay } from '@/app/components/agent/SelfieCheck';
import { useMarriage } from '@/lib/marriage/context';
import { useVaultActions } from '@/lib/hooks/useVaultActions';
import { parseUsdc } from '@/lib/vault/usdc';
import { useLiveBondSync } from '@/lib/agent/useLiveBondSync';
import { useAgentHydrated } from '@/lib/agent/useAgentHydrated';
import { StageLoading } from '@/app/components/StageLoading';

// ---------------------------------------------------------------------------

/** Messages that already played their typing animation — never replay on remount/reload. */
const typedOnce = new Set<string>();

/** Types text live into a single bubble, with a caret while writing. Animates ONCE per message id. */
function TypingText({ id, text, className }: { id: string; text: string; className?: string }) {
  const [shown, setShown] = useState(() => (typedOnce.has(id) ? text.length : 0));
  useEffect(() => {
    if (shown >= text.length) {
      typedOnce.add(id);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 18);
    return () => clearTimeout(t);
  }, [shown, text.length, id]);
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
  const p = payment;
  const partner = p.partnerName ?? 'Alice';
  const isProposed = p.stage === 'proposed';
  const isPaid = p.stage === 'paid';

  const execSteps: { stage: ChoreoStage; label: string }[] = [
    {
      stage: 'confirmed',
      label: p.personal
        ? p.amountUsdc <= 200
          ? 'Authorized — phone authority, under your €200 rule'
          : 'Released — you ✓ on your hito, yours alone'
        : `Released — you ✓ on your hito · ${partner} ✓ on theirs`,
    },
    {
      stage: 'pulled',
      label: p.personal
        ? `${p.amountUsdc.toFixed(2)} USDC from your own wallet`
        : p.shareYou === 0
          ? `${p.amountUsdc.toFixed(2)} from your shared vault — booked fully to ${partner}`
          : `${p.amountUsdc.toFixed(2)} from your shared vault · booked ${p.shareYou.toFixed(2)} you / ${p.sharePartner.toFixed(2)} ${partner}`,
    },
    { stage: 'paid', label: `${p.amountUsdc.toFixed(2)} USDC paid in full to ${p.recipientEns}` },
  ];
  const order: ChoreoStage[] = ['proposed', 'confirmed', 'pulled', 'paid'];
  const idx = order.indexOf(p.stage);

  return (
    <div className="w-full bg-white rounded-[1.75rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden animate-in fade-in zoom-in duration-500">
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between gap-4 ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
            {p.personal
              ? 'Your wallet · yours alone'
              : isProposed
                ? `Your agent ↔ ${partner}’s agent · trustee executes`
                : 'Payment'}
          </p>
          <p className="text-[13px] font-black text-gray-900 mt-0.5">{p.label}</p>
          {p.detail && (
            <p className="text-[10px] font-medium text-gray-400 mt-0.5">{p.detail}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-gray-900 font-mono">{p.amountUsdc.toFixed(2)} USDC</p>
          <p className="text-[9px] font-mono font-bold text-gray-400">{p.recipientEns}</p>
        </div>
      </div>

      {/* The split — always visible (single tile for personal payments) */}
      <div className="px-6 pt-4 pb-1">
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              {p.personal ? 'From your wallet' : 'You'}
            </p>
            <p className="text-sm font-black text-gray-900 font-mono">{p.shareYou.toFixed(2)}</p>
          </div>
          {!p.personal && (
            <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{partner}</p>
              <p className="text-sm font-black text-gray-900 font-mono">{p.sharePartner.toFixed(2)}</p>
            </div>
          )}
        </div>
        {p.note && (
          <p className="mt-2.5 text-[11px] font-medium text-amber-600">↺ Renegotiated: {p.note}</p>
        )}
      </div>

      {/* Awaiting the human — actions live at the bottom bar, per chat rule #2 */}
      {isProposed && (
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Waiting for your release ↓
          </p>
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
              {p.personal
                ? 'Paid · yours alone — nothing logged against the trust'
                : p.shareYou === 0
                  ? `Paid in full · covered by ${partner} this time`
                  : 'Paid in full · settled fairly'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pull-access confirmation — the "card on file" moment, for both partners. */
function GrantCard({ partner = 'Alice' }: { partner?: string }) {
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
          <p className="text-[13px] font-medium text-gray-800">{partner} — wallet linked to the bond</p>
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
      <div className="mt-10 w-full max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-500">
        <AliveCta onClick={onHello} className="w-full px-8 py-5 rounded-[1.75rem] text-sm tracking-[0.2em]">
          Say hello
        </AliveCta>
      </div>
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
    pendingAgentSpend,
    messages,
    payments,
    celebrateBorn,
    scanBill,
    requestPay,
    payAlone,
    grantPull,
    buyShared,
    buyPersonal,
    renegotiate,
    confirmOnHito,
    say,
    chatLive,
    resetAgent,
    typingIndicator,
    agentBusy,
    _enqueue,
    lifePingDone,
    heartbeatOk,
    lifePing,
    heartbeatChecked,
    clearPendingAgentSpend,
  } = useAgentStore();
  const agentHydrated = useAgentHydrated();
  const { dashboard, marriageView } = useMarriage();
  useLiveBondSync();
  const {
    state: spendTxState,
    error: spendError,
    txError: spendTxError,
    proposeSpend,
    reset: resetSpend,
  } = useVaultActions({
    bondId: marriageView?.bondId ?? null,
    partnerA: marriageView?.partnerA ?? null,
    partnerB: marriageView?.partnerB ?? null,
    partner: (dashboard?.partner ?? null) as `0x${string}` | null,
  });
  const bonds = useAgentStore((s) => s.bonds);
  const defaultBondId = useAgentStore((s) => s.defaultBondId);
  const defaultPartner = bonds.find((b) => b.id === defaultBondId)?.partner ?? 'Alice';
  const [draft, setDraft] = useState('');
  // Openers are conversation STARTERS: gone once the human said anything, any
  // flow left artifacts (receipts/proposals/grants), or an opener was tapped.
  const [openersUsed, setOpenersUsed] = useState(false);
  const [showSelfie, setShowSelfie] = useState(false);
  const [agentSpendValidationError, setAgentSpendValidationError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The agent writes YOU first — proof-of-life ping, unprompted.
  useEffect(() => {
    if (!agentReady || bornPending || lifePingDone || messages.length === 0) return;
    const t = setTimeout(() => lifePing(), 3000);
    return () => clearTimeout(t);
  }, [agentReady, bornPending, lifePingDone, messages.length, lifePing]);

  useEffect(() => {
    // Before rehydration agentReady is false for everyone, which sent an
    // existing agent to /create — which then bounced it back here. Wait.
    if (!agentHydrated) return;
    if (!agentReady) router.replace('/agent/create');
  }, [agentHydrated, agentReady, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, payments]);

  if (!agentHydrated || !agentReady) return <StageLoading />;
  if (bornPending) return <BornOverlay onHello={celebrateBorn} />;
  if (showSelfie)
    return (
      <SelfieCheckOverlay
        onDone={() => {
          setShowSelfie(false);
          heartbeatChecked();
        }}
      />
    );

  const openProposal = Object.values(payments).find((p) => p.stage === 'proposed');
  const executing = Object.values(payments).some((p) => p.stage === 'confirmed' || p.stage === 'pulled');
  const lastAgentText = [...messages].reverse().find((m) => m.kind === 'text' && m.role === 'agent');
  const offerPay =
    !agentBusy &&
    pendingReceipt !== null &&
    lastAgentText?.kind === 'text' &&
    lastAgentText.text.startsWith('Want me to settle');
  const offerGrant =
    !agentBusy &&
    pendingReceipt !== null &&
    !pullGranted &&
    lastAgentText?.kind === 'text' &&
    (lastAgentText.text.startsWith('One thing first') || lastAgentText.text.startsWith('Before I can'));

  const askFinances = () => {
    say('How are our finances?');
    _enqueue([
      {
        type: 'text',
        text: 'Clean. The shared account settles per expense — nothing parked there. You have used €62 of your protected budget, Alice €118 of hers. Your emergency buffer is untouched; I know that matters to you.',
      },
    ]);
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // Context-aware: an affirmative answers the open question, not the void.
    const affirmative = /^(y(es|ep|eah)?|ok(ay)?|sure|ja|jo|go|do it|grant(ed)?|release)\b/i.test(text);
    const uneasy = /don.?t feel|not (feeling|good|okay)|unwohl|nicht gut/i.test(text);
    if (openProposal && !agentBusy && uneasy && !openProposal.renegotiated) {
      renegotiate(openProposal.id);
      return;
    }
    if (openProposal && !agentBusy && affirmative) {
      say(text);
      confirmOnHito(openProposal.id);
      return;
    }
    if (offerGrant && affirmative) {
      grantPull(text);
      return;
    }
    if (offerPay && affirmative) {
      requestPay(text);
      return;
    }
    // Everything else goes to the REAL agent — live model reply + routing.
    chatLive(text);
  };

  const approveAgentSpend = async () => {
    const proposal = pendingAgentSpend;
    if (!proposal) return;

    setAgentSpendValidationError(null);
    const recipient = proposal.recipient.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      setAgentSpendValidationError(`Recipient is not an EVM address: ${recipient}`);
      return;
    }
    const amount = parseUsdc(String(proposal.amountUsdc));
    if (amount === null) {
      setAgentSpendValidationError(`Invalid USDC amount from agent: ${proposal.amountUsdc}`);
      return;
    }

    resetSpend();
    const sent = await proposeSpend(recipient as `0x${string}`, amount, false);
    if (!sent) return;

    clearPendingAgentSpend();
    useAgentStore.getState().proposeShared(
      proposal.label,
      proposal.recipient,
      proposal.amountUsdc,
      proposal.detail,
      proposal.bond,
    );
  };

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header — the global ring logo (top-left, above) opens your profile */}
      <header className="px-6 pt-4 pb-4 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-base font-black text-gray-900 tracking-tight">Your agent</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${partnerAgentReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-gray-400">{partnerAgentReady ? 'Trustee active' : `Waiting for ${defaultPartner}’s agent`}</span>
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
          if (m.kind === 'grant') return <GrantCard key={m.id} partner={defaultPartner} />;
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
                    {m.typed ? <TypingText id={m.id} text={m.text} /> : m.text}
                  </p>
                </div>
              );
            }
            return (
              <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-3.5 border border-gray-100 max-w-[85%]">
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">
                    {m.typed ? <TypingText id={m.id} text={m.text} /> : m.text}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-400">
              <div className="bg-gray-500 text-white rounded-3xl rounded-br-lg px-5 py-3 max-w-[85%]">
                <p className="text-sm font-bold">{m.text}</p>
              </div>
            </div>
          );
        })}

        {/* The agent is thinking / writing */}
        {typingIndicator && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-4 border border-gray-100 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </main>

      {/* Input bar — contextual answers ALWAYS live here, right above the input */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#E8E8E8] via-[#E8E8E8] to-transparent pt-10 pb-8 px-6">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Contextual answers to the agent's open question — priority: proposal > grant > settle */}
          {pendingAgentSpend && !agentBusy ? (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-400">
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">Agent spend ready</p>
                <p className="mt-1 text-xs font-medium leading-5 text-gray-700">
                  Approve {pendingAgentSpend.amountUsdc.toFixed(2)} USDC to {pendingAgentSpend.recipient} from the{' '}
                  {pendingAgentSpend.bond.partner} bond vault.
                </p>
              </div>
              <AliveCta
                onClick={() => void approveAgentSpend()}
                disabled={spendTxState === 'sending'}
                className="w-full px-5 py-3.5 rounded-2xl text-[11px] tracking-[0.15em]"
              >
                {spendTxState === 'sending' ? 'Confirming in wallet' : 'Approve with hito'}
              </AliveCta>
              {(agentSpendValidationError || spendError || spendTxError) && (
                <p className="text-right text-[11px] text-red-500">
                  {spendTxError?.title ? `${spendTxError.title}: ` : ''}
                  {agentSpendValidationError || spendError}
                </p>
              )}
            </div>
          ) : openProposal && !agentBusy ? (
            <div className="flex gap-2 justify-end items-center animate-in fade-in slide-in-from-bottom-2 duration-400">
              {!openProposal.renegotiated && !openProposal.personal && (
                <button
                  onClick={() => renegotiate(openProposal.id)}
                  className="px-4 py-3 rounded-2xl text-[11px] font-bold text-gray-400 hover:text-gray-600 bg-white/70 border border-gray-200 transition-all"
                >
                  I don’t feel good about this
                </button>
              )}
              <AliveCta
                onClick={() => confirmOnHito(openProposal.id)}
                className="px-5 py-3.5 rounded-2xl text-[11px] tracking-[0.15em]"
              >
                Release on your hito
              </AliveCta>
            </div>
          ) : offerGrant ? (
            <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-400">
              <AliveCta onClick={() => grantPull()} className="px-5 py-3.5 rounded-2xl text-[11px] tracking-[0.15em]">
                Grant pull access
              </AliveCta>
            </div>
          ) : lifePingDone && !heartbeatOk && !agentBusy && !pendingReceipt ? (
            <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-400">
              <AliveCta onClick={() => setShowSelfie(true)} className="px-5 py-3.5 rounded-2xl text-[11px] tracking-[0.15em]">
                Do the Selfie Check · 10s
              </AliveCta>
            </div>
          ) : offerPay ? (
            <div className="flex gap-2 justify-end items-center animate-in fade-in slide-in-from-bottom-2 duration-400">
              <button
                onClick={payAlone}
                className="px-4 py-3 rounded-2xl text-[11px] font-bold text-gray-500 hover:text-gray-800 bg-white/70 border border-gray-200 transition-all"
              >
                I’ll pay it myself
              </button>
              <AliveCta onClick={() => requestPay()} className="px-5 py-3.5 rounded-2xl text-[11px] tracking-[0.15em]">
                Yes — settle it fairly
              </AliveCta>
            </div>
          ) : null}
          {/* Openers only at the very START of the conversation and while idle —
              and only in the mock playground: they trigger scripted choreographies. */}
          {USE_MOCKS &&
            !openersUsed &&
            !messages.some((m) => m.kind !== 'text' || m.role === 'user') &&
            !agentBusy && !typingIndicator && !executing && !openProposal && !offerGrant && !offerPay && !pendingReceipt && (
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => { setOpenersUsed(true); scanBill(); }}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Pay a receipt
            </button>
            <button
              onClick={() => { setOpenersUsed(true); buyShared(); }}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Buy for us
            </button>
            <button
              onClick={() => { setOpenersUsed(true); buyPersonal(); }}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Buy for me
            </button>
            <button
              onClick={() => { setOpenersUsed(true); askFinances(); }}
              className="px-4 py-2 bg-white/70 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 hover:bg-white transition-all"
            >
              Our finances
            </button>
          </div>
          )}
          <div className="bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100 pl-2 pr-2 py-2 flex items-center gap-3">
            {USE_MOCKS && (
              <button
                onClick={scanBill}
                className="w-11 h-11 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 shrink-0"
                title="Scan a bill"
              >
                <ScanLine size={18} />
              </button>
            )}
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
