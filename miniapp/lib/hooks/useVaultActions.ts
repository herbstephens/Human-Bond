/**
 * Write actions against the bond vault.
 *
 * Every action goes through MiniKit.sendTransaction, matching how the rest of
 * the app writes to chain. In mock mode they drive the simulated vault store
 * instead, so the whole flow is exercisable without a deploy.
 */
import { useCallback, useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { USE_MOCKS } from '@/lib/config';
import { simulateTx } from '@/lib/mocks/mockTx';
import { BOND_VAULT_MODULE_ABI, VAULT_ADDRESSES } from '@/lib/contracts/vault';
import { buildCreateVaultTx } from '@/lib/vault/createVault';
import { useMockVaultStore } from '@/lib/mocks/vaultStore';
import { sendNotification } from '@/lib/hooks/useNotify';
import { formatUsdc } from '@/lib/vault/usdc';

export type TxState = 'idle' | 'sending' | 'success' | 'error';

type UseVaultActionsArgs = {
  bondId: `0x${string}` | null;
  partnerA: `0x${string}` | null;
  partnerB: `0x${string}` | null;
  /** The other partner, for notifications. */
  partner: `0x${string}` | null;
  onDone?: () => void;
};

export function useVaultActions({ bondId, partnerA, partnerB, partner, onDone }: UseVaultActionsArgs) {
  const [state, setState] = useState<TxState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mockPropose = useMockVaultStore((s) => s.proposeSpend);
  const mockApprove = useMockVaultStore((s) => s.approveSpend);
  const mockCancel = useMockVaultStore((s) => s.cancelSpend);
  const mockCreate = useMockVaultStore((s) => s.createVault);

  /**
   * Runs an action and reports whether it succeeded.
   *
   * Returning the outcome lets callers react in their event handler (close a
   * dialog, clear a form) instead of watching `state` from an effect, which
   * would be interaction logic misplaced as synchronization.
   */
  const run = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        setState('sending');
        setError(null);
        await fn();
        setState('success');
        onDone?.();
        return true;
      } catch (err) {
        setState('error');
        setError(err instanceof Error ? err.message : 'Transaction failed');
        return false;
      }
    },
    [onDone],
  );

  /**
   * @param ensLabel Optional, already-normalised ENS label. When present, the couple's
   *   `<label>.humanbond.eth` subname is claimed as the third call of the same batch — so
   *   the wallet and the name come into existence together, or not at all.
   */
  const createVault = useCallback(
    (ensLabel?: string) =>
      run(async () => {
        if (USE_MOCKS) {
          await simulateTx(undefined, ensLabel ? `Create wallet + name it ${ensLabel}` : "Create shared wallet");
          mockCreate(ensLabel);
          return;
        }
        if (!partnerA || !partnerB || !bondId) throw new Error('Missing bond information');

        const { transaction } = await buildCreateVaultTx(partnerA, partnerB, bondId, ensLabel);
        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: transaction as never,
        });
        if (finalPayload.status === 'error') throw new Error('Could not create the shared wallet');

        // Either partner can create it, so the other one needs to hear about it.
        if (partner) sendNotification(partner, 'vault_created');
      }),
    [run, bondId, partnerA, partnerB, partner, mockCreate],
  );

  /**
   * @param willExecuteImmediately Whether the caller expects this to clear the
   *   small-spend rules and settle on the spot. Only decides which notification
   *   the partner gets — telling them "your signature is needed" for a payment
   *   that already went through is alarming and wrong. It is a client-side
   *   prediction from the same live rules the form previews, so a simultaneous
   *   spend by the partner could in theory make it stale; the money is unaffected
   *   either way, since the contract is the one enforcing the limits.
   */
  const proposeSpend = useCallback(
    (to: `0x${string}`, amount: bigint, willExecuteImmediately: boolean) =>
      run(async () => {
        const notify = (spendId?: `0x${string}`) => {
          if (!partner) return;
          sendNotification(
            partner,
            willExecuteImmediately ? 'vault_spend_executed' : 'vault_spend_proposed',
            { amount: formatUsdc(amount), token: 'USDC', spendId },
          );
        };

        if (USE_MOCKS) {
          await simulateTx(undefined, `Send ${formatUsdc(amount)} USDC`);
          const { spendId, executed } = mockPropose(to, amount);
          // The simulated store is authoritative here, so prefer its answer.
          if (executed && partner) {
            sendNotification(partner, 'vault_spend_executed', {
              amount: formatUsdc(amount),
              token: 'USDC',
            });
          } else {
            notify(spendId);
          }
          return;
        }

        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: VAULT_ADDRESSES.BOND_VAULT_MODULE,
              abi: BOND_VAULT_MODULE_ABI as never,
              functionName: 'proposeSpend',
              args: [to, amount.toString()],
            },
          ],
        });
        if (finalPayload.status === 'error') throw new Error('Transaction failed');

        // No spendId on chain yet: sendTransaction resolves on submission, not
        // on mining, so the deep link falls back to the vault screen.
        notify();
      }),
    [run, partner, mockPropose],
  );

  const approveSpend = useCallback(
    (spendId: `0x${string}`) =>
      run(async () => {
        if (USE_MOCKS) {
          await simulateTx(undefined, "Approve & send");
          mockApprove(spendId);
          if (partner) sendNotification(partner, 'vault_spend_approved');
          return;
        }

        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: VAULT_ADDRESSES.BOND_VAULT_MODULE,
              abi: BOND_VAULT_MODULE_ABI as never,
              functionName: 'approveSpend',
              args: [spendId],
            },
          ],
        });
        if (finalPayload.status === 'error') throw new Error('Transaction failed');
        if (partner) sendNotification(partner, 'vault_spend_approved');
      }),
    [run, partner, mockApprove],
  );

  const cancelSpend = useCallback(
    (spendId: `0x${string}`) =>
      run(async () => {
        if (USE_MOCKS) {
          await simulateTx(undefined, "Cancel payment");
          mockCancel(spendId);
          if (partner) sendNotification(partner, 'vault_spend_cancelled');
          return;
        }

        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: VAULT_ADDRESSES.BOND_VAULT_MODULE,
              abi: BOND_VAULT_MODULE_ABI as never,
              functionName: 'cancelSpend',
              args: [spendId],
            },
          ],
        });
        if (finalPayload.status === 'error') throw new Error('Transaction failed');
        if (partner) sendNotification(partner, 'vault_spend_cancelled');
      }),
    [run, partner, mockCancel],
  );

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { state, error, createVault, proposeSpend, approveSpend, cancelSpend, reset };
}
