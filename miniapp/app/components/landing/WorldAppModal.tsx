/**
 * "Get World App" — the landing's answer to *not being inside World App*.
 *
 * It replaces the old `WorldAppChecker` dialog and keeps its job: whoever
 * opens the URL in a normal browser gets sent to the right store. Two ways in:
 *   - the nav CTA ("Open in World App"), deliberately, and
 *   - tapping "Create a bond" outside World App, where MiniKit is unavailable.
 *
 * The store buttons are ordered by the visitor's platform (iOS first on an
 * iPhone, Play first on Android) so the right one is the first thing thumbed;
 * the QR is there for the desktop case, where neither store link helps.
 */

'use client';

import Image from 'next/image';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { LandingModal } from './LandingModal';
import { AppleIcon, GooglePlayIcon } from './icons';

/** World App download links. */
const WORLD_APP_LINKS = {
  ios: 'https://apps.apple.com/us/app/worldcoin/id1560859847',
  android: 'https://play.google.com/store/apps/details?id=com.worldcoin',
} as const;

type Platform = 'ios' | 'android' | 'desktop';

/** Detect the visitor's platform. Client-only — call it after mount. */
function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop';

  const userAgent = navigator.userAgent || navigator.vendor;

  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/android/i.test(userAgent)) return 'android';

  return 'desktop';
}

const STORES = [
  { id: 'ios', label: 'App Store', href: WORLD_APP_LINKS.ios, Icon: AppleIcon },
  { id: 'android', label: 'Google Play', href: WORLD_APP_LINKS.android, Icon: GooglePlayIcon },
] as const;

export interface WorldAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorldAppModal({ isOpen, onClose }: WorldAppModalProps) {
  const isMounted = useHydrated();
  // Computed during render (not in an effect): detectPlatform only reads
  // navigator, and we only use it after mount, so this stays SSR-safe.
  const platform = isMounted ? detectPlatform() : 'desktop';
  const stores = platform === 'android' ? [STORES[1], STORES[0]] : STORES;

  return (
    <LandingModal
      isOpen={isOpen}
      onClose={onClose}
      title="Get World App"
      subtitle="Scan the code, or choose your store, to install World App and verify with World ID."
    >
      <div className="app-modal-qr" aria-hidden="true">
        <Image src="/landing/world-app-qr.png" alt="" width={168} height={168} />
      </div>
      <div className="app-store-buttons">
        {stores.map(({ id, label, href, Icon }) => (
          <a key={id} className="app-store-btn" href={href} target="_blank" rel="noopener noreferrer">
            <Icon />
            {label}
          </a>
        ))}
      </div>
    </LandingModal>
  );
}
