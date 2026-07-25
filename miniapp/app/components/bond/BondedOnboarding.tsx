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
import { AliveCta } from '@/app/components/agent/AliveCta';

export function BondedOnboarding({ partnerAddress }: { partnerAddress: string | null }) {
  const router = useRouter();
  const agentReady = useAgentStore((s) => s.agentReady);
  const bondEnsLabel = useAgentStore((s) => s.bondEnsLabel);
  const setBondEnsLabel = useAgentStore((s) => s.setBondEnsLabel);
  const { profile } = useWorldProfile(partnerAddress);
  const shortPartner = (profile.username ?? 'alice').toLowerCase().replace(/[^a-z0-9]/g, '') || 'alice';
  const suggestion = `ben-${shortPartner}`;
  const named = Boolean(bondEnsLabel);
  const ensLabel = bondEnsLabel ?? suggestion;
  const [nameDraft, setNameDraft] = useState(suggestion);
  const claimName = () => {
    const label = nameDraft.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || suggestion;
    setBondEnsLabel(label);
  };

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
          {named ? (
            <>
              <p className="text-base font-mono font-black text-gray-900 tracking-tight">{ensLabel}</p>
              <p className="text-[9px] font-mono font-bold text-gray-400 mt-0.5">.humanbond.eth</p>
            </>
          ) : (
            <p className="text-xl font-black text-gray-900 tracking-tighter leading-tight">
              You are<br />bonded.
            </p>
          )}
        </div>
        {/* The agent-to-be already lives inside the bond */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-[26px] w-3 h-3 rounded-full bg-amber-400 transition-opacity duration-700 ${phase >= 3 ? 'opacity-100' : 'opacity-0'}`}
          style={{ animation: 'hbSparkBreathe 2.4s ease-in-out infinite' }}
        />
      </div>

      {/* Headline appears below only once the ring carries the name */}
      {named && (
        <div className={`space-y-2 transition-all duration-700 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-[0.95]">
            You are<br />bonded.
          </h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            Your shared address — live on Worldchain
          </p>
        </div>
      )}

      {/* ONE next step at a time: first the bond gets its address, then the agent */}
      <div className={`mt-8 w-full max-w-sm flex flex-col items-center gap-4 transition-all duration-700 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {!named ? (
          <>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              Your shared address — live on Worldchain
            </p>
            <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-baseline gap-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && claimName()}
                className="flex-1 bg-transparent text-base font-mono font-black text-gray-900 outline-none min-w-0"
                autoFocus
              />
              <span className="text-[11px] font-mono font-bold text-gray-400 shrink-0">.humanbond.eth</span>
            </div>
            <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-[320px]">
              The name you two go by — where money arrives, where your agents live.
            </p>
            <AliveCta onClick={claimName} className="w-full px-8 py-5 rounded-[1.75rem] text-sm tracking-[0.2em] mt-4">
              Claim your bond address
            </AliveCta>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-[320px]">
              <span className="font-black text-gray-900">One thing left.</span> Your personal agent
              handles the money between you two — so you never have to argue about it.
            </p>
            <AliveCta
              onClick={() => router.push(agentReady ? '/agent' : '/agent/create')}
              className="w-full px-8 py-6 rounded-[1.75rem] text-sm tracking-[0.2em]"
            >
              {agentReady ? 'Talk to your agent' : 'Create your agent'}
            </AliveCta>
          </>
        )}
      </div>
    </div>
  );
}
