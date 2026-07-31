'use client';

/**
 * THE routing contract for the live app — ONE place decides which screen a
 * user's state belongs to. Pages call useRouteGuard('<their page>') and obey;
 * they never write their own cross-page redirects.
 *
 * Why this exists: on Jul 25 /home said "bonded+vault → go to /profile" while
 * /profile said "no agent → go to /home". Both were locally reasonable and
 * together produced a full-page navigation loop at ~4 Hz. Cross-page redirects
 * reading different sources (chain vs store) is a bug class, not a bug — this
 * hook removes the class.
 *
 * The stage ladder is strictly ordered; every stage names the ONE surface that
 * owns it:
 *
 *   loading       → stay put (nobody redirects while chain state resolves)
 *   unbonded      → /home   (propose / accept)
 *   claim-vault   → /home   (ring + "Claim your bond address" — creates Safe+ENS)
 *   ceremony      → /home   (one-time "You are bonded" moment, then CTA)
 *   create-agent  → /home   (agent CTA — /profile cannot render without it)
 *   dashboard     → /profile (and /bond/* pages live on this surface too)
 *
 * Mock mode: the guard is a no-op — the playground navigates freely, and the
 * pages keep their tiny local mock-only gates.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { USE_MOCKS } from '@/lib/config';
import { useMarriage } from '@/lib/marriage/context';
import { useBondVault } from '@/lib/hooks/useBondVault';
import { useAgentStore } from '@/lib/agent/agentStore';
import { useAgentHydrated } from '@/lib/agent/useAgentHydrated';

export type LiveStage =
  | 'loading'
  | 'unbonded'
  | 'claim-vault'
  | 'ceremony'
  | 'create-agent'
  | 'dashboard';

/** Pages that participate in the contract. /bond covers /bond/[bondId]. */
export type GuardedPage = '/home' | '/profile' | '/bond';

const CEREMONY_KEY = 'hb-bond-ceremony-seen';

export function useLiveStage(): LiveStage {
  const { isConnected, dashboard, marriageView, isDashboardLoading } = useMarriage();
  const { vault, isLoading: isVaultLoading } = useBondVault(
    (marriageView?.partnerA ?? null) as `0x${string}` | null,
    (marriageView?.partnerB ?? null) as `0x${string}` | null,
    (marriageView?.bondId ?? null) as `0x${string}` | null,
  );
  const agentReady = useAgentStore((s) => s.agentReady);
  // `agentReady` is persisted, so before rehydration it reads false and this
  // hook would answer 'create-agent' for a couple who has an agent — sending
  // them back to /home on every reload. No opinion until the store has landed.
  const agentHydrated = useAgentHydrated();

  // Read once per mount — BondedOnboarding writes it when the vault is born,
  // and every navigation remounts the calling page, so the value stays honest.
  const [ceremonySeen] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(CEREMONY_KEY) === '1',
  );

  if (!agentHydrated) return 'loading';
  if (!isConnected || isDashboardLoading) return 'loading';
  if (!dashboard?.isBonded) return 'unbonded';
  if (isVaultLoading) return 'loading';
  if (!vault?.isCreated) return 'claim-vault';
  if (!ceremonySeen) return 'ceremony';
  if (!agentReady) return 'create-agent';
  return 'dashboard';
}

/** The single surface each stage belongs to. */
function surfaceOf(stage: LiveStage): '/home' | '/profile' | null {
  if (stage === 'loading') return null; // no opinion — nobody moves
  return stage === 'dashboard' ? '/profile' : '/home';
}

/**
 * Obey the contract from a page. Returns the stage so the caller can also
 * pick its internal view from it instead of re-deriving state.
 */
export function useRouteGuard(page: GuardedPage): LiveStage {
  const router = useRouter();
  const stage = useLiveStage();

  useEffect(() => {
    if (USE_MOCKS) return; // playground routes freely
    const surface = surfaceOf(stage);
    if (!surface) return;
    // /bond/* belongs to the dashboard surface alongside /profile.
    const belongsHere = page === '/home' ? surface === '/home' : surface === '/profile';
    if (!belongsHere) router.replace(surface);
  }, [stage, page, router]);

  return stage;
}
