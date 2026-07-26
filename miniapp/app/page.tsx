/**
 * Purpose: Homepage for HumanBond — Francesca's "Variant C" landing page.
 *
 * The whole page is one gate: every CTA (hero and closing band) runs the same
 * World ID verification and, on success, drops the visitor into /home. Opened
 * outside World App there is no MiniKit to verify with, so the CTA opens the
 * "Get World App" modal instead, which sends the visitor to the App Store or
 * Play Store — the same rule the previous landing enforced.
 *
 * Layout/styles live in components/landing/landing.css, scoped under
 * `.hb-landing`; this file only owns the flow.
 */

'use client'

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useWorldVerification } from "@/lib/worldcoin/useWorldVerification";
import { WORLD_ACTIONS, isInWorldApp } from "@/lib/worldcoin/initMiniKit";
import { useAuthStore } from "@/state/authStore";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { USE_MOCKS } from "@/lib/config";
import { LandingNav } from "./components/landing/LandingNav";
import { LandingHero } from "./components/landing/LandingHero";
import { HowItWorks } from "./components/landing/HowItWorks";
import { ValueProps } from "./components/landing/ValueProps";
import { TrustBand } from "./components/landing/TrustBand";
import { ClosingCta } from "./components/landing/ClosingCta";
import { LandingFooter } from "./components/landing/LandingFooter";
import { WorldAppModal } from "./components/landing/WorldAppModal";
import { VerifyInfoModal } from "./components/landing/VerifyInfoModal";
import "./components/landing/landing.css";

export default function Home() {
  const router = useRouter();
  const { verify, isVerifying, error } = useWorldVerification();
  const { setVerified, isVerified, checkVerificationExpiry } = useAuthStore();
  const [showError, setShowError] = useState<string | null>(null);
  const [showWorldAppDialog, setShowWorldAppDialog] = useState(false);
  const [showVerifyInfo, setShowVerifyInfo] = useState(false);
  const isMounted = useHydrated();

  /**
   * Both CTAs land here: verify with World ID, then enter the app.
   */
  const handleCreateBond = useCallback(async () => {
    setShowError(null);

    // Mock mode: skip World ID verification and enter the playground directly.
    if (USE_MOCKS) {
      router.push("/home");
      return;
    }

    // Outside World App there is no MiniKit — offer the install instead.
    if (!isInWorldApp()) {
      setShowWorldAppDialog(true);
      return;
    }

    // If already verified, just navigate
    if (isVerified && checkVerificationExpiry()) {
      router.push("/home");
      return;
    }

    // Request World ID verification.
    // Using APP_ACCESS action for general app access (unlimited verifications),
    // no signal needed.
    const result = await verify(WORLD_ACTIONS.APP_ACCESS, undefined);

    if (!result.success) {
      setShowError(result.error || "Verification failed. Please try again.");
      return;
    }

    // Save verification to store (including proof for on-chain verification)
    setVerified({
      proof: result.proof!,
      merkle_root: result.merkle_root!,
      nullifier_hash: result.nullifier_hash!,
      verification_level: result.verification_level!,
      verified_at: Date.now(),
    });

    router.push("/home");
  }, [router, verify, setVerified, isVerified, checkVerificationExpiry]);

  // The label is the only thing that depends on persisted state, so it is the
  // only thing gated on hydration — the rest of the page renders server-side.
  // Deliberately NOT checkVerificationExpiry(): that one clears the store when
  // the proof is stale, and a render must not mutate state. The click handler
  // runs the authoritative check; here the label is cosmetic.
  const ctaLabel = isMounted && isVerified ? "Enter HumanBond" : "Create a bond";

  return (
    <div className="hb-landing">
      <LandingNav onOpenWorldApp={() => setShowWorldAppDialog(true)} />

      <LandingHero
        ctaLabel={ctaLabel}
        isVerifying={isVerifying}
        onCreateBond={handleCreateBond}
        onShowInfo={() => setShowVerifyInfo(true)}
        error={showError || error}
      />

      <HowItWorks />
      <ValueProps />
      <TrustBand />

      <ClosingCta ctaLabel={ctaLabel} isVerifying={isVerifying} onCreateBond={handleCreateBond} />

      <LandingFooter />

      <WorldAppModal isOpen={showWorldAppDialog} onClose={() => setShowWorldAppDialog(false)} />
      <VerifyInfoModal isOpen={showVerifyInfo} onClose={() => setShowVerifyInfo(false)} />
    </div>
  );
}
