import { useQuery } from '@tanstack/react-query';
import { useWalletAuth } from '../worldcoin/useWalletAuth';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';

export type BondView = {
    partnerA: `0x${string}`;
    partnerB: `0x${string}`;
    bondStart: bigint;
    lastClaim: bigint;
    lastMilestoneYear: bigint;
    active: boolean;
    pendingYield: bigint;
    bondId: `0x${string}`;
};

export type DissolutionRequest = {
    requester: `0x${string}`;
    requestedAt: bigint;
    active: boolean;
};

async function fetchBondDetails(
    address: `0x${string}`,
    partnerAddress: `0x${string}`,
): Promise<{ bondView: BondView; dissolutionRequest: DissolutionRequest }> {
    const contractAddr = CONTRACT_ADDRESSES.HUMAN_BOND as `0x${string}`;

    const [bondView, dissolutionRequest] = await Promise.all([
        readContract(wagmiConfig, {
            address: contractAddr,
            abi: HUMAN_BOND_ABI,
            functionName: 'getBondView',
            args: [address, partnerAddress],
        }) as Promise<BondView>,
        readContract(wagmiConfig, {
            address: contractAddr,
            abi: HUMAN_BOND_ABI,
            functionName: 'getDissolutionRequest',
            args: [address, partnerAddress],
        }) as Promise<DissolutionRequest>,
    ]);

    return { bondView, dissolutionRequest };
}

export function useMarriageDetails(partnerAddress: `0x${string}` | null) {
    const { address, isConnected } = useWalletAuth();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['bondDetails', address, partnerAddress],
        queryFn: () => fetchBondDetails(address as `0x${string}`, partnerAddress as `0x${string}`),
        enabled: isConnected && !!address && !!partnerAddress,
        staleTime: 30_000,
    });

    return {
        marriageView: data?.bondView ?? null,
        dissolutionRequest: data?.dissolutionRequest ?? null,
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch bond details') : null,
        refetch,
    };
}
