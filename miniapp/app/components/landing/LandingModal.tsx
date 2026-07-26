/**
 * The mockup's modal shell (`.app-modal-overlay` / `.app-modal`), plus the
 * behaviour its inline script had: Escape closes, backdrop click closes,
 * focus moves to the close button and returns where it came from, and the
 * page behind stops scrolling.
 *
 * The overlay stays mounted and is toggled with `.is-open` — that is what the
 * mockup's opacity/transform transitions animate against.
 */

'use client';

import { useEffect, useId, useRef } from 'react';
import { CloseIcon } from './icons';

export interface LandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Sits under the title, in the muted modal sub style. */
  subtitle: string;
  children?: React.ReactNode;
}

export function LandingModal({ isOpen, onClose, title, subtitle, children }: LandingModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeydown);

    return () => {
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`app-modal-overlay${isOpen ? ' is-open' : ''}`}
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      // Keeps the hidden overlay out of the tab order and off screen readers.
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className="app-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="app-modal-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h2 className="app-modal-title" id={titleId}>
          {title}
        </h2>
        <p className="app-modal-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
