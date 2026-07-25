/**
 * Post-bond onboarding — where the couple's shared wallet is actually born.
 *
 * The ring assembles and the shared ENS address is BORN inside it — the address
 * is the confirmation. Claiming the name is NOT cosmetic: it sends the
 * three-call MiniKit batch from lib/vault/createVault.ts (Safe → registerVault →
 * ENS register), so the wallet and the name come into existence together, or not
 * at all. One popup, one ceremony.
 *
 * The chain is the source of truth for "is it named yet": `vault.ensLabel` is
 * read back via the registrar's labelOf(). The agent store is kept in sync from
 * it, never the other way around — the store is a UI cache, not a record.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useWorldProfile } from '@/lib/worldcoin/useWorldProfile';
import { useMarriage } from '@/lib/marriage/context';
import { useAgentStore } from '@/lib/agent/agentStore';
import { useBondVault } from '@/lib/hooks/useBondVault';
import { useVaultActions } from '@/lib/hooks/useVaultActions';
import { useEnsAvailability } from '@/lib/hooks/useEnsAvailability';
import { resolveAutoLabel, useSuggestedLabel } from '@/lib/ens/autoLabel';
import { ENS_PARENT } from '@/lib/contracts/registrar';
import { USE_MOCKS } from '@/lib/config';
import { AliveCta } from '@/app/components/agent/AliveCta';

export function BondedOnboarding({ partnerAddress }: { partnerAddress: string | null }) {
  const router = useRouter();
  const agentReady = useAgentStore((s) => s.agentReady);
  const bonds = useAgentStore((s) => s.bonds);
  const setBondEnsLabel = useAgentStore((s) => s.setBondEnsLabel);

  const { address, marriageView } = useMarriage();
  const partnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
  const partnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
  const bondId = (marriageView?.bondId ?? null) as `0x${string}` | null;
  const partner = (partnerAddress ?? null) as `0x${string}` | null;

  const { profile } = useWorldProfile(partnerAddress ?? '');
  const { profile: myProfile } = useWorldProfile(address ?? '');

  // Usernames in bond order (partner A first), so both partners' devices derive
  // the same automatic label regardless of who is looking at the screen.
  const iAmPartnerA = !!address && !!partnerA && address.toLowerCase() === partnerA.toLowerCase();
  const usernameA = iAmPartnerA ? myProfile.username : profile.username;
  const usernameB = iAmPartnerA ? profile.username : myProfile.username;
  const suggestedLabel = useSuggestedLabel(usernameA, usernameB, bondId);

  const { vault, refetch: refetchVault } = useBondVault(partnerA, partnerB, bondId);
  const handleDone = useCallback(() => {
    void refetchVault();
  }, [refetchVault]);
  const { state, error, txError, createVault } = useVaultActions({
    bondId,
    partnerA,
    partnerB,
    partner,
    onDone: handleDone,
  });

  // The suggestion arrives async; keeping the draft nullable lets it fall through
  // to the suggestion without a setState-in-effect that would fight the typer.
  const [draft, setDraft] = useState<string | null>(null);
  const nameDraft = draft ?? suggestedLabel ?? '';
  const availability = useEnsAvailability(nameDraft);

  const created = Boolean(vault?.isCreated);
  const ensLabel = vault?.ensLabel ?? null;

  // Chain → store, so /bond and /agent read the name that actually got registered.
  useEffect(() => {
    if (created && ensLabel) setBondEnsLabel(ensLabel);
  }, [created, ensLabel, setBondEnsLabel]);

  // The ceremony plays ONCE: once the wallet exists, later logins land on the
  // dashboard (/profile) directly — home checks this flag.
  useEffect(() => {
    if (created) localStorage.setItem('hb-bond-ceremony-seen', '1');
  }, [created]);

  // The Safe needs a few blocks after submission before vaultOf(bondId) returns
  // it. Poll so the screen flips on its own instead of looking frozen.
  const [awaitingCreation, setAwaitingCreation] = useState(false);
  const isConfirming = awaitingCreation && !created;

  useEffect(() => {
    if (!isConfirming) return;
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      void refetchVault();
      // Give up after ~2 min so a dropped tx never leaves the screen stuck.
      if (attempts >= 40) {
        clearInterval(id);
        setAwaitingCreation(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [isConfirming, refetchVault]);

  const isBusy = state === 'sending' || isConfirming;

  /**
   * Claims the name AND creates the wallet — one batch, one popup.
   *
   * An empty or unavailable field is not a dead end: resolveAutoLabel walks the
   * candidate ladder, because register() is mandatory in the batch and the couple
   * must never be blocked from having a wallet by a naming collision.
   */
  const claimName = useCallback(async () => {
    if (!bondId || isBusy) return;
    const label =
      availability.status === 'available' && availability.label
        ? availability.label
        : await resolveAutoLabel(usernameA, usernameB, bondId);
    const ok = await createVault(label);
    if (ok) {
      setBondEnsLabel(label);
      if (!USE_MOCKS) setAwaitingCreation(true);
    }
  }, [bondId, isBusy, availability, usernameA, usernameB, createVault, setBondEnsLabel]);

  const bondHref = bonds[0] ? `/bond/${bonds[0].id}` : '/agent';
  // With an existing agent there is nothing left to set up here: once the wallet
  // exists the hand-off note shows briefly, then lands on the bond itself.
  const [handoff, setHandoff] = useState(false);
  useEffect(() => {
    if (created && agentReady) setHandoff(true);
  }, [created, agentReady]);
  useEffect(() => {
    if (!handoff) return;
    const t = setTimeout(() => router.push(bondHref), 2600);
    return () => clearTimeout(t);
  }, [handoff, bondHref, router]);

  // Staged reveal: ring closes + address is born → headline → next step.
  // The ceremony plays ONCE per bond: /home unmounts and remounts this screen on
  // every loading-gate flip, and replaying the 2.8s assembly each time reads as a
  // ghost reload. After the first run the screen opens settled (phase 3).
  const seenKey = bondId ? `humanbond:onboard-seen:${bondId}` : null;
  const [phase, setPhase] = useState(() =>
    seenKey && typeof window !== 'undefined' && sessionStorage.getItem(seenKey) ? 3 : 0,
  );
  useEffect(() => {
    if (phase === 3) return; // already settled — nothing to animate
    const t = [
      setTimeout(() => setPhase(1), 1300), // address appears in the ring
      setTimeout(() => setPhase(2), 2000), // headline + subtitle
      setTimeout(() => {
        setPhase(3); // spark + copy + CTA
        if (seenKey) sessionStorage.setItem(seenKey, '1');
      }, 2800),
    ];
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctaLabel = isConfirming
    ? 'Creating your wallet…'
    : state === 'sending'
      ? 'Confirm in World App…'
      : 'Claim your bond address';

  const hint = (() => {
    if (availability.status === 'invalid') return availability.reason;
    if (availability.status === 'taken') return 'That name is taken — try another.';
    if (availability.status === 'checking') return 'Checking availability…';
    if (availability.status === 'available') return 'Available.';
    return null;
  })();

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
          {created && ensLabel ? (
            <>
              <p className="text-base font-mono font-black text-gray-900 tracking-tight">{ensLabel}</p>
              <p className="text-[9px] font-mono font-bold text-gray-400 mt-0.5">.{ENS_PARENT}</p>
            </>
          ) : (
            <>
              <p className="text-xl font-black text-gray-900 tracking-tighter leading-tight">
                You are<br />bonded.
              </p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">
                you &amp; {profile.username ?? 'your partner'}
              </p>
            </>
          )}
        </div>
        {/* The agent-to-be already lives inside the bond */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-[26px] w-3 h-3 rounded-full bg-amber-400 transition-opacity duration-700 ${phase >= 3 ? 'opacity-100' : 'opacity-0'}`}
          style={{ animation: 'hbSparkBreathe 2.4s ease-in-out infinite' }}
        />
      </div>

      {/* Headline appears below only once the ring carries the name */}
      {created && (
        <div className={`space-y-2 transition-all duration-700 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-[0.95]">
            You are<br />bonded.
          </h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            Your shared address — live on Worldchain
          </p>
        </div>
      )}

      {/* ONE next step at a time: first the bond gets its wallet, then the agent */}
      <div className={`mt-8 w-full max-w-sm flex flex-col items-center gap-4 transition-all duration-700 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {!created ? (
          <>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              Name your shared address
            </p>
            <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-baseline gap-1">
              <input
                value={nameDraft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void claimName()}
                disabled={isBusy}
                className="flex-1 bg-transparent text-base font-mono font-black text-gray-900 outline-none min-w-0 disabled:text-gray-400"
                autoFocus
              />
              <span className="text-[11px] font-mono font-bold text-gray-400 shrink-0">.{ENS_PARENT}</span>
            </div>
            {hint && (
              <p
                className={`text-[11px] font-bold ${
                  availability.status === 'available'
                    ? 'text-emerald-600'
                    : availability.status === 'checking'
                      ? 'text-gray-400'
                      : 'text-amber-600'
                }`}
              >
                {hint}
              </p>
            )}
            <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-[320px]">
              The name you two go by — like a shared purse. Money arrives here,
              payments leave here, your agents take care of the rest.
            </p>
            <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-[320px]">
              Runs on USDC. Nothing leaves unless you both confirm.
            </p>

            {/* One tap creates the Safe AND claims the name — the batch is atomic. */}
            <AliveCta
              onClick={() => void claimName()}
              disabled={isBusy}
              className="w-full px-8 py-5 rounded-[1.75rem] text-sm tracking-[0.2em] mt-4"
            >
              {ctaLabel}
            </AliveCta>

            {isConfirming && (
              <p className="text-[11px] font-bold text-gray-400">
                Waiting for the wallet to appear on-chain — this takes a few blocks.
              </p>
            )}
            {(txError || error) && (
              <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                <p className="text-xs font-black text-red-800">
                  {txError?.title ?? 'That did not go through'}
                </p>
                <p className="text-[11px] font-medium text-red-700 mt-0.5">
                  {txError?.message ?? error}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {agentReady ? (
              <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-[320px]">
                <span className="font-black text-gray-900">Your agent is already here.</span> It
                now takes care of this bond too{handoff ? ' — taking you there.' : '.'}
              </p>
            ) : (
              <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-[320px]">
                <span className="font-black text-gray-900">One thing left.</span> Your personal agent
                handles the money between you two — so you never have to argue about it.
              </p>
            )}
            <AliveCta
              onClick={() => router.push(agentReady ? bondHref : '/agent/create')}
              className="w-full px-8 py-6 rounded-[1.75rem] text-sm tracking-[0.2em]"
            >
              {agentReady ? 'Open your bond' : 'Create your agent'}
            </AliveCta>
          </>
        )}
      </div>
    </div>
  );
}
