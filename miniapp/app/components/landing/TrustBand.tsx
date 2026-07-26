/**
 * Partner band — Worldcoin, 0G and ENS, aligned by height rather than by a
 * shared box (the three marks have genuinely different aspect ratios).
 * The Worldcoin mark is a bitmap painted through a CSS mask, so all three
 * tint the same way on hover.
 */

import { EnsLogo, ZeroGLogo } from './icons';

export function TrustBand() {
  return (
    <section className="trust-band" aria-label="Security and trust">
      <div className="container">
        <div className="trust-band-row">
          <a
            href="https://world.org"
            className="partner-card"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Worldcoin"
          >
            <span className="partner-logo-box partner-logo-box--worldcoin">
              <span className="partner-logo-mask" />
            </span>
            <span className="partner-card-label">Worldcoin</span>
          </a>

          <a href="https://0g.ai" className="partner-card" target="_blank" rel="noopener noreferrer" aria-label="0G">
            <span className="partner-logo-box partner-logo-box--zerog">
              <ZeroGLogo />
            </span>
            <span className="partner-card-label">0G</span>
          </a>

          <a
            href="https://ens.domains"
            className="partner-card"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ENS"
          >
            <span className="partner-logo-box partner-logo-box--ens">
              <EnsLogo />
            </span>
            <span className="partner-card-label">ENS</span>
          </a>
        </div>
        <p className="partner-caption">
          Built at{' '}
          <a href="https://ethglobal.com/events/buenosaires" target="_blank" rel="noopener noreferrer">
            EthGlobal Buenos Aires 2025
          </a>
        </p>
      </div>
    </section>
  );
}
