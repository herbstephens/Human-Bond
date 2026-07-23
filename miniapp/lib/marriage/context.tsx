'use client'

import { createContext, useContext } from "react";
import type { MarriageApi } from "./types";

const MarriageContext = createContext<MarriageApi | null>(null);

/**
 * Read the marriage data boundary. Must be used inside <MarriageProvider>.
 */
export function useMarriage(): MarriageApi {
  const ctx = useContext(MarriageContext);
  if (!ctx) {
    throw new Error("useMarriage must be used within <MarriageProvider>");
  }
  return ctx;
}

export { MarriageContext };
