/**
 * Mock scenario definitions. Each scenario is a full, self-consistent snapshot
 * of every read the UI consumes, expressed in the exact shapes the real hooks
 * return. Time-relative values are computed fresh on each call so countdowns
 * and "married since" stay sensible no matter how long the dev server runs.
 *
 * This module is pure (no side effects) so it tree-shakes out of production.
 * BigInt literals (`1n`) are avoided because the project targets ES2017.
 */
import { MOCK_ADDRESS, MOCK_PARTNER } from "@/lib/config";
import type { ProposalInfo } from "@/lib/hooks/useProposals";
import type { UserDashboard } from "@/lib/worldcoin/useUserDashboard";
import type { BondView, DissolutionRequest } from "@/lib/hooks/useMarriageDetails";
import type { CooldownStatus } from "@/lib/hooks/useCooldownStatus";
import type { MilestoneNFTData } from "@/lib/hooks/useMilestoneNFTs";
import type { VowNFTData } from "@/lib/hooks/useVowNFT";

export type Scenario =
  | "single"
  | "proposalReceived"
  | "proposalSent"
  | "married"
  | "cooldown"
  | "dissolutionPending";

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "single", label: "Soltero" },
  { id: "proposalReceived", label: "Propuesta recibida" },
  { id: "proposalSent", label: "Propuesta enviada" },
  { id: "married", label: "Casado" },
  { id: "cooldown", label: "Cooldown" },
  { id: "dissolutionPending", label: "Disolución pendiente" },
];

export const DEFAULT_SCENARIO: Scenario = "married";

export type ScenarioData = {
  dashboard: UserDashboard | null;
  incomingProposals: ProposalInfo[];
  outgoingProposal: ProposalInfo | null;
  hasPendingProposal: boolean;
  marriageView: BondView | null;
  dissolutionRequest: DissolutionRequest | null;
  cooldown: CooldownStatus | null;
  activeBondCount: bigint;
  milestones: MilestoneNFTData[];
  vowNFTs: VowNFTData[];
};

const self = MOCK_ADDRESS as `0x${string}`;
const partner = MOCK_PARTNER as `0x${string}`;
const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

const B = (n: number | string): bigint => BigInt(n);
const ONE_TIME = B("1000000000000000000"); // 1 TIME (1e18)
const TIME = (n: number): bigint => B(n) * ONE_TIME;
const DAY = 86_400;

const nowSec = (): bigint => B(Math.floor(Date.now() / 1000));

const placeholderImage = (label: string) =>
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#1A1A1A"/><text x="50%" y="50%" fill="#f5d0c5" font-family="sans-serif" font-size="40" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`,
  );

function bondNFT(): VowNFTData {
  return {
    tokenId: B(7),
    tokenURI: "mock://bond/7",
    metadata: {
      name: "Bond Certificate #7",
      description: "Soulbound proof of an on-chain bond.",
      image: placeholderImage("Vow NFT"),
      attributes: [
        { trait_type: "partnerA", value: self },
        { trait_type: "partnerB", value: partner },
        { trait_type: "bondId", value: "0xbond...7" },
      ],
    },
  };
}

function milestoneNFTs(): MilestoneNFTData[] {
  return [
    {
      tokenId: B(21),
      year: B(2),
      tokenURI: "mock://milestone/21",
      metadata: {
        name: "Anniversary — Year 2",
        description: "Second year milestone.",
        image: placeholderImage("Year 2"),
        attributes: [{ trait_type: "Year", value: 2 }],
      },
    },
    {
      tokenId: B(14),
      year: B(1),
      tokenURI: "mock://milestone/14",
      metadata: {
        name: "Anniversary — Year 1",
        description: "First year milestone.",
        image: placeholderImage("Year 1"),
        attributes: [{ trait_type: "Year", value: 1 }],
      },
    },
  ];
}

const emptyDashboard = (over: Partial<UserDashboard> = {}): UserDashboard => ({
  isBonded: false,
  hasProposal: false,
  partner: ZERO,
  pendingYield: B(0),
  timeBalance: B(0),
  ...over,
});

const inactiveCooldown = (): CooldownStatus => ({
  lastDissolutionTs: B(0),
  cooldownSeconds: B(30 * DAY),
  cooldownEndsAt: 0,
  remainingSeconds: 0,
  isActive: false,
});

export function getScenarioData(scenario: Scenario): ScenarioData {
  const now = nowSec();
  const activeBondCount = B(1342);

  switch (scenario) {
    case "single":
      return {
        dashboard: emptyDashboard(),
        incomingProposals: [],
        outgoingProposal: null,
        hasPendingProposal: false,
        marriageView: null,
        dissolutionRequest: null,
        cooldown: inactiveCooldown(),
        activeBondCount,
        milestones: [],
        vowNFTs: [],
      };

    case "proposalReceived":
      return {
        dashboard: emptyDashboard(),
        incomingProposals: [
          { proposer: partner, proposed: self, timestamp: now - B(2 * 3600) },
        ],
        outgoingProposal: null,
        hasPendingProposal: false,
        marriageView: null,
        dissolutionRequest: null,
        cooldown: inactiveCooldown(),
        activeBondCount,
        milestones: [],
        vowNFTs: [],
      };

    case "proposalSent":
      return {
        dashboard: emptyDashboard({ hasProposal: true }),
        incomingProposals: [],
        outgoingProposal: { proposer: self, proposed: partner, timestamp: now - B(3600) },
        hasPendingProposal: true,
        marriageView: null,
        dissolutionRequest: null,
        cooldown: inactiveCooldown(),
        activeBondCount,
        milestones: [],
        vowNFTs: [],
      };

    case "married":
      return {
        dashboard: emptyDashboard({
          isBonded: true,
          partner,
          pendingYield: TIME(42),
          timeBalance: TIME(730),
        }),
        incomingProposals: [],
        outgoingProposal: null,
        hasPendingProposal: false,
        marriageView: {
          partnerA: self,
          partnerB: partner,
          bondStart: now - B(800 * DAY),
          lastClaim: now - B(10 * DAY),
          lastMilestoneYear: B(2),
          active: true,
          pendingYield: TIME(42),
          bondId: "0xbond000000000000000000000000000000000000000000000000000000000007" as `0x${string}`,
        },
        dissolutionRequest: { requester: ZERO, requestedAt: B(0), active: false },
        cooldown: inactiveCooldown(),
        activeBondCount,
        milestones: milestoneNFTs(),
        vowNFTs: [bondNFT()],
      };

    case "cooldown": {
      const lastDissolutionTs = now - B(5 * DAY);
      const cooldownSeconds = B(30 * DAY);
      const cooldownEndsAt = Number(lastDissolutionTs) + Number(cooldownSeconds);
      const remainingSeconds = Math.max(0, cooldownEndsAt - Number(now));
      return {
        dashboard: emptyDashboard({ timeBalance: TIME(365) }),
        incomingProposals: [],
        outgoingProposal: null,
        hasPendingProposal: false,
        marriageView: null,
        dissolutionRequest: null,
        cooldown: {
          lastDissolutionTs,
          cooldownSeconds,
          cooldownEndsAt,
          remainingSeconds,
          isActive: true,
        },
        activeBondCount,
        milestones: [],
        vowNFTs: [bondNFT()],
      };
    }

    case "dissolutionPending":
      return {
        dashboard: emptyDashboard({
          isBonded: true,
          partner,
          pendingYield: TIME(8),
          timeBalance: TIME(500),
        }),
        incomingProposals: [],
        outgoingProposal: null,
        hasPendingProposal: false,
        marriageView: {
          partnerA: self,
          partnerB: partner,
          bondStart: now - B(420 * DAY),
          lastClaim: now - B(3 * DAY),
          lastMilestoneYear: B(1),
          active: true,
          pendingYield: TIME(8),
          bondId: "0xbond000000000000000000000000000000000000000000000000000000000003" as `0x${string}`,
        },
        dissolutionRequest: { requester: self, requestedAt: now, active: true },
        cooldown: inactiveCooldown(),
        activeBondCount,
        milestones: milestoneNFTs().slice(1),
        vowNFTs: [bondNFT()],
      };
  }
}
