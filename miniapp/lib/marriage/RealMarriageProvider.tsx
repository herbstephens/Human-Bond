'use client'

/**
 * Real implementation of the MarriageApi boundary. It wraps the existing read
 * hooks UNCHANGED and coordinates them exactly as the pages did before (e.g.
 * bond details keyed off the dashboard partner, cooldown gated by isBonded).
 * No behaviour change vs. calling the hooks directly — just one shared seam.
 */
import { useMemo } from "react";
import { MarriageContext } from "./context";
import type { MarriageApi } from "./types";
import { useWalletAuth } from "@/lib/worldcoin/useWalletAuth";
import { useUserDashboard } from "@/lib/worldcoin/useUserDashboard";
import { useProposals } from "@/lib/hooks/useProposals";
import { useMarriageDetails } from "@/lib/hooks/useMarriageDetails";
import { useCooldownStatus } from "@/lib/hooks/useCooldownStatus";
import { useActiveBondCount } from "@/lib/hooks/useActiveBondCount";

export function RealMarriageProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useWalletAuth();
  const {
    dashboard,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
  } = useUserDashboard();
  const {
    incomingProposals,
    outgoingProposal,
    hasPendingProposal,
    isLoading: isProposalsLoading,
    refetch: refetchProposals,
  } = useProposals();
  const {
    marriageView,
    dissolutionRequest,
    isLoading: isMarriageLoading,
  } = useMarriageDetails(dashboard?.partner as `0x${string}` | null);
  const { cooldown } = useCooldownStatus(
    address as `0x${string}` | null,
    dashboard?.isBonded,
  );
  const { count: activeBondCount } = useActiveBondCount();

  const value = useMemo<MarriageApi>(
    () => ({
      address: address as `0x${string}` | null,
      isConnected,
      dashboard,
      isDashboardLoading,
      refetchDashboard,
      incomingProposals,
      outgoingProposal,
      hasPendingProposal,
      isProposalsLoading,
      refetchProposals,
      marriageView,
      dissolutionRequest,
      isMarriageLoading,
      cooldown,
      activeBondCount,
    }),
    [
      address,
      isConnected,
      dashboard,
      isDashboardLoading,
      refetchDashboard,
      incomingProposals,
      outgoingProposal,
      hasPendingProposal,
      isProposalsLoading,
      refetchProposals,
      marriageView,
      dissolutionRequest,
      isMarriageLoading,
      cooldown,
      activeBondCount,
    ],
  );

  return <MarriageContext.Provider value={value}>{children}</MarriageContext.Provider>;
}
