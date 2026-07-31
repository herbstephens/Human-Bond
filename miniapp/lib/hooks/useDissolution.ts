/**
 * Ending a bond — state and writes, in one place, for both modes.
 *
 * This is the migration of the dissolution logic that used to live inline in
 * `MarriageDashboard` (deleted). The contract semantics are the product here,
 * so they are named once and obeyed everywhere:
 *
 *   request  — either partner ALONE. The other has no veto, ever.
 *   cancel   — only the requester, only inside the delay.
 *   execute  — permissionless once the delay elapsed; the vault settles 50/50.
 *
 * Live reads come from the chain via `useMarriage()`; mock reads from the agent
 * store, which the playground panel drives. Callers get ONE normalised shape and
 * never branch on USE_MOCKS themselves.
 */
'use client';

import { useCallback, useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { USE_MOCKS } from '@/lib/config';
import { simulateTx } from '@/lib/mocks/mockTx';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import { sendNotification } from '@/lib/hooks/useNotify';
import { useMarriage } from '@/lib/marriage/context';
import { useAgentStore, DISSOLUTION_DELAY_MS, type Dissolution } from '@/lib/agent/agentStore';
import { explainTxError, type FriendlyTxError } from '@/lib/worldcoin/txErrors';

export type TxState = 'idle' | 'sending' | 'success' | 'error';

/** Mirrors useVaultActions: keeps the raw MiniKit payload alive up to `run`. */
class MiniKitError extends Error {
  constructor(public readonly payload: unknown) {
    super('MiniKit transaction error');
    this.name = 'MiniKitError';
  }
}

export function useDissolution(bondId: string, onDone?: () => void) {
  const [state, setState] = useState<TxState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txError, setTxError] = useState<FriendlyTxError | null>(null);

  const { address: myWallet, dashboard, dissolutionRequest, refetchDashboard } = useMarriage();
  const partnerAddress = (dashboard?.partner ?? null) as `0x${string}` | null;

  const mockDissolution = useAgentStore((s) => s.dissolutions[bondId]);
  const mockRequest = useAgentStore((s) => s.requestDissolution);
  const mockCancel = useAgentStore((s) => s.cancelDissolution);
  const mockExecute = useAgentStore((s) => s.executeDissolution);

  // The chain stores `requester` as an address and `requestedAt` in seconds;
  // the UI only ever needs "was it me" and a millisecond deadline.
  const liveDissolution: Dissolution | undefined =
    dissolutionRequest?.active
      ? {
          requester:
            dissolutionRequest.requester.toLowerCase() === myWallet?.toLowerCase()
              ? 'you'
              : 'partner',
          requestedAt: Number(dissolutionRequest.requestedAt) * 1000,
        }
      : undefined;

  const dissolution = USE_MOCKS ? mockDissolution : liveDissolution;

  const run = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        setState('sending');
        setError(null);
        setTxError(null);
        await fn();
        setState('success');
        onDone?.();
        return true;
      } catch (err) {
        setState('error');
        const friendly = explainTxError(err instanceof MiniKitError ? err.payload : err);
        setTxError(friendly);
        setError(friendly.message);
        return false;
      }
    },
    [onDone],
  );

  const request = useCallback(
    () =>
      run(async () => {
        if (USE_MOCKS) {
          await simulateTx(undefined, 'Start dissolution');
          mockRequest(bondId, 'you');
          return;
        }
        if (!partnerAddress || !myWallet) throw new Error('Missing partner or wallet information');

        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: CONTRACT_ADDRESSES.HUMAN_BOND,
              abi: HUMAN_BOND_ABI as never,
              functionName: 'requestDissolution',
              args: [partnerAddress],
            },
          ],
        });
        if (finalPayload.status === 'error') throw new MiniKitError(finalPayload);

        // They cannot stop it, but they must not learn about it from a balance.
        sendNotification(partnerAddress, 'dissolution_requested');
        refetchDashboard();
      }),
    [run, bondId, partnerAddress, myWallet, mockRequest, refetchDashboard],
  );

  const cancel = useCallback(
    () =>
      run(async () => {
        if (USE_MOCKS) {
          await simulateTx(undefined, 'Cancel dissolution');
          mockCancel(bondId);
          return;
        }
        if (!partnerAddress || !myWallet) throw new Error('Missing partner or wallet information');

        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: CONTRACT_ADDRESSES.HUMAN_BOND,
              abi: HUMAN_BOND_ABI as never,
              functionName: 'cancelDissolutionRequest',
              args: [partnerAddress],
            },
          ],
        });
        if (finalPayload.status === 'error') throw new MiniKitError(finalPayload);

        sendNotification(partnerAddress, 'dissolution_cancelled');
        refetchDashboard();
      }),
    [run, bondId, partnerAddress, myWallet, mockCancel, refetchDashboard],
  );

  const execute = useCallback(
    () =>
      run(async () => {
        if (USE_MOCKS) {
          // 'cooldown', not 'single': the contract writes lastDissolutionTimestamp,
          // so an ex-partner is unbonded AND barred from re-bonding for 30 days.
          // Landing on 'single' would show a fresh user who can propose again.
          await simulateTx('cooldown', 'Dissolve the bond');
          mockExecute(bondId);
          return;
        }
        if (!partnerAddress || !myWallet) throw new Error('Missing partner or wallet information');

        // `executeDissolution(a, b)` is permissionless and order-independent.
        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: CONTRACT_ADDRESSES.HUMAN_BOND,
              abi: HUMAN_BOND_ABI as never,
              functionName: 'executeDissolution',
              args: [myWallet, partnerAddress],
            },
          ],
        });
        if (finalPayload.status === 'error') throw new MiniKitError(finalPayload);

        sendNotification(partnerAddress, 'dissolution_executed');
        refetchDashboard();
      }),
    [run, bondId, partnerAddress, myWallet, mockExecute, refetchDashboard],
  );

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setTxError(null);
  }, []);

  return { dissolution, delayMs: DISSOLUTION_DELAY_MS, state, error, txError, request, cancel, execute, reset };
}
