import { useQuery } from '@tanstack/react-query';
import { useWalletAuth } from '@/lib/worldcoin/useWalletAuth';
import { CONTRACT_ADDRESSES, BOND_NFT_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { parseTokenMetadata, type TokenMetadata } from '@/lib/utils/parseTokenMetadata';
import { USE_MOCKS } from '@/lib/config';
import { getMockVowNFTs } from '@/lib/mocks';

export type VowNFTData = {
    tokenId: bigint;
    tokenURI: string;
    metadata: TokenMetadata;
};

async function fetchSingleBondNFT(tokenId: bigint): Promise<VowNFTData | null> {
    try {
        const tokenURI = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES.BOND_NFT as `0x${string}`,
            abi: BOND_NFT_ABI,
            functionName: 'tokenURI',
            args: [tokenId],
        }) as string;

        let metadata: TokenMetadata = {};
        try {
            metadata = await parseTokenMetadata(tokenURI);
        } catch {
            console.error(`Failed to fetch metadata for bond token ${tokenId}`);
        }

        return { tokenId, tokenURI, metadata };
    } catch (e) {
        console.error(`Failed to fetch bond token ${tokenId}`, e);
        return null;
    }
}

async function fetchAllBondNFTs(address: `0x${string}`): Promise<VowNFTData[]> {
    const bondNftAddress = CONTRACT_ADDRESSES.BOND_NFT as `0x${string}`;

    // Enumerate via contract reads instead of scanning Transfer logs from
    // genesis: the public RPC caps eth_getLogs at a 100-block range, so a
    // `fromBlock: 'earliest'` scan fails outright. These NFTs are never burned,
    // so token ids run contiguously up to totalSupply — we read the supply and
    // keep the ones this wallet currently owns (including past bonds).
    const total = await readContract(wagmiConfig, {
        address: bondNftAddress,
        abi: BOND_NFT_ABI,
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
                    address: bondNftAddress,
                    abi: BOND_NFT_ABI,
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

    const results = await Promise.all(ownedIds.map(fetchSingleBondNFT));
    const tokensData = results.filter((r): r is VowNFTData => r !== null);
    tokensData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
    return tokensData;
}

export function useVowNFT() {
    const { address, isConnected } = useWalletAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ['bondNFTs', address],
        queryFn: () => (USE_MOCKS ? getMockVowNFTs() : fetchAllBondNFTs(address as `0x${string}`)),
        enabled: USE_MOCKS || (isConnected && !!address),
        staleTime: 60_000,
    });

    return {
        vowNFTs: data ?? [],
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch Bond NFTs') : null,
    };
}
