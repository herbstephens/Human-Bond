import { useQuery } from '@tanstack/react-query';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';

async function fetchActiveBondCount(): Promise<bigint> {
    return readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES.HUMAN_BOND as `0x${string}`,
        abi: HUMAN_BOND_ABI,
        functionName: 'activeBondCount',
        args: [],
    }) as Promise<bigint>;
}

export function useActiveBondCount() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['activeBondCount'],
        queryFn: fetchActiveBondCount,
        staleTime: 60_000,
    });

    return {
        count: data ?? BigInt(0),
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch bond count') : null,
    };
}
