/**
 * "What is World ID?" — the explainer behind the ⓘ next to the hero CTA.
 * Same copy the previous landing carried, in the mockup's modal shell.
 */

'use client';

import { LandingModal } from './LandingModal';

const REASONS = [
  'Zero-knowledge proofs — your identity stays private',
  'No name, email or biometric data is shared with this app',
  'Worldcoin only confirms you are a real, unique person',
  'Verification is stored locally and expires after 24 hours',
];

export interface VerifyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VerifyInfoModal({ isOpen, onClose }: VerifyInfoModalProps) {
  return (
    <LandingModal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify with World ID"
      subtitle="Creating a bond confirms you are a unique human through the World ID protocol — no documents, no personal data. It is the only gate into HumanBond."
    >
      <div className="app-modal-note">
        <div className="app-modal-note-title">Why it is safe</div>
        <ul>
          {REASONS.map(reason => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </LandingModal>
  );
}
