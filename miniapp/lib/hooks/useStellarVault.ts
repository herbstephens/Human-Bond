/**
 * The bond's Stellar vault, summarised for the read-only card on /vault.
 * Live only: in mock mode there is no ENS label to resolve, so the query never fires.
 * `null` data means the bond has no verified Stellar vault (the API answered 404).
 */
import { useQuery } from '@tanstack/react-query';
import { USE_MOCKS } from '@/lib/config';
import type { StellarVaultSummary } from '@/app/api/stellar/vault/route';

export function useStellarVault(ensLabel: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stellarVault', ensLabel],
    queryFn: async (): Promise<StellarVaultSummary | null> => {
      const res = await fetch(`/api/stellar/vault?label=${encodeURIComponent(ensLabel as string)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Stellar vault lookup failed: ${res.status} ${await res.text()}`);
      return res.json();
    },
    enabled: !USE_MOCKS && !!ensLabel,
    refetchInterval: 30_000,
  });
  return { summary: data, isLoading, error };
}
