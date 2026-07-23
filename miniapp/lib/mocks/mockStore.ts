/**
 * In-memory store holding the currently selected mock scenario. Used only in
 * mock mode. Intentionally NOT persisted and NOT sharing the `humanbond-auth`
 * key, so it never contaminates real auth/wallet state.
 */
import { create } from "zustand";
import { DEFAULT_SCENARIO, type Scenario } from "./scenarios";

type MockState = {
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
};

export const useMockStore = create<MockState>((set) => ({
  scenario: DEFAULT_SCENARIO,
  setScenario: (scenario) => set({ scenario }),
}));
