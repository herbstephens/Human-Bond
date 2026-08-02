'use client';

/**
 * Turns whatever the human typed into an address to pay.
 *
 * A bond's whole point is that it has a NAME you can tell people — so the send
 * field has to accept that name, not only `0x…`. Three accepted shapes:
 *
 *   0x1234…abcd              a raw address, used as-is
 *   alice-ben                a bare label, completed with ENS_PARENT
 *   alice-ben.humanbond.eth  the full name
 *
 * Resolution reads `addr(node)` off the Durin L2Registry. A name that resolves
 * to the zero address is reported as unregistered rather than silently paid to
 * 0x0 — that mistake is unrecoverable.
 */
import { useQuery } from '@tanstack/react-query';
import { namehash } from 'viem';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { USE_MOCKS } from '@/lib/config';
import { ENS_PARENT, L2_REGISTRY_ADDRESS, L2_REGISTRY_ABI } from '@/lib/contracts/registrar';
import { useMockVaultStore, MOCK_VAULT } from '@/lib/mocks/vaultStore';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
/** Same rules the registrar enforces on registration (lib/ens/label.ts). */
const LABEL_RE = /^[a-z0-9-]{3,63}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

export type RecipientState =
  | 'empty'
  | 'address'      // a valid raw address
  | 'resolving'
  | 'resolved'     // a name that points somewhere
  | 'unregistered' // a well-formed name nobody owns
  | 'invalid';     // neither an address nor a plausible name

export type ResolvedRecipient = {
  state: RecipientState;
  /** Only set when the input is payable. */
  address: `0x${string}` | null;
  /** The full name, when the input was a name — for the confirmation line. */
  name: string | null;
};

/** `alice-ben` and `alice-ben.humanbond.eth` are the same name. */
function toFullName(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const label = v.endsWith(`.${ENS_PARENT}`) ? v.slice(0, -(ENS_PARENT.length + 1)) : v;
  return LABEL_RE.test(label) ? `${label}.${ENS_PARENT}` : null;
}

export function useResolveRecipient(raw: string): ResolvedRecipient {
  const trimmed = raw.trim();
  const isAddress = ADDRESS_RE.test(trimmed);
  const fullName = isAddress ? null : toFullName(trimmed);

  // Mock: the playground knows exactly one registered name — the couple's own
  // vault — so sending to it is testable without a chain.
  const mockLabel = useMockVaultStore((s) => s.ensLabel);

  const { data, isLoading } = useQuery({
    // `mockLabel` belongs in the key: it is read inside queryFn, so leaving it
    // out would serve a cached miss after the couple names their vault.
    queryKey: ['resolveName', fullName, USE_MOCKS ? mockLabel : null],
    queryFn: async () => {
      if (USE_MOCKS) {
        return fullName === `${mockLabel}.${ENS_PARENT}` ? MOCK_VAULT.ADDRESS : ZERO;
      }
      return (await readContract(wagmiConfig, {
        address: L2_REGISTRY_ADDRESS,
        abi: L2_REGISTRY_ABI,
        functionName: 'addr',
        args: [namehash(fullName as string)],
      })) as `0x${string}`;
    },
    enabled: Boolean(fullName),
    staleTime: 30_000,
  });

  if (!trimmed) return { state: 'empty', address: null, name: null };
  if (isAddress) return { state: 'address', address: trimmed as `0x${string}`, name: null };
  if (!fullName) return { state: 'invalid', address: null, name: null };
  if (isLoading || data === undefined) return { state: 'resolving', address: null, name: fullName };
  if (data === ZERO) return { state: 'unregistered', address: null, name: fullName };
  return { state: 'resolved', address: data as `0x${string}`, name: fullName };
}
