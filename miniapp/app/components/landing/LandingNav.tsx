/**
 * Sticky top bar: logomark + wordname on the left, "Open in World App" on the
 * right (opens the store/QR modal).
 */

'use client';

import Image from 'next/image';
import { ArrowUpRightIcon } from './icons';

export interface LandingNavProps {
  onOpenWorldApp: () => void;
  /** Inside World App the store CTA is pointless — the button becomes the real connect. */
  inWorldApp?: boolean;
  connectLabel?: string;
  onConnect?: () => void;
}

export function LandingNav({
  onOpenWorldApp,
  inWorldApp = false,
  connectLabel = 'Connect',
  onConnect,
}: LandingNavProps) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="brand">
          {/* Intrinsic size — the rendered 64px comes from `.brand img`. */}
          <Image src="/Isotype.png" alt="HumanBond logomark" width={193} height={155} priority />
          <span className="brand-name">HumanBond</span>
        </div>
        {inWorldApp ? (
          <button
            type="button"
            className="nav-cta"
            onClick={onConnect}
            aria-label="Connect and enter HumanBond"
          >
            {connectLabel}
            <ArrowUpRightIcon />
          </button>
        ) : (
          <button
            type="button"
            className="nav-cta"
            onClick={onOpenWorldApp}
            aria-haspopup="dialog"
            aria-label="Open World App options"
          >
            Open in World App
            <ArrowUpRightIcon />
          </button>
        )}
      </div>
    </nav>
  );
}
