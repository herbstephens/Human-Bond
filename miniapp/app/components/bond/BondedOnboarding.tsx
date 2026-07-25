/**
 * Post-bond confirmation screen — replaces the dashboard in the demo flow.
 *
 * The ring assembles and the shared ENS address is BORN inside it — the
 * address is the confirmation. One headline, one subtitle, then the single
 * next step: create your personal agent (benefit-led copy, centered CTA).
 * No wallet, no gallery, no milestones, no TIME — onboarding only.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWorldProfile } from '@/lib/worldcoin/useWorldProfile';
import { useAgentStore } from '@/lib/agent/agentStore';

export function BondedOnboarding({ partnerAddress }: { partnerAddress: string | null }) {
  const router = useRouter();
  const agentReady = useAgentStore((s) => s.agentReady);
  const { profile } = useWorldProfile(partnerAddress);
  const shortPartner = (profile.username ?? 'alice').toLowerCase().replace(/[^a-z0-9]/g, '') || 'alice';
  const ensLabel = `ben-${shortPartner}`;

  // Staged reveal: ring closes + address is born → headline → next step
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 1300), // address appears in the ring
      setTimeout(() => setPhase(2), 2000), // headline + subtitle
      setTimeout(() => setPhase(3), 2800), // spark + copy + CTA
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center px-2 py-6 min-h-[78vh] justify-center">
      <style>{`
        @keyframes hbRingA { from { transform: rotate(-160deg); opacity: .2; } to { transform: rotate(0deg); opacity: 1; } }
        @keyframes hbRingB { from { transform: rotate(160deg); opacity: .2; } to { transform: rotate(0deg); opacity: 1; } }
        @keyframes hbRingGlow {
          0%, 60% { filter: drop-shadow(0 0 0 rgba(245,158,11,0)); }
          75% { filter: drop-shadow(0 0 18px rgba(245,158,11,.55)); }
          100% { filter: drop-shadow(0 0 6px rgba(245,158,11,.25)); }
        }
        @keyframes hbSparkBreathe {
          0%, 100% { box-shadow: 0 0 12px 2px rgba(245,158,11,.45); }
          50% { box-shadow: 0 0 22px 6px rgba(245,158,11,.25); }
        }
      `}</style>

      {/* The ring assembles — and the shared address is born inside it */}
      <div className="relative w-44 h-44 mb-7" style={{ animation: 'hbRingGlow 2.6s ease forwards' }}>
        <svg viewBox="0 0 160 160" className="w-full h-full">
          <g style={{ transformOrigin: '80px 80px', animation: 'hbRingA 1.3s cubic-bezier(.2,.8,.2,1) forwards' }}>
            <path d="M 80 12 A 68 68 0 0 1 80 148" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          </g>
          <g style={{ transformOrigin: '80px 80px', animation: 'hbRingB 1.3s cubic-bezier(.2,.8,.2,1) forwards' }}>
            <path d="M 80 148 A 68 68 0 0 1 80 12" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          </g>
        </svg>
        <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <p className="text-base font-mono font-black text-gray-900 tracking-tight">{ensLabel}</p>
          <p className="text-[9px] font-mono font-bold text-gray-400 mt-0.5">.humanbond.eth</p>
        </div>
        {/* The agent-to-be already lives inside the bond */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-[26px] w-3 h-3 rounded-full bg-amber-400 transition-opacity duration-700 ${phase >= 3 ? 'opacity-100' : 'opacity-0'}`}
          style={{ animation: 'hbSparkBreathe 2.4s ease-in-out infinite' }}
        />
      </div>

      {/* Headline + subtitle — one message, said once */}
      <div className={`space-y-2 transition-all duration-700 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-[0.95]">
          You are<br />bonded.
        </h1>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          Your shared address — live on Worldchain
        </p>
      </div>

      {/* The one next step — plain text, one-sentence WHY, close to the CTA */}
      <div className={`mt-8 w-full max-w-sm flex flex-col items-center gap-4 transition-all duration-700 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-[320px]">
          <span className="font-black text-gray-900">One thing left.</span> Your personal agent
          handles the money between you two — so you never have to argue about it.
        </p>
        <button
          onClick={() => router.push(agentReady ? '/agent' : '/agent/create')}
          className="w-full bg-black text-white px-8 py-6 rounded-[1.75rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-gray-900 transition-all duration-300 shadow-2xl shadow-gray-300 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98]"
        >
          {agentReady ? 'Talk to your agent' : 'Create your agent'}
        </button>
      </div>
    </div>
  );
}
