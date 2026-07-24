/**
 * Lists every spend ever proposed against the couple's vault.
 *
 * Enumerated via contract reads instead of event logs: the public RPC caps
 * eth_getLogs at a 100-block range, so scanning from deployment fails outright
 * (same constraint useVowNFT works around). Spend ids are deterministic —
 * keccak256(bondId ++ nonce) — so reading spendNonce gives us the full set.
 */
import { useQuery } from '@tanstack/react-query';
import { readContract } from '@wagmi/core';
import { encodePacked, keccak256 } from 'viem';
import { wagmiConfig } from '@/lib/wagmi/config';
import { USE_MOCKS } from '@/lib/config';
import { BOND_VAULT_MODULE_ABI, VAULT_ADDRESSES } from '@/lib/contracts/vault';
import type { VaultSpend } from '@/lib/vault/types';
import { useMockVaultStore } from '@/lib/mocks/vaultStore';

/** Recompute a spend id the same way BondVaultModule.proposeSpend does. */
export function deriveSpendId(bondId: `0x${string}`, nonce: bigint): `0x${string}` {
  return keccak256(encodePacked(['bytes32', 'uint256'], [bondId, nonce]));
}

type RawSpend = readonly [
  bondId: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
  proposer: `0x${string}`,
  createdAt: bigint,
  executed: boolean,
  cancelled: boolean,
];

async function fetchSpends(
  bondId: `0x${string}`,
  partnerA: `0x${string}`,
  partnerB: `0x${string}`,
): Promise<VaultSpend[]> {
  const moduleAddress = VAULT_ADDRESSES.BOND_VAULT_MODULE;

  const nonce = (await readContract(wagmiConfig, {
    address: moduleAddress,
    abi: BOND_VAULT_MODULE_ABI,
    functionName: 'spendNonce',
    args: [bondId],
  })) as bigint;

  if (nonce === BigInt(0)) return [];

  const ids = Array.from({ length: Number(nonce) }, (_, i) => deriveSpendId(bondId, BigInt(i)));

  const spends = await Promise.all(
    ids.map(async (spendId) => {
      const [raw, approvedA, approvedB] = await Promise.all([
        readContract(wagmiConfig, {
          address: moduleAddress,
          abi: BOND_VAULT_MODULE_ABI,
          functionName: 'spends',
          args: [spendId],
        }) as Promise<RawSpend>,
        readContract(wagmiConfig, {
          address: moduleAddress,
          abi: BOND_VAULT_MODULE_ABI,
          functionName: 'approvedBy',
          args: [spendId, partnerA],
        }) as Promise<boolean>,
        readContract(wagmiConfig, {
          address: moduleAddress,
          abi: BOND_VAULT_MODULE_ABI,
          functionName: 'approvedBy',
          args: [spendId, partnerB],
        }) as Promise<boolean>,
      ]);

      const [, to, amount, proposer, createdAt, executed, cancelled] = raw;
      const proposerIsA = proposer.toLowerCase() === partnerA.toLowerCase();

      return {
        spendId,
        bondId,
        to,
        amount,
        proposer,
        createdAt,
        executed,
        cancelled,
        approvedByProposer: proposerIsA ? approvedA : approvedB,
        approvedByPartner: proposerIsA ? approvedB : approvedA,
      } satisfies VaultSpend;
    }),
  );

  // Newest first, matching how the UI reads.
  return spends.sort((a, b) => Number(b.createdAt - a.createdAt));
}

const NOOP_REFETCH = () => {};

export function useVaultSpends(
  bondId: `0x${string}` | null,
  partnerA: `0x${string}` | null,
  partnerB: `0x${string}` | null,
) {
  // Mock data comes straight from the zustand store, which is already reactive.
  // It must NOT go through React Query: spends carry bigint fields, and React
  // Query hashes query keys with JSON.stringify, which throws on BigInt.
  const mockSpends = useMockVaultStore((s) => s.spends);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vaultSpends', bondId],
    queryFn: () =>
      fetchSpends(bondId as `0x${string}`, partnerA as `0x${string}`, partnerB as `0x${string}`),
    enabled: !USE_MOCKS && !!bondId && !!partnerA && !!partnerB,
    staleTime: 10_000,
  });

  if (USE_MOCKS) {
    return { spends: mockSpends, isLoading: false, error: null, refetch: NOOP_REFETCH };
  }

  return {
    spends: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load spends') : null,
    refetch,
  };
}
