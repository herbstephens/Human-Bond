'use client';

import { useState } from 'react';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { useAgentStore } from '@/lib/agent/agentStore';
import { useVaultActions } from '@/lib/hooks/useVaultActions';
import { useMarriage } from '@/lib/marriage/context';
import { parseUsdc } from '@/lib/vault/usdc';

type AgentAction =
  | {
      type: 'propose_spend';
      bondId: string;
      label: string;
      recipient: string;
      amountUsdc: number;
      detail: string | null;
    }
  | {
      type: 'cancel_spend';
      spendId: `0x${string}`;
      reason: string;
    };

type ChatResult = {
  say: string;
  action: AgentAction | null;
};

type ProposedSpendAction = Extract<AgentAction, { type: 'propose_spend' }>;
type TestState = 'idle' | 'calling' | 'awaiting-approval' | 'approving' | 'complete' | 'failed';

const TEST_BOND = {
  id: 'alice',
  partner: 'Alice',
  type: 'inheritance',
  isDefault: true,
  vaultBalanceUsdc: 1000,
};
const TEST_AMOUNT_USDC = '0.1';
const TEST_RECIPIENT = '0x9153f2d7fa5d47945dfd81aa709526073499d635' as const;

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    const parsed = JSON.parse(text) as { error?: string };
    throw new Error(parsed.error ?? `Request failed with HTTP ${response.status}`);
  }
  return JSON.parse(text) as T;
}

export function ZeroGHooksTestClient() {
  const { dashboard, marriageView } = useMarriage();
  const livePartnerAddr = (dashboard?.partner ?? null) as `0x${string}` | null;
  const partnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
  const partnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
  const bondId = (marriageView?.bondId ?? null) as `0x${string}` | null;
  const {
    state: txState,
    error: vaultActionError,
    txError,
    proposeSpend,
    reset: resetVaultAction,
  } = useVaultActions({
    bondId,
    partnerA,
    partnerB,
    partner: livePartnerAddr,
  });
  const payments = useAgentStore((s) => s.payments);
  const [state, setState] = useState<TestState>('idle');
  const [result, setResult] = useState<ChatResult | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ProposedSpendAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const latestPayment = Object.values(payments).at(-1) ?? null;

  const log = (message: string) =>
    setEvents((current) => [...current, `${new Date().toLocaleTimeString()} - ${message}`]);

  const run = async () => {
    setState('calling');
    setResult(null);
    setPendingApproval(null);
    setError(null);
    setEvents([]);
    resetVaultAction();
    log('Sending shared-spend prompt to /api/agent/chat');

    try {
      const completed = await responseJson<ChatResult>(
        await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              name: 'Ben',
              income: 'EUR 4k+',
              budget: 'EUR 500',
              threshold: 'Over EUR 200',
              stress: 'Stress, instantly',
              fear: 'No emergency buffer',
            },
            facts: ['Cash flow is tight this month.'],
            rules: ['Shared dinners for both partners can be paid from the shared vault.'],
            bonds: [TEST_BOND],
            history: [],
            userText: `Pay ${TEST_AMOUNT_USDC} USDC to ${TEST_RECIPIENT} for dinner for us tonight.`,
          }),
        }),
      );

      setResult(completed);
      if (completed.action?.type !== 'propose_spend') {
        throw new Error(`Expected propose_spend, got ${completed.action?.type ?? 'no action'}`);
      }
      log('propose_spend action returned by the chat route');
      if (completed.action.recipient.toLowerCase() !== TEST_RECIPIENT.toLowerCase()) {
        throw new Error(`Expected recipient ${TEST_RECIPIENT}, got ${completed.action.recipient}`);
      }
      setPendingApproval(completed.action);
      log('Approval request created');
      setState('awaiting-approval');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '0G hook test failed';
      setError(message);
      log(`FAILED: ${message}`);
      setState('failed');
    }
  };

  const approveWithHito = async () => {
    const action = pendingApproval;
    if (!action) return;
    setState('approving');
    setError(null);
    resetVaultAction();

    try {
      const rawAmount = parseUsdc(String(action.amountUsdc));
      if (rawAmount === null) {
        throw new Error(`Invalid USDC amount from propose_spend: ${action.amountUsdc}`);
      }
      log('Submitting BondVaultModule.proposeSpend through MiniKit');
      const sent = await proposeSpend(TEST_RECIPIENT, rawAmount, false);
      if (!sent) throw new Error('MiniKit proposeSpend transaction did not complete');
      log('MiniKit proposeSpend transaction accepted');
      useAgentStore.getState().proposeShared(
        action.label,
        action.recipient,
        action.amountUsdc,
        action.detail ?? undefined,
        { id: action.bondId, partner: TEST_BOND.partner },
      );
      log('Local proposal choreography queued in agent store');
      setPendingApproval(null);
      setState('complete');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'hito approval failed';
      setError(message);
      log(`FAILED: ${message}`);
      setState('failed');
    }
  };

  return (
    <main className="min-h-screen bg-[#171512] px-5 py-12 text-[#f3eadb]">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development test
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">0G chat tool hook</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          Calls the personal agent chat route with one shared dinner request.
        </p>

        {pendingApproval ? (
          <AliveCta
            onClick={approveWithHito}
            disabled={state === 'approving' || txState === 'sending'}
            className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
          >
            {state === 'approving' || txState === 'sending' ? 'Confirming in wallet' : 'Approve with hito'}
          </AliveCta>
        ) : (
          <AliveCta
            onClick={run}
            disabled={state === 'calling'}
            className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
          >
            {state === 'calling' ? 'Calling 0G router' : 'Trigger propose_spend'}
          </AliveCta>
        )}

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Status
            </span>
            <span className="font-mono text-xs text-amber-300">{state}</span>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              MiniKit transaction
            </p>
            <p className="mt-1 font-mono text-xs text-amber-300">{txState}</p>
            <p className="mt-2 break-all font-mono text-xs text-[#b9ad9b]">
              proposeSpend({TEST_RECIPIENT}, {TEST_AMOUNT_USDC} USDC)
            </p>
          </div>

          {error && <p className="mt-5 break-words text-sm text-red-400">{error}</p>}
          {vaultActionError && (
            <p className="mt-3 break-words text-sm text-red-400">
              {txError?.title ? `${txError.title}: ` : ''}
              {vaultActionError}
            </p>
          )}

          {pendingApproval && (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
                Agent approval request
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#f3eadb]">
                Approve spending {pendingApproval.amountUsdc.toFixed(2)} USDC to{' '}
                <span className="break-all font-mono text-xs text-amber-100">{pendingApproval.recipient}</span> for
                the agent.
              </p>
            </div>
          )}

          {result && (
            <div className="mt-5 space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                  Agent said
                </p>
                <p className="mt-1 text-sm leading-6 text-[#f3eadb]">{result.say}</p>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                  Action
                </p>
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/30 p-4 font-mono text-xs text-[#b9ad9b]">
                  {JSON.stringify(result.action, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {latestPayment && (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
                Latest local proposal
              </p>
              <p className="mt-2 text-sm font-semibold text-[#f3eadb]">{latestPayment.label}</p>
              <p className="mt-1 font-mono text-xs text-[#b9ad9b]">
                {latestPayment.amountUsdc.toFixed(2)} USDC to {latestPayment.recipientEns} · stage{' '}
                {latestPayment.stage}
              </p>
            </div>
          )}

          <ol className="mt-6 space-y-2 border-t border-white/10 pt-5">
            {events.length === 0 ? (
              <li className="font-mono text-xs text-[#6f665a]">No test started.</li>
            ) : (
              events.map((event, index) => (
                <li key={`${index}-${event}`} className="font-mono text-xs text-[#b9ad9b]">
                  {event}
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
    </main>
  );
}
