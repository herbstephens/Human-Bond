/**
 * Proof of life: the Selfie Check — a face, not a password.
 * PERSON-level, not bond-level: one check keeps every bond's claims and
 * your will alive at once. Lives in the profile; the agent may remind you.
 */
'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { AliveCta } from './AliveCta';
import { isInWorldApp } from '@/lib/worldcoin/initMiniKit';

const SELFIE_ACTION = 'humanbond-propose-selfie';

export function SelfieCheckOverlay({ onDone }: { onDone: () => void }) {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        if (!isInWorldApp()) {
          throw new Error('Open HumanBond inside World App to run Selfie Check');
        }

        const { finalPayload } = await MiniKit.commandsAsync.verify({
          action: SELFIE_ACTION,
          verification_level: VerificationLevel.Device,
        });

        if (finalPayload.status === 'error') {
          console.error('[selfie-check] World ID verification failed', {
            error_code: finalPayload.error_code,
            action: SELFIE_ACTION,
            requested_level: VerificationLevel.Device,
          });
          throw new Error(`World ID Selfie Check failed: ${finalPayload.error_code}`);
        }

        if (!cancelled) setVerified(true);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'World ID Selfie Check failed');
        }
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0e0d0b] flex flex-col items-center justify-center px-8 text-center">
      <style>{`
        @keyframes hbScan {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); }
          50% { box-shadow: 0 0 0 16px rgba(245,158,11,0); }
        }
      `}</style>
      <div
        className={`w-44 h-44 rounded-full border-4 flex items-center justify-center transition-colors duration-500 ${
          verified ? 'border-emerald-400' : 'border-amber-400'
        }`}
        style={{ animation: verified ? 'none' : 'hbScan 1.6s ease-out infinite' }}
      >
        {verified ? (
          <Check size={56} className="text-emerald-400" />
        ) : (
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200/70 leading-relaxed">
            {error ? 'Verification failed' : 'Waiting for World ID'}
          </p>
        )}
      </div>
      <h1 className="mt-8 text-3xl font-black text-white tracking-tighter leading-tight">
        {verified ? 'You’re alive.' : error ? 'Check failed' : 'Proof of life'}
      </h1>
      <p className="mt-3 text-sm text-gray-400 font-medium max-w-[280px] leading-relaxed">
        {verified
          ? 'Heartbeat renewed on-chain — for every bond you hold, at once. Timer reset: 90 days on the clock.'
          : error ?? 'World ID is opening the face verification flow.'}
      </p>
      {verified && (
        <div className="mt-8 w-full max-w-xs">
          <AliveCta onClick={onDone} className="w-full px-8 py-4 rounded-2xl text-xs tracking-[0.2em]">
            Done
          </AliveCta>
        </div>
      )}
      {error && (
        <div className="mt-8 w-full max-w-xs">
          <AliveCta onClick={onDone} className="w-full px-8 py-4 rounded-2xl text-xs tracking-[0.2em]">
            Close
          </AliveCta>
        </div>
      )}
    </div>
  );
}
