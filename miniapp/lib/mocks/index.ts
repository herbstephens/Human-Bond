/**
 * Mock getters. These bridge the current scenario (from the mock store) to the
 * shapes the UI consumes. The `getMock*` functions for NFTs are called from the
 * page-scoped read hooks (useVowNFT / useMilestoneNFTs), which read the scenario
 * non-reactively inside their queryFn.
 */
import { MOCK_ADDRESS } from "@/lib/config";
import type { MarriageApi } from "@/lib/marriage/types";
import type { MilestoneNFTData } from "@/lib/hooks/useMilestoneNFTs";
import type { VowNFTData } from "@/lib/hooks/useVowNFT";
import { getScenarioData, type Scenario } from "./scenarios";
import { useMockStore } from "./mockStore";

const noop = () => {};

/** Build the full MarriageApi value for a scenario (used by MockMarriageProvider). */
export function getMockMarriageApi(scenario: Scenario): MarriageApi {
  const d = getScenarioData(scenario);
  return {
    address: MOCK_ADDRESS as `0x${string}`,
    isConnected: true,

    dashboard: d.dashboard,
    isDashboardLoading: false,
    refetchDashboard: noop,

    incomingProposals: d.incomingProposals,
    outgoingProposal: d.outgoingProposal,
    hasPendingProposal: d.hasPendingProposal,
    isProposalsLoading: false,
    refetchProposals: noop,

    marriageView: d.marriageView,
    dissolutionRequest: d.dissolutionRequest,
    isMarriageLoading: false,

    cooldown: d.cooldown,
    activeBondCount: d.activeBondCount,
  };
}

/** Current scenario's milestone NFTs (read non-reactively inside a queryFn). */
export function getMockMilestones(): MilestoneNFTData[] {
  return getScenarioData(useMockStore.getState().scenario).milestones;
}

/** Current scenario's bond/vow NFTs (read non-reactively inside a queryFn). */
export function getMockVowNFTs(): VowNFTData[] {
  return getScenarioData(useMockStore.getState().scenario).vowNFTs;
}
