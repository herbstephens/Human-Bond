/**
 * Reads the couple's shared Safe: address, whether it exists yet, USDC balance,
 * and the live spend rules.
 *
 * The address is derived rather than looked up, so the UI can show it before the
 * Safe is deployed. `isCreated` is what gates the onboarding.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { USE_MOCKS } from '@/lib/config';
import { BOND_VAULT_MODULE_ABI, ERC20_ABI, VAULT_ADDRESSES, VAULT_RULES } from '@/lib/contracts/vault';
import { BOND_REGISTRAR_ADDRESS, BOND_REGISTRAR_ABI } from '@/lib/contracts/registrar';
import { predictVaultAddress } from '@/lib/vault/safeAddress';
import type { BondVault, ForeignAsset } from '@/lib/vault/types';
import { useMockVaultStore, mockRemainingFreeAllowance, MOCK_VAULT } from '@/lib/mocks/vaultStore';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Tokens we proactively check for in the Safe.
 *
 * The Safe accepts anything, but the module can only move USDC. Rather than
 * pretend foreign assets do not exist, we look for the ones a World App user is
 * most likely to receive and surface them as unmanageable-but-present.
 */
const WATCHED_FOREIGN_TOKENS: { address: `0x${string}`; symbol: string; decimals: number }[] = [
  { address: '0x2cfc85d8e48f8EAB294be644d9E25C3030863003', symbol: 'WLD', decimals: 18 },
];

async function fetchForeignAssets(vaultAddress: `0x${string}`): Promise<ForeignAsset[]> {
  const balances = await Promise.all(
    WATCHED_FOREIGN_TOKENS.map(async (token) => {
      try {
        const balance = (await readContract(wagmiConfig, {
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [vaultAddress],
        })) as bigint;
        return { ...token, balance };
      } catch {
        return { ...token, balance: BigInt(0) };
      }
    }),
  );

  return balances.filter((asset) => asset.balance > BigInt(0));
}

async function fetchVault(
  partnerA: `0x${string}`,
  partnerB: `0x${string}`,
  bondId: `0x${string}`,
): Promise<BondVault> {
  const moduleAddress = VAULT_ADDRESSES.BOND_VAULT_MODULE;

  // The registered vault is the authority; the prediction is only a fallback for
  // the not-yet-created case, so both reads run together.
  const [registered, predicted] = await Promise.all([
    readContract(wagmiConfig, {
      address: moduleAddress,
      abi: BOND_VAULT_MODULE_ABI,
      functionName: 'vaultOf',
      args: [bondId],
    }) as Promise<`0x${string}`>,
    predictVaultAddress(partnerA, partnerB, bondId),
  ]);

  const isCreated = registered !== ZERO_ADDRESS;
  const address = isCreated ? registered : predicted;

  if (!isCreated) {
    return {
      address,
      isCreated: false,
      balance: BigInt(0),
      remainingFreeAllowance: VAULT_RULES.DAILY_FREE_LIMIT,
      smallSpendThreshold: VAULT_RULES.SMALL_SPEND_THRESHOLD,
      dailyFreeLimit: VAULT_RULES.DAILY_FREE_LIMIT,
      foreignAssets: [],
      ensLabel: null,
    };
  }

  const [balance, remainingFreeAllowance, smallSpendThreshold, dailyFreeLimit, foreignAssets, label] =
    await Promise.all([
      readContract(wagmiConfig, {
        address: moduleAddress,
        abi: BOND_VAULT_MODULE_ABI,
        functionName: 'vaultBalance',
        args: [bondId],
      }) as Promise<bigint>,
      readContract(wagmiConfig, {
        address: moduleAddress,
        abi: BOND_VAULT_MODULE_ABI,
        functionName: 'remainingFreeAllowance',
        args: [bondId],
      }) as Promise<bigint>,
      readContract(wagmiConfig, {
        address: moduleAddress,
        abi: BOND_VAULT_MODULE_ABI,
        functionName: 'smallSpendThreshold',
      }) as Promise<bigint>,
      readContract(wagmiConfig, {
        address: moduleAddress,
        abi: BOND_VAULT_MODULE_ABI,
        functionName: 'dailyFreeLimit',
      }) as Promise<bigint>,
      fetchForeignAssets(address),
      // Best-effort: an unnamed bond returns "", and a registrar read must never
      // block the whole vault from loading.
      readContract(wagmiConfig, {
        address: BOND_REGISTRAR_ADDRESS,
        abi: BOND_REGISTRAR_ABI,
        functionName: 'labelOf',
        args: [bondId],
      }).catch(() => '') as Promise<string>,
    ]);

  return {
    address,
    isCreated: true,
    balance,
    remainingFreeAllowance,
    smallSpendThreshold,
    dailyFreeLimit,
    foreignAssets,
    ensLabel: label && label.length > 0 ? label : null,
  };
}

/**
 * Pure builder: takes the store values as arguments rather than reading them
 * imperatively, so the memo below has real, lint-visible dependencies.
 */
function buildMockVault(
  isCreated: boolean,
  balance: bigint,
  foreignAssets: ForeignAsset[],
  ensLabel: string | null,
): BondVault {
  return {
    address: MOCK_VAULT.ADDRESS,
    isCreated,
    balance,
    remainingFreeAllowance: mockRemainingFreeAllowance(),
    smallSpendThreshold: VAULT_RULES.SMALL_SPEND_THRESHOLD,
    dailyFreeLimit: VAULT_RULES.DAILY_FREE_LIMIT,
    foreignAssets,
    ensLabel,
  };
}

const NOOP_REFETCH = () => {};

export function useBondVault(
  partnerA: `0x${string}` | null,
  partnerB: `0x${string}` | null,
  bondId: `0x${string}` | null,
) {
  // Subscribing to the mock store keeps the playground reactive: proposing a
  // spend updates the balance without a manual refetch. Deliberately outside
  // React Query — the vault carries bigint fields, and React Query hashes query
  // keys with JSON.stringify, which throws on BigInt.
  const mockBalance = useMockVaultStore((s) => s.balance);
  const mockCreated = useMockVaultStore((s) => s.isCreated);
  const mockForeign = useMockVaultStore((s) => s.foreignAssets);
  const mockEnsLabel = useMockVaultStore((s) => s.ensLabel);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bondVault', bondId],
    queryFn: () =>
      fetchVault(partnerA as `0x${string}`, partnerB as `0x${string}`, bondId as `0x${string}`),
    enabled: !USE_MOCKS && !!partnerA && !!partnerB && !!bondId,
    staleTime: 15_000,
  });

  const mocked = useMemo(
    () => (USE_MOCKS ? buildMockVault(mockCreated, mockBalance, mockForeign, mockEnsLabel) : null),
    [mockCreated, mockBalance, mockForeign, mockEnsLabel],
  );

  if (USE_MOCKS) {
    return { vault: mocked, isLoading: false, error: null, refetch: NOOP_REFETCH };
  }

  return {
    vault: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load vault') : null,
    refetch,
  };
}
