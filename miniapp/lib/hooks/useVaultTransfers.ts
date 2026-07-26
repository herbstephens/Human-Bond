/**
 * The vault's real USDC transfer history — public chain data via the World
 * Chain Blockscout instance (no wallet needed). Live only: in mock mode the
 * playground's store owns the activity list, so the query never fires.
 */
import { useQuery } from '@tanstack/react-query';
import { VAULT_ADDRESSES } from '@/lib/contracts/vault';
import { USE_MOCKS } from '@/lib/config';

const EXPLORER_API = 'https://worldchain-mainnet.explorer.alchemy.com/api/v2';

export type VaultTransfer = {
  hash: string;
  from: `0x${string}`;
  to: `0x${string}`;
  amountUsdc: number;
  /** ISO timestamp from the explorer, e.g. "2026-07-25T23:05:27.000000Z". */
  timestamp: string;
  incoming: boolean;
};

type BlockscoutTransfer = {
  transaction_hash: string;
  timestamp: string;
  from: { hash: string };
  to: { hash: string };
  total: { value: string; decimals: string | null };
};

export function useVaultTransfers(vaultAddress: `0x${string}` | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vaultTransfers', vaultAddress],
    queryFn: async (): Promise<VaultTransfer[]> => {
      const res = await fetch(
        `${EXPLORER_API}/addresses/${vaultAddress}/token-transfers?token=${VAULT_ADDRESSES.USDC}`,
      );
      if (!res.ok) throw new Error(`Explorer API ${res.status} for ${vaultAddress}`);
      const j = (await res.json()) as { items: BlockscoutTransfer[] };
      return j.items.map((t) => ({
        hash: t.transaction_hash,
        from: t.from.hash as `0x${string}`,
        to: t.to.hash as `0x${string}`,
        amountUsdc: Number(t.total.value) / 10 ** Number(t.total.decimals ?? 6),
        timestamp: t.timestamp,
        incoming: t.to.hash.toLowerCase() === vaultAddress!.toLowerCase(),
      }));
    },
    enabled: !USE_MOCKS && !!vaultAddress,
    staleTime: 30_000,
  });

  // The error travels: a dead explorer must never render as "no transfers yet",
  // which is the one thing a money screen may not lie about.
  return {
    transfers: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load transfers') : null,
    refetch,
  };
}
