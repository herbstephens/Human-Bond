'use client';

/**
 * True once zustand/persist has replayed localStorage into the agent store.
 *
 * Why this exists: `agentReady`, `bonds` and the vault balances are persisted,
 * but the FIRST client render sees the store's initial state — `agentReady`
 * false, no bonds. Every gate that redirects on that value therefore fired
 * before the truth arrived, so a reload or deep link to /profile or /bond/[id]
 * bounced to /home even for a fully onboarded couple (reproduced 2026-07-31:
 * persisted agentReady=true, landed on /home).
 *
 * Gates must hold until this is true. `useHydrated` (lib/hooks) answers a
 * different question — "has React hydrated" — and says nothing about whether
 * the persisted state has landed.
 */
import { useSyncExternalStore } from 'react';
import { useAgentStore } from './agentStore';

export function useAgentHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAgentStore.persist.onFinishHydration(onChange),
    () => useAgentStore.persist.hasHydrated(),
    () => false,
  );
}
