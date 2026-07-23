'use client'

/**
 * Selects the MarriageApi implementation at build time. In a production build
 * USE_MOCKS folds to `false`, so the Mock branch (and its imports) are removed
 * by dead-code elimination and the real provider is the only thing shipped.
 */
import { USE_MOCKS } from "@/lib/config";
import { RealMarriageProvider } from "./RealMarriageProvider";
import { MockMarriageProvider } from "./MockMarriageProvider";

export function MarriageProvider({ children }: { children: React.ReactNode }) {
  if (USE_MOCKS) {
    return <MockMarriageProvider>{children}</MockMarriageProvider>;
  }
  return <RealMarriageProvider>{children}</RealMarriageProvider>;
}
