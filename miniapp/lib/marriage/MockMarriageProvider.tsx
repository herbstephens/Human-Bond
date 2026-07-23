'use client'

/**
 * Mock implementation of the MarriageApi boundary. Serves the currently selected
 * scenario from the mock store — no wallet, no chain. Reacts to scenario changes
 * from the floating panel.
 */
import { useMemo } from "react";
import { MarriageContext } from "./context";
import type { MarriageApi } from "./types";
import { useMockStore } from "@/lib/mocks/mockStore";
import { getMockMarriageApi } from "@/lib/mocks";

export function MockMarriageProvider({ children }: { children: React.ReactNode }) {
  const scenario = useMockStore((s) => s.scenario);
  const value = useMemo<MarriageApi>(() => getMockMarriageApi(scenario), [scenario]);
  return <MarriageContext.Provider value={value}>{children}</MarriageContext.Provider>;
}
