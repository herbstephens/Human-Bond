/**
 * Action stub for mock mode. Lets the playground "execute" a write action:
 * waits a beat to mimic a transaction, then optionally advances the scenario so
 * the UI reflects the new state (e.g. propose → proposalSent, accept → married).
 *
 * Only ever invoked from a dead-in-prod `if (USE_MOCKS)` branch.
 */
import { useMockStore } from "./mockStore";
import type { Scenario } from "./scenarios";

export async function simulateTx(next?: Scenario, delayMs = 1200): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (next) {
    useMockStore.getState().setScenario(next);
  }
}
