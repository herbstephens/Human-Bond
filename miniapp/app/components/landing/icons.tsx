/**
 * Landing-page icon set — transcribed 1:1 from Francesca's mockup.
 *
 * They are not lucide icons on purpose: the mockup draws them at a specific
 * weight inside the outline badges (`.step-icon svg` forces stroke-width 2.1
 * and inherits it down to every path), so the shapes have to be the ones the
 * design was drawn with. Size and colour always come from CSS.
 */

type IconProps = { className?: string };

/** Two brackets joined by a bar — the bond mark. Primary CTA + step 1. */
export function BondIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 8V6a3 3 0 0 1 3-3h2" />
      <path d="M21 8V6a3 3 0 0 0-3-3h-2" />
      <path d="M3 16v2a3 3 0 0 0 3 3h2" />
      <path d="M21 16v2a3 3 0 0 1-3 3h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

/** Two interlocking rings — the partnership itself. Step 2. */
export function RingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="12.5" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="19.5" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

/** The Bond Agent. Step 3. */
export function AgentIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="9" width="14" height="10" rx="2" />
      <path d="M12 9V5" />
      <circle cx="12" cy="4" r="1" />
      <circle cx="9" cy="14" r="1" />
      <circle cx="15" cy="14" r="1" />
      <path d="M2 13h3M19 13h3" />
    </svg>
  );
}

/** Clock — TIME. Step 4 + value prop 4. */
export function ClockIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

/** Shield with a check — value prop 1. */
export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l7 3.5v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9v-5L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Padlock — value prop 2 + the "privacy by design" trust line. */
export function LockIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Eye — value prop 3. */
export function EyeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    </svg>
  );
}

/** Globe — "Secured by Worldcoin" trust line. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 4 6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6-4-9s1.5-6.3 4-9z" />
    </svg>
  );
}

/** Shield — "Built on Worldchain" trust line. */
export function ShieldIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l8 4v5c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V7l8-4z" />
    </svg>
  );
}

/** Diagonal arrow — nav CTA. */
export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 17L17 7M17 7H9M17 7V15" />
    </svg>
  );
}

/** Circled "i" — opens the World ID explainer next to the hero CTA. */
export function InfoIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/** Close — modal dismiss. */
export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Apple mark — App Store button. */
export function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.462 2.033-1.155 2.723-.762.728-2.02 1.285-3.005 1.213-.13-1.104.462-2.09 1.155-2.744C14.144 1.87 15.294 1.35 16.365 1.43zM20.03 17.09c-.55 1.267-.812 1.833-1.518 2.952-.985 1.56-2.373 3.502-4.09 3.517-1.53.015-1.923-.996-4-.984-2.077.012-2.51 1-4.04.984-1.717-.015-3.03-1.766-4.015-3.325C-0.79 15.85.02 9.66 3.98 6.31c1.983-1.68 3.62-1.34 4.83-1.34 1.264 0 2.31.396 3.336.396 1.008 0 2.34-.49 3.93-.418 1.58.075 3.16.85 4.28 2.14-3.79 2.17-3.14 7.99.674 9.98v.02z" />
    </svg>
  );
}

/** Play triangle — Google Play button. */
export function GooglePlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 3.5v17a1 1 0 0 0 1.5.87l14-8.5a1 1 0 0 0 0-1.74l-14-8.5A1 1 0 0 0 4 3.5z" />
    </svg>
  );
}

/** 0G wordmark — partner card. */
export function ZeroGLogo({ className }: IconProps) {
  return (
    <svg width="551" height="267" viewBox="0 0 551 267" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M551 140.176C547.524 210.803 489.168 267 417.687 267C343.972 267 284.212 207.229 284.212 133.499C284.212 59.769 343.972 0 417.687 0C486.9 0 543.808 52.6889 550.506 120.151H489.889C483.613 85.9722 453.674 60.0757 417.689 60.0757C377.144 60.0757 344.276 92.9486 344.276 133.499C344.276 174.052 377.144 206.925 417.689 206.925C448.816 206.925 475.416 187.549 486.095 160.201H384.32V140.176H551ZM43.9296 232.504C96.3218 279.985 177.314 278.45 227.858 227.899C279.983 175.763 279.983 91.2372 227.858 39.1014C175.732 -13.0328 91.22 -13.0328 39.0943 39.1014C-9.84622 88.0512 -12.8367 165.554 30.1224 217.994L72.9838 175.125C53.2597 146.519 56.1206 107.032 81.5664 81.5821C110.235 52.9077 156.717 52.9077 185.387 81.5821C214.055 110.257 214.055 156.746 185.387 185.421C163.377 207.435 130.868 212.548 103.981 200.76L175.948 128.78L161.791 114.622L86.4966 189.928L43.9296 232.504Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** ENS mark — partner card. */
export function EnsLogo({ className }: IconProps) {
  return (
    <svg width="26" height="30" viewBox="0 0 26 30" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.8059 0.278909L4.52032 13.9123C4.45534 14.0192 4.30436 14.0311 4.22376 13.9354C3.49433 13.0693 0.776816 9.38466 4.13946 6.02631C7.20789 2.96181 11.1162 0.776893 12.5647 0.0217387C12.729 -0.0639373 12.9021 0.120655 12.8059 0.278909Z"
        fill="currentColor"
      />
      <path
        d="M12.3428 29.9655C12.5082 30.0812 12.7119 29.8838 12.6011 29.7153C10.7504 26.9004 4.59842 17.5346 3.74859 16.1286C2.91038 14.7419 1.26174 12.4373 1.12421 10.4656C1.11048 10.2687 0.838295 10.2288 0.769825 10.4139C0.6594 10.7124 0.541837 11.0687 0.432269 11.4758C-0.950933 16.614 1.0579 22.0665 5.42067 25.1202L12.3428 29.9655V29.9655Z"
        fill="currentColor"
      />
      <path
        d="M13.4817 29.7198L21.7673 16.0864C21.8323 15.9795 21.9833 15.9676 22.0639 16.0633C22.7933 16.9294 25.5108 20.614 22.1482 23.9724C19.0798 27.0369 15.1715 29.2218 13.723 29.9769C13.5587 30.0626 13.3855 29.878 13.4817 29.7198Z"
        fill="currentColor"
      />
      <path
        d="M13.9441 0.0346591C13.7788 -0.0810829 13.575 0.116302 13.6859 0.284863C15.5366 3.09974 21.6886 12.4655 22.5384 13.8715C23.3766 15.2582 25.0252 17.5628 25.1628 19.5346C25.1765 19.7314 25.4487 19.7714 25.5172 19.5863C25.6276 19.2877 25.7451 18.9314 25.8547 18.5243C27.2379 13.3861 25.2291 7.93365 20.8663 4.87989L13.9441 0.0346591Z"
        fill="currentColor"
      />
    </svg>
  );
}
