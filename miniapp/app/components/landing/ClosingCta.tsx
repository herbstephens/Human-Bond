/**
 * Closing band — the second (and last) entry point into verification, on the
 * warm gradient that flows into the footer.
 */

'use client';

import { BondIcon } from './icons';

export interface ClosingCtaProps {
  ctaLabel: string;
  isVerifying: boolean;
  onCreateBond: () => void;
}

export function ClosingCta({ ctaLabel, isVerifying, onCreateBond }: ClosingCtaProps) {
  return (
    <div className="closing-wrap">
      <div className="closing">
        <h2 className="closing-title">Make it official</h2>
        <p className="closing-sub">One minute to verify and unlock your Bond&nbsp;Agent.</p>
        <button type="button" className="btn-verify" onClick={onCreateBond} disabled={isVerifying}>
          {isVerifying ? <span className="btn-spinner" aria-hidden="true" /> : <BondIcon />}
          {isVerifying ? 'Verifying…' : ctaLabel}
        </button>
      </div>
    </div>
  );
}
