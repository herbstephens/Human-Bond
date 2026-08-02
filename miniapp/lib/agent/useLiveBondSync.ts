'use client';

/**
 * One vault source, mirrored into the agent store — in BOTH modes.
 *
 * Live: the chain is the truth. Partner username, ENS label and the Safe's real
 * USDC balance land in the store, so the bond page, the personal-agent chat and
 * the trustee all read the same REAL numbers. Starts at zero; nothing is seeded.
 *
 * Mock: the simulated vault (`useMockVaultStore`) is the truth, mirrored the
 * same way. Without this the playground had TWO balances that both happened to
 * read 1000 and never spoke: the money card showed `agentStore.vaultBalances`
 * while Send and the panel's "+100 USDC" mutated the vault sim. Sending money
 * left the headline untouched — the vault section looked dead because it was.
 */
import { useEffect } from 'react';
import { USE_MOCKS } from '@/lib/config';
import { useMarriage } from '@/lib/marriage/context';
import { useBondVault } from '@/lib/hooks/useBondVault';
import { useWorldProfile } from '@/lib/worldcoin/useWorldProfile';
import { useAgentStore } from '@/lib/agent/agentStore';
import { useMockVaultStore } from '@/lib/mocks/vaultStore';
import { LIVE_BOND_ID } from '@/lib/agent/liveBond';


export { LIVE_BOND_ID };

/** Returns the live vault (address, balance, ensLabel) for direct reads. */
export function useLiveBondSync() {
  const { dashboard, marriageView } = useMarriage();
  const partnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
  const partnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
  const bondId = (marriageView?.bondId ?? null) as `0x${string}` | null;
  const { vault } = useBondVault(partnerA, partnerB, bondId);
  const { profile } = useWorldProfile(dashboard?.partner ?? null);

  // Mock: mirror the vault sim onto the bond the playground actually shows.
  // The sim models ONE vault, so it maps to the default (inheritance) bond;
  // the secondary demo bonds keep their own fixed balances.
  const mockBalance = useMockVaultStore((s) => s.balance);
  const mockEnsLabel = useMockVaultStore((s) => s.ensLabel);
  useEffect(() => {
    if (!USE_MOCKS) return;
    const s = useAgentStore.getState();
    const target = s.defaultBondId;
    // A dissolved bond has no vault left to mirror. Without this the sim would
    // hand the settled money straight back, and every caller of
    // executeDissolution would have to remember to drain the sim first.
    if (s.bonds.find((b) => b.id === target)?.status === 'dissolved') return;
    const balanceUsdc = Number(mockBalance) / 1e6;
    // Same idempotence guard as live: this hook mounts on several pages at once.
    if ((s.vaultBalances[target] ?? 0) === balanceUsdc) return;
    useAgentStore.setState({
      vaultBalances: { ...s.vaultBalances, [target]: balanceUsdc },
    });
  }, [mockBalance, mockEnsLabel]);

  useEffect(() => {
    if (USE_MOCKS || !vault?.isCreated) return;
    const username = profile.username ?? 'partner';
    const partner = username.charAt(0).toUpperCase() + username.slice(1);
    const balanceUsdc = Number(vault.balance) / 1e6;

    // Idempotence guard: this hook mounts on several pages at once and re-runs on
    // every balance refetch. Writing an identical-but-new `bonds` array each time
    // re-rendered every store subscriber — visible as ghost flashes. Only write
    // when something REAL changed.
    const s = useAgentStore.getState();
    const current = s.bonds[0];
    const unchanged =
      s.bonds.length === 1 &&
      current?.id === LIVE_BOND_ID &&
      current?.partner === partner &&
      (s.vaultBalances[LIVE_BOND_ID] ?? 0) === balanceUsdc &&
      s.defaultBondId === LIVE_BOND_ID &&
      (!vault.ensLabel || s.bondEnsLabel === vault.ensLabel);
    if (unchanged) return;

    useAgentStore.setState({
      bonds: [{ id: LIVE_BOND_ID, partner, type: 'inheritance', status: 'active' }],
      vaultBalances: { [LIVE_BOND_ID]: balanceUsdc },
      investments: {},
      defaultBondId: LIVE_BOND_ID,
      ...(vault.ensLabel ? { bondEnsLabel: vault.ensLabel } : {}),
    });
  }, [vault?.isCreated, vault?.balance, vault?.ensLabel, profile.username]);

  return { vault: vault ?? null, partnerUsername: profile.username ?? null };
}
