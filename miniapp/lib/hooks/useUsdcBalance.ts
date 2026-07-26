/**
 * The viewer's OWN wallet USDC balance — one balanceOf on Worldchain.
 * Live only: in mock mode the playground's vault store owns the numbers,
 * so the query never fires and callers fall back to their mock source.
 */
import { useQuery } from '@tanstack/react-query';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { VAULT_ADDRESSES } from '@/lib/contracts/vault';
import { USE_MOCKS } from '@/lib/config';

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function useUsdcBalance(address: `0x${string}` | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['usdcBalance', address],
    queryFn: async () =>
      (await readContract(wagmiConfig, {
        address: VAULT_ADDRESSES.USDC,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      })) as bigint,
    enabled: !USE_MOCKS && !!address,
    staleTime: 15_000,
  });
  return { balance: data ?? null, isLoading, refetch };
}
