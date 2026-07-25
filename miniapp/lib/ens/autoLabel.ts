/**
 * Automatic ENS label generation for bond vaults.
 *
 * Every vault is created WITH a name — register() is a mandatory call in the
 * creation batch — but the couple is never forced to invent one. Left empty,
 * the label is derived from their World usernames ("franco-maria"); when those
 * are missing or every variant is taken, a bondId-derived fallback guarantees
 * the ladder never runs dry.
 *
 * The candidates here only need to be *probably* free: register() re-checks
 * availability on-chain, so a race between the check and the transaction fails
 * the batch cleanly and the user simply retries.
 */
import { readContract } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi/config';
import { USE_MOCKS } from '@/lib/config';
import { BOND_REGISTRAR_ADDRESS, BOND_REGISTRAR_ABI } from '@/lib/contracts/registrar';
import { MAX_LABEL_BYTES, normalizeLabel } from './label';
import { mockLabelAvailable } from '@/lib/mocks/vaultStore';

/** Numbered variants tried per base before moving to the next base. */
const VARIANTS_PER_BASE = 9;

async function isAvailable(label: string): Promise<boolean> {
  if (USE_MOCKS) return mockLabelAvailable(label);
  return (await readContract(wagmiConfig, {
    address: BOND_REGISTRAR_ADDRESS,
    abi: BOND_REGISTRAR_ABI,
    functionName: 'available',
    args: [label],
  })) as boolean;
}

/**
 * World usernames allow characters our label charset does not (dots, etc.),
 * so on top of the shared normalisation we drop anything that would make
 * checkLabel reject the generated candidate.
 */
function sanitize(input: string): string {
  return normalizeLabel(input)
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function withVariants(base: string, out: string[]) {
  // Leave room for the "-9" suffix so every variant stays within DNS length.
  const trimmed = base.slice(0, MAX_LABEL_BYTES - 2).replace(/-$/, '');
  if (!trimmed) return;
  out.push(trimmed);
  for (let i = 2; i <= VARIANTS_PER_BASE; i++) out.push(`${trimmed}-${i}`);
}

/**
 * Ordered candidates: couple-name variants first, bondId fallbacks last.
 * Username order follows the bond (partner A first), so both partners'
 * devices generate the same list.
 */
export function buildAutoCandidates(
  usernameA: string | null | undefined,
  usernameB: string | null | undefined,
  bondId: `0x${string}`,
): string[] {
  const candidates: string[] = [];

  if (usernameA && usernameB) {
    withVariants(sanitize(`${usernameA}-${usernameB}`), candidates);
  }

  // bondId is unique per couple, so this base is practically never contested —
  // only a re-bonded pair (same id, new epoch) ever reaches the numbered ones.
  withVariants(`bond-${bondId.slice(2, 10).toLowerCase()}`, candidates);

  return candidates;
}

/**
 * First available candidate. An RPC failure returns the current candidate
 * instead of blocking creation: register() re-validates on-chain, and a dead
 * RPC would fail the batch anyway — same philosophy as useEnsAvailability.
 */
export async function resolveAutoLabel(
  usernameA: string | null | undefined,
  usernameB: string | null | undefined,
  bondId: `0x${string}`,
): Promise<string> {
  const candidates = buildAutoCandidates(usernameA, usernameB, bondId);
  for (const label of candidates) {
    try {
      if (await isAvailable(label)) return label;
    } catch {
      return label;
    }
  }
  return candidates[candidates.length - 1];
}

/**
 * The label the onboarding form is pre-filled with — already checked for
 * availability, so the field starts green instead of "taken".
 */
export function useSuggestedLabel(
  usernameA: string | null | undefined,
  usernameB: string | null | undefined,
  bondId: `0x${string}` | null,
) {
  const { data } = useQuery({
    queryKey: ['suggestedLabel', usernameA, usernameB, bondId],
    queryFn: () => resolveAutoLabel(usernameA, usernameB, bondId!),
    enabled: !!bondId,
    staleTime: 60_000,
    retry: false,
  });
  return data ?? null;
}
