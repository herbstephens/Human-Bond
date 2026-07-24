/**
 * Action stub for mock mode. Opens a confirm sheet so you can Accept or Reject
 * like MiniKit.sendTransaction — then optionally advances the marriage scenario.
 *
 * Only ever invoked from a dead-in-prod `if (USE_MOCKS)` branch.
 */
import { create } from "zustand";
import { useMockStore } from "./mockStore";
import type { Scenario } from "./scenarios";

type PendingMockTx = {
  id: number;
  label: string;
  resolve: () => void;
  reject: (err: Error) => void;
};

type MockTxStore = {
  pending: PendingMockTx | null;
  accept: () => void;
  reject: () => void;
  /** Internal — used by simulateTx. */
  _setPending: (pending: PendingMockTx | null) => void;
};

let txCounter = 0;

export const useMockTxStore = create<MockTxStore>((set, get) => ({
  pending: null,

  _setPending: (pending) => set({ pending }),

  accept: () => {
    const { pending } = get();
    if (!pending) return;
    set({ pending: null });
    pending.resolve();
  },

  reject: () => {
    const { pending } = get();
    if (!pending) return;
    set({ pending: null });
    pending.reject(new Error("User rejected transaction"));
  },
}));

/**
 * Mimics MiniKit.sendTransaction: waits for the user to Accept or Reject in the
 * mock confirm sheet. Reject throws, matching a failed finalPayload.
 */
export async function simulateTx(next?: Scenario, label = "Confirm transaction"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const id = ++txCounter;
    useMockTxStore.getState()._setPending({
      id,
      label,
      resolve,
      reject,
    });
  });

  // Short beat after accept so the UI can show "sending" → success.
  await new Promise((r) => setTimeout(r, 400));

  if (next) {
    useMockStore.getState().setScenario(next);
  }
}
