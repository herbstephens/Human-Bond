import { useQuery } from '@tanstack/react-query';
import { useWalletAuth } from './useWalletAuth';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';

export type UserDashboard = {
    isBonded: boolean;
    hasProposal: boolean;
    partner: `0x${string}`;
    pendingYield: bigint;
    timeBalance: bigint;
};

async function fetchDashboard(address: `0x${string}`): Promise<UserDashboard> {
    const dashboardData = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES.HUMAN_BOND as `0x${string}`,
        abi: HUMAN_BOND_ABI,
        functionName: 'getUserDashboard',
        args: [address],
    });

    return dashboardData as UserDashboard;
}

export function useUserDashboard() {
    const { address, isConnected } = useWalletAuth();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['userDashboard', address],
        queryFn: () => fetchDashboard(address as `0x${string}`),
        enabled: isConnected && !!address,
        staleTime: 15_000,
    });

    return {
        dashboard: data ?? null,
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch dashboard') : null,
        refetch,
    };
}
