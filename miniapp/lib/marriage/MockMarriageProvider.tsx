'use client'

/**
 * Mock implementation of the MarriageApi boundary. Serves the currently selected
 * scenario from the mock store — no wallet, no chain. Reacts to scenario changes
 * from the floating panel.
 *
 * `actingAs` from the vault playground swaps which partner you are, so the
 * approval UI (awaiting_you vs awaiting_partner) is testable solo.
 */
import { useMemo } from "react";
import { MarriageContext } from "./context";
import type { MarriageApi } from "./types";
import { MOCK_ADDRESS, MOCK_PARTNER } from "@/lib/config";
import { useMockStore } from "@/lib/mocks/mockStore";
import { useMockVaultStore } from "@/lib/mocks/vaultStore";
import { getMockMarriageApi } from "@/lib/mocks";

export function MockMarriageProvider({ children }: { children: React.ReactNode }) {
  const scenario = useMockStore((s) => s.scenario);
  const actingAs = useMockVaultStore((s) => s.actingAs);

  const value = useMemo<MarriageApi>(() => {
    const api = getMockMarriageApi(scenario);
    const isPartner = actingAs.toLowerCase() === MOCK_PARTNER.toLowerCase();

    if (!isPartner) {
      return { ...api, address: MOCK_ADDRESS as `0x${string}` };
    }

    // Viewing the world as the partner: you are PARTNER, the other person is SELF.
    return {
      ...api,
      address: MOCK_PARTNER as `0x${string}`,
      dashboard: api.dashboard
        ? {
            ...api.dashboard,
            partner: MOCK_ADDRESS as `0x${string}`,
          }
        : null,
    };
  }, [scenario, actingAs]);

  return <MarriageContext.Provider value={value}>{children}</MarriageContext.Provider>;
}
