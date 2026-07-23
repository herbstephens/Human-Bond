import { useQuery } from '@tanstack/react-query';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';

export type CooldownStatus = {
    lastDissolutionTs: bigint;
    cooldownSeconds: bigint;
    cooldownEndsAt: number;
    remainingSeconds: number;
    isActive: boolean;
};

async function fetchCooldownStatus(address: `0x${string}`): Promise<CooldownStatus> {
    const [lastDissolutionTs, cooldownSeconds] = await Promise.all([
        readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES.HUMAN_BOND as `0x${string}`,
            abi: HUMAN_BOND_ABI,
            functionName: 'lastDissolutionTimestamp',
            args: [address],
        }) as Promise<bigint>,
        readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES.HUMAN_BOND as `0x${string}`,
            abi: HUMAN_BOND_ABI,
            functionName: 'rebondCooldown',
            args: [],
        }) as Promise<bigint>,
    ]);

    const cooldownEndsAt = Number(lastDissolutionTs) + Number(cooldownSeconds);
    const remainingSeconds = Math.max(0, cooldownEndsAt - Math.floor(Date.now() / 1000));
    const isActive = lastDissolutionTs > BigInt(0) && remainingSeconds > 0;

    return { lastDissolutionTs, cooldownSeconds, cooldownEndsAt, remainingSeconds, isActive };
}

export function useCooldownStatus(address?: `0x${string}` | null, isBonded?: boolean) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['cooldownStatus', address],
        queryFn: () => fetchCooldownStatus(address as `0x${string}`),
        enabled: !!address && !isBonded,
        staleTime: 30_000,
    });

    return {
        cooldown: data ?? null,
        isLoading,
        error: error ? (error instanceof Error ? error.message : 'Failed to fetch cooldown') : null,
        refetch,
    };
}
