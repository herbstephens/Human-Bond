/**
 * MarriageApi — the read-only data boundary between the UI and the on-chain
 * logic. Components consume this via `useMarriage()` instead of calling the
 * underlying read hooks directly. Two implementations sit behind it:
 *   - RealMarriageProvider: wraps the existing read hooks unchanged.
 *   - MockMarriageProvider: serves scenario data, no chain/wallet involved.
 *
 * Only READS live here. Write actions stay inline in their components (they are
 * not testable outside production, so they are not refactored). New actions can
 * be added to this interface incrementally as they are built.
 *
 * Shapes are reused verbatim from the hooks — never redefined here.
 */
import type { ProposalInfo } from "@/lib/hooks/useProposals";
import type { UserDashboard } from "@/lib/worldcoin/useUserDashboard";
import type { BondView, DissolutionRequest } from "@/lib/hooks/useMarriageDetails";
import type { CooldownStatus } from "@/lib/hooks/useCooldownStatus";

export interface MarriageApi {
  // --- wallet ---
  address: `0x${string}` | null;
  isConnected: boolean;

  // --- dashboard (getUserDashboard) ---
  dashboard: UserDashboard | null;
  isDashboardLoading: boolean;
  refetchDashboard: () => void;

  // --- proposals ---
  incomingProposals: ProposalInfo[];
  outgoingProposal: ProposalInfo | null;
  hasPendingProposal: boolean;
  isProposalsLoading: boolean;
  refetchProposals: () => void;

  // --- bond details ---
  marriageView: BondView | null;
  dissolutionRequest: DissolutionRequest | null;
  isMarriageLoading: boolean;

  // --- misc reads ---
  cooldown: CooldownStatus | null;
  activeBondCount: bigint;
}
