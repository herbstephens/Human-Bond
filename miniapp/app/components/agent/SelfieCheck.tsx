/**
 * Proof of life: the Selfie Check — a face, not a password.
 * PERSON-level, not bond-level: one check keeps every bond's claims and
 * your will alive at once. Lives in the profile; the agent may remind you.
 */
'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AliveCta } from './AliveCta';

export function SelfieCheckOverlay({ onDone }: { onDone: () => void }) {
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVerified(true), 2400);
    return () => clearTimeout(t);
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
            Look into<br />the camera
          </p>
        )}
      </div>
      <h1 className="mt-8 text-3xl font-black text-white tracking-tighter leading-tight">
        {verified ? 'You’re alive.' : 'Proof of life'}
      </h1>
      <p className="mt-3 text-sm text-gray-400 font-medium max-w-[280px] leading-relaxed">
        {verified
          ? 'Heartbeat renewed on-chain — for every bond you hold, at once. Timer reset: 90 days on the clock.'
          : 'A face, not a password. One check covers all your bonds.'}
      </p>
      {verified && (
        <div className="mt-8 w-full max-w-xs">
          <AliveCta onClick={onDone} className="w-full px-8 py-4 rounded-2xl text-xs tracking-[0.2em]">
            Done
          </AliveCta>
        </div>
      )}
    </div>
  );
}
