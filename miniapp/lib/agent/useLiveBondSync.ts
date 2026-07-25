'use client';

/**
 * Live mode: the chain is the source of truth. Mirror the ONE real bond —
 * partner username, ENS label, on-chain USDC balance of the Safe — into the
 * agent store, so the bond page, the personal-agent chat and the trustee all
 * read the same REAL numbers. Starts at zero: whatever actually sits in the
 * Safe is the balance, nothing is seeded. Mock mode: no-op, the playground
 * fixtures stay.
 */
import { useEffect } from 'react';
import { USE_MOCKS } from '@/lib/config';
import { useMarriage } from '@/lib/marriage/context';
import { useBondVault } from '@/lib/hooks/useBondVault';
import { useWorldProfile } from '@/lib/worldcoin/useWorldProfile';
import { useAgentStore } from '@/lib/agent/agentStore';

export const LIVE_BOND_ID = 'main';

/** Returns the live vault (address, balance, ensLabel) for direct reads. */
export function useLiveBondSync() {
  const { dashboard, marriageView } = useMarriage();
  const partnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
  const partnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
  const bondId = (marriageView?.bondId ?? null) as `0x${string}` | null;
  const { vault } = useBondVault(partnerA, partnerB, bondId);
  const { profile } = useWorldProfile(dashboard?.partner ?? null);

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
