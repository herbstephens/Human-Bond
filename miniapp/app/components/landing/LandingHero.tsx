/**
 * Hero — logomark, wordmark, the one promise, and the only real action on the
 * page: "Create a bond", which runs the World ID verification.
 */

'use client';

import Image from 'next/image';
import { Wordmark } from './Wordmark';
import { BondIcon, GlobeIcon, InfoIcon, LockIcon, ShieldIcon } from './icons';

export interface LandingHeroProps {
  /** Label on the primary CTA — changes once the visitor is already verified. */
  ctaLabel: string;
  isVerifying: boolean;
  onCreateBond: () => void;
  onShowInfo: () => void;
  /** Verification failure, surfaced under the hero. */
  error?: string | null;
}

export function LandingHero({ ctaLabel, isVerifying, onCreateBond, onShowInfo, error }: LandingHeroProps) {
  return (
    <div className="hero-wrap">
      <div className="atmosphere" aria-hidden="true" />

      <main className="hero">
        <div className="icon-tile-wrap">
          <div className="icon-tile">
            <Image src="/Isotype.png" alt="HumanBond logomark" width={193} height={155} priority />
          </div>
        </div>

        <h1 className="wordmark-img">
          <Wordmark />
        </h1>

        <p className="subhead">Forge and Manage Partnerships</p>

        {/* Empty by design in the mockup — it holds the hero's vertical rhythm
            between the subhead and the CTA. Removing it collapses the spacing. */}
        <p className="process-line" style={{ visibility: 'hidden' }} aria-hidden="true" />

        <div className="cta-row">
          <button type="button" className="btn-verify" onClick={onCreateBond} disabled={isVerifying}>
            {isVerifying ? <span className="btn-spinner" aria-hidden="true" /> : <BondIcon />}
            {isVerifying ? 'Verifying…' : ctaLabel}
          </button>
          <button
            type="button"
            className="btn-info"
            onClick={onShowInfo}
            aria-haspopup="dialog"
            aria-label="What is World ID?"
          >
            <InfoIcon />
          </button>
        </div>

        <div className="trust-line-group">
          <div className="trust-line">
            <GlobeIcon />
            Secured by Worldcoin
          </div>
          <div className="trust-line">
            <ShieldIcon />
            Built on Worldchain
          </div>
          <div className="trust-line">
            <LockIcon />
            Privacy by design
          </div>
        </div>

        {error && (
          <p className="verify-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
