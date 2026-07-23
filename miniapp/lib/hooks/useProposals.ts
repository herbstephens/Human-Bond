import { useQuery } from '@tanstack/react-query';
import { useWalletAuth } from '../worldcoin/useWalletAuth';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';

export type ProposalInfo = {
    proposer: `0x${string}`;
    proposed: `0x${string}`;
    timestamp: bigint;
};

export type ProposalsData = {
    incomingProposals: ProposalInfo[];
    outgoingProposal: ProposalInfo | null;
    hasPendingProposal: boolean;
};

async function fetchProposals(address: `0x${string}`): Promise<ProposalsData> {
    const contractAddr = CONTRACT_ADDRESSES.HUMAN_BOND as `0x${string}`;

    const [incomingProposals, hasPending] = await Promise.all([
        readContract(wagmiConfig, {
            address: contractAddr,
            abi: HUMAN_BOND_ABI,
            functionName: 'getIncomingProposals',
            args: [address],
        }) as Promise<ProposalInfo[]>,
        readContract(wagmiConfig, {
            address: contractAddr,
            abi: HUMAN_BOND_ABI,
            functionName: 'hasPendingProposal',
            args: [address],
        }) as Promise<boolean>,
    ]);

    let outgoingProposal: ProposalInfo | null = null;
    if (hasPending) {
        outgoingProposal = await readContract(wagmiConfig, {
            address: contractAddr,
            abi: HUMAN_BOND_ABI,
            functionName: 'getProposal',
            args: [address],
        }) as ProposalInfo;
    }

    return { incomingProposals, outgoingProposal, hasPendingProposal: hasPending };
}

export function useProposals() {
    const { address, isConnected } = useWalletAuth();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['proposals', address],
        queryFn: () => fetchProposals(address as `0x${string}`),
        enabled: isConnected && !!address,
        staleTime: 30_000,
    });

    return {
        incomingProposals: data?.incomingProposals ?? [],
        outgoingProposal: data?.outgoingProposal ?? null,
        hasPendingProposal: data?.hasPendingProposal ?? false,
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch proposals') : null,
        refetch,
    };
}
