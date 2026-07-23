import { useQuery } from '@tanstack/react-query';
import { useWalletAuth } from '@/lib/worldcoin/useWalletAuth';
import { CONTRACT_ADDRESSES, MILESTONE_NFT_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { parseTokenMetadata, type TokenMetadata } from '@/lib/utils/parseTokenMetadata';
import { USE_MOCKS } from '@/lib/config';
import { getMockMilestones } from '@/lib/mocks';

export type MilestoneNFTData = {
    tokenId: bigint;
    year: bigint;
    tokenURI: string;
    metadata: TokenMetadata;
};

async function fetchSingleMilestone(tokenId: bigint): Promise<MilestoneNFTData> {
    const contractAddr = CONTRACT_ADDRESSES.MILESTONE_NFT as `0x${string}`;

    const [year, tokenURI] = await Promise.all([
        readContract(wagmiConfig, {
            address: contractAddr,
            abi: MILESTONE_NFT_ABI,
            functionName: 'tokenYear',
            args: [tokenId],
        }) as Promise<bigint>,
        readContract(wagmiConfig, {
            address: contractAddr,
            abi: MILESTONE_NFT_ABI,
            functionName: 'tokenURI',
            args: [tokenId],
        }) as Promise<string>,
    ]);

    let metadata: TokenMetadata = {};
    try {
        metadata = await parseTokenMetadata(tokenURI);
    } catch (e) {
        console.error(`Failed to fetch metadata for milestone token ${tokenId}:`, e);
    }

    return { tokenId, year, tokenURI, metadata };
}

async function fetchAllMilestones(address: `0x${string}`): Promise<MilestoneNFTData[]> {
    const milestoneAddress = CONTRACT_ADDRESSES.MILESTONE_NFT as `0x${string}`;

    // See useVowNFT: enumerate via contract reads instead of a genesis-wide
    // eth_getLogs scan (capped at 100 blocks on the public RPC). No burns here,
    // so ids are contiguous up to totalSupply.
    const total = await readContract(wagmiConfig, {
        address: milestoneAddress,
        abi: MILESTONE_NFT_ABI,
        functionName: 'totalSupply',
    }) as bigint;

    if (total === BigInt(0)) return [];

    // Scan [0, total] inclusive to cover both 0- and 1-based token ids;
    // ownerOf reverts for a non-existent id, which we treat as "not owned".
    const candidateIds = Array.from({ length: Number(total) + 1 }, (_, i) => BigInt(i));
    const ownerChecks = await Promise.all(
        candidateIds.map(async (tokenId) => {
            try {
                const owner = await readContract(wagmiConfig, {
                    address: milestoneAddress,
                    abi: MILESTONE_NFT_ABI,
                    functionName: 'ownerOf',
                    args: [tokenId],
                }) as `0x${string}`;
                return owner.toLowerCase() === address.toLowerCase() ? tokenId : null;
            } catch {
                return null;
            }
        }),
    );

    const ownedIds = ownerChecks.filter((id): id is bigint => id !== null);
    if (ownedIds.length === 0) return [];

    const milestones = await Promise.all(ownedIds.map(fetchSingleMilestone));
    milestones.sort((a, b) => Number(b.year - a.year));
    return milestones;
}

export function useMilestoneNFTs() {
    const { address, isConnected } = useWalletAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ['milestoneNFTs', address],
        queryFn: () => (USE_MOCKS ? getMockMilestones() : fetchAllMilestones(address as `0x${string}`)),
        enabled: USE_MOCKS || (isConnected && !!address),
        staleTime: 60_000,
    });

    return {
        milestones: data ?? [],
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch Milestone NFTs') : null,
    };
}
