/**
 * Live availability check for a bond's ENS label.
 *
 * Debounces the raw input, normalises it (lib/ens/label), then asks the registrar
 * whether it is free. In mock mode it consults the simulated taken-set instead, so
 * the whole naming flow — including the "that name is taken" branch — is testable
 * locally with no chain.
 *
 * The contract is the authority: a name can still be taken between this check and
 * the transaction, in which case register() reverts and the batch fails cleanly.
 * This is a UX affordance, not a guarantee.
 */
import { useEffect, useMemo, useState } from 'react';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { USE_MOCKS } from '@/lib/config';
import { BOND_REGISTRAR_ADDRESS, BOND_REGISTRAR_ABI } from '@/lib/contracts/registrar';
import { checkLabel } from '@/lib/ens/label';
import { mockLabelAvailable } from '@/lib/mocks/vaultStore';

export type AvailabilityStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

export type Availability = {
  status: AvailabilityStatus;
  /** Normalised label, only meaningful once status is 'available'. */
  label: string | null;
  /** Human-readable reason when status is 'invalid'. */
  reason: string | null;
};

const IDLE: Availability = { status: 'idle', label: null, reason: null };

type Parsed =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'valid'; label: string };

type Resolved = { label: string; status: 'available' | 'taken' | 'error' };

export function useEnsAvailability(rawInput: string): Availability {
  // Everything synchronous is derived, not stored — no setState in an effect.
  const parsed = useMemo<Parsed>(() => {
    if (rawInput.trim().length === 0) return { kind: 'idle' };
    const c = checkLabel(rawInput);
    return c.ok ? { kind: 'valid', label: c.label } : { kind: 'invalid', reason: c.reason };
  }, [rawInput]);

  // Only the async outcome lives in state, and it is set inside the debounced callback.
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (parsed.kind !== 'valid') return;
    const label = parsed.label;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const available = USE_MOCKS
          ? mockLabelAvailable(label)
          : ((await readContract(wagmiConfig, {
              address: BOND_REGISTRAR_ADDRESS,
              abi: BOND_REGISTRAR_ABI,
              functionName: 'available',
              args: [label],
            })) as boolean);
        if (!cancelled) setResolved({ label, status: available ? 'available' : 'taken' });
      } catch {
        // A read failure must not block naming — the on-chain register() is the backstop.
        if (!cancelled) setResolved({ label, status: 'error' });
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsed]);

  return useMemo<Availability>(() => {
    if (parsed.kind === 'idle') return IDLE;
    if (parsed.kind === 'invalid') return { status: 'invalid', label: null, reason: parsed.reason };
    // Valid label: show the resolved answer only if it is for THIS label, else we are still checking.
    if (resolved && resolved.label === parsed.label) {
      return { status: resolved.status, label: parsed.label, reason: null };
    }
    return { status: 'checking', label: parsed.label, reason: null };
  }, [parsed, resolved]);
}
