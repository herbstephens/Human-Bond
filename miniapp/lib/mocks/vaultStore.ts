/**
 * Stateful mock of the bond vault.
 *
 * Unlike the marriage scenarios (static snapshots), this one *simulates* the
 * contract: proposing 8 USDC really executes, proposing 45 really parks a spend
 * until the other partner approves, and the 24h budget really depletes. That is
 * the only way to exercise the flow that matters — the threshold and the
 * two-partner approval — without touching mainnet.
 *
 * Rules mirror BondVaultModule. If the contract changes, change this too.
 *
 * Not persisted, mock-mode only, tree-shaken out of production builds.
 */
import { create } from 'zustand';
import { MOCK_ADDRESS, MOCK_PARTNER } from '@/lib/config';
import { VAULT_RULES } from '@/lib/contracts/vault';
import type { ForeignAsset, VaultSpend } from '@/lib/vault/types';

const SELF = MOCK_ADDRESS as `0x${string}`;
const PARTNER = MOCK_PARTNER as `0x${string}`;
const MOCK_BOND_ID = '0xb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0ndb0nd' as `0x${string}`;
const MOCK_VAULT_ADDRESS = '0x5AFE5AFE5AFE5AFE5AFE5AFE5AFE5AFE5AFE5AFE' as `0x${string}`;

const nowSec = () => Math.floor(Date.now() / 1000);

/** Sample non-USDC asset, for exercising the "we can't move this" UI. */
const SAMPLE_FOREIGN_ASSET: ForeignAsset = {
  address: '0x2cfc85d8e48f8EAB294be644d9E25C3030863003',
  symbol: 'WLD',
  decimals: 18,
  balance: BigInt('50000000000000000000'), // 50 WLD
};

/** Labels the mock treats as already taken, so the "name unavailable" path is testable. */
const MOCK_TAKEN_LABELS = new Set(['taken', 'test', 'humanbond', 'admin']);

/** Simulates registrar.available() without a chain read. */
export function mockLabelAvailable(label: string): boolean {
  return label.length > 0 && !MOCK_TAKEN_LABELS.has(label);
}

type MockVaultState = {
  isCreated: boolean;
  /** ENS label claimed for this bond, or null before naming. Mirrors registrar.labelOf. */
  ensLabel: string | null;
  balance: bigint;
  spends: VaultSpend[];
  freeWindowStart: number;
  freeWindowSpent: bigint;
  foreignAssets: ForeignAsset[];
  /** Which partner the playground is acting as, so the approval flow is testable solo. */
  actingAs: `0x${string}`;

  createVault: (ensLabel?: string) => void;
  proposeSpend: (to: `0x${string}`, amount: bigint) => { spendId: `0x${string}`; executed: boolean };
  approveSpend: (spendId: `0x${string}`) => void;
  cancelSpend: (spendId: `0x${string}`) => void;
  setActingAs: (who: `0x${string}`) => void;
  fund: (amount: bigint) => void;
  toggleForeignAsset: () => void;
  reset: () => void;
};

const initialState = {
  isCreated: true,
  ensLabel: 'ana-bruno' as string | null,
  balance: BigInt(1_000_000_000), // 1000 USDC
  spends: [] as VaultSpend[],
  freeWindowStart: 0,
  freeWindowSpent: BigInt(0),
  foreignAssets: [] as ForeignAsset[],
  actingAs: SELF,
};

let spendCounter = 0;
const nextSpendId = (): `0x${string}` =>
  `0x${(++spendCounter).toString(16).padStart(64, '0')}` as `0x${string}`;

export const useMockVaultStore = create<MockVaultState>((set, get) => ({
  ...initialState,

  createVault: (ensLabel?: string) => set({ isCreated: true, ensLabel: ensLabel ?? null }),

  proposeSpend: (to, amount) => {
    const state = get();
    const spendId = nextSpendId();
    const proposer = state.actingAs;

    // Mirrors _consumeFreeAllowance: the per-spend threshold alone is not a
    // limit, the rolling budget is what actually bounds unilateral spending.
    const windowExpired = nowSec() >= state.freeWindowStart + VAULT_RULES.FREE_WINDOW_SECONDS;
    const spentInWindow = windowExpired ? BigInt(0) : state.freeWindowSpent;
    const withinThreshold = amount <= VAULT_RULES.SMALL_SPEND_THRESHOLD;
    const withinBudget = spentInWindow + amount <= VAULT_RULES.DAILY_FREE_LIMIT;
    const executed = withinThreshold && withinBudget;

    const spend: VaultSpend = {
      spendId,
      bondId: MOCK_BOND_ID,
      to,
      amount,
      proposer,
      createdAt: BigInt(nowSec()),
      executed,
      cancelled: false,
      approvedByProposer: true,
      approvedByPartner: false,
    };

    set({
      spends: [spend, ...state.spends],
      balance: executed ? state.balance - amount : state.balance,
      freeWindowStart: executed && windowExpired ? nowSec() : state.freeWindowStart,
      freeWindowSpent: executed ? spentInWindow + amount : state.freeWindowSpent,
    });

    return { spendId, executed };
  },

  approveSpend: (spendId) => {
    const state = get();
    const spend = state.spends.find((s) => s.spendId === spendId);
    if (!spend || spend.executed || spend.cancelled) return;
    // The proposer is already counted; only the other partner can complete it.
    if (spend.proposer.toLowerCase() === state.actingAs.toLowerCase()) return;

    set({
      balance: state.balance - spend.amount,
      spends: state.spends.map((s) =>
        s.spendId === spendId ? { ...s, executed: true, approvedByPartner: true } : s,
      ),
    });
  },

  cancelSpend: (spendId) =>
    set((state) => ({
      spends: state.spends.map((s) =>
        s.spendId === spendId && !s.executed ? { ...s, cancelled: true } : s,
      ),
    })),

  setActingAs: (who) => set({ actingAs: who }),

  fund: (amount) => set((state) => ({ balance: state.balance + amount })),

  toggleForeignAsset: () =>
    set((state) => ({
      foreignAssets: state.foreignAssets.length > 0 ? [] : [SAMPLE_FOREIGN_ASSET],
    })),

  reset: () => {
    spendCounter = 0;
    set({ ...initialState, spends: [] });
  },
}));

export const MOCK_VAULT = {
  BOND_ID: MOCK_BOND_ID,
  ADDRESS: MOCK_VAULT_ADDRESS,
  SELF,
  PARTNER,
} as const;

/** Remaining budget under the current window, for display. */
export function mockRemainingFreeAllowance(): bigint {
  const { freeWindowStart, freeWindowSpent } = useMockVaultStore.getState();
  if (nowSec() >= freeWindowStart + VAULT_RULES.FREE_WINDOW_SECONDS) {
    return VAULT_RULES.DAILY_FREE_LIMIT;
  }
  return freeWindowSpent >= VAULT_RULES.DAILY_FREE_LIMIT
    ? BigInt(0)
    : VAULT_RULES.DAILY_FREE_LIMIT - freeWindowSpent;
}
