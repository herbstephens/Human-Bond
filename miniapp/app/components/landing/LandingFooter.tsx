/**
 * Footer — brand, the two external links, copyright.
 */

import Image from 'next/image';

export function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            {/* Intrinsic size — the rendered 54px comes from `.footer-brand img`. */}
            <Image src="/Isotype.png" alt="HumanBond logomark" width={193} height={155} />
            <span className="footer-brand-name">HumanBond</span>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a
              href="https://github.com/herbstephens/Human-Bond/tree/main/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </a>
            <a
              href="https://github.com/herbstephens/Human-Bond/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy
            </a>
          </nav>
          <p className="footer-copy">&copy; 2026 HumanBond. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
