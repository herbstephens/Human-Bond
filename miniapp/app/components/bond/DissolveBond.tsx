/**
 * Ending a bond — the exit that has to exist for the entry to mean anything.
 *
 * Mirrors `HumanBond.sol` exactly, and the asymmetry IS the product:
 *   · request  — either partner ALONE. The other has no veto. Leaving is never gated.
 *   · cancel   — only the requester, only inside the 3-day delay.
 *   · execute  — anyone, once the delay elapsed. The vault settles 50/50.
 *
 * Design CI (docs/design-system.md): borderless white cards, Anton HEADING/META,
 * no amber — red is the only urgent color, and it stays on the destructive
 * confirm, never on the resting state.
 */
'use client';

import { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { META } from '@/lib/design';
import { formatMoney } from '@/lib/vault/usdc';
import { useNow } from '@/lib/hooks/useNow';
import { type Dissolution } from '@/lib/agent/agentStore';

/** "2D 14H 09M" — the wait, in the same Anton uppercase as every other number. */
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d > 0 ? `${d}D ${h}H ${m}M` : h > 0 ? `${h}H ${m}M ${s}S` : `${m}M ${s}S`;
}

type Confirm = 'request' | 'cancel' | 'execute';

export function DissolveBond({
  partner,
  balance,
  dissolution,
  delayMs,
  busy,
  error,
  onRequest,
  onCancel,
  onExecute,
}: {
  partner: string;
  /** Shared USDC in the vault — what the 50/50 settlement will actually split. */
  balance: number;
  dissolution: Dissolution | undefined;
  /** `dissolutionDelay()` — passed in so live and mock can never drift apart. */
  delayMs: number;
  /** A transaction is in flight: hold the buttons so no second popup opens. */
  busy: boolean;
  error: string | null;
  /** Each resolves to whether the write actually landed — the modal only closes on true. */
  onRequest: () => Promise<boolean>;
  onCancel: () => Promise<boolean>;
  onExecute: () => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // Ticks ONLY while a dissolution is open — no clock, no re-render, the rest
  // of the time. Never stale: the snapshot is read at render (lib/hooks/useNow).
  const now = useNow(Boolean(dissolution));

  const remaining = dissolution ? dissolution.requestedAt + delayMs - now : 0;
  const canExecute = Boolean(dissolution) && remaining <= 0;
  const youRequested = dissolution?.requester === 'you';
  // Truncated, not rounded: promising each side more than half of a small
  // vault is exactly the number a leaving partner will check.
  const half = formatMoney(balance / 2);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-anton text-black tracking-wide">ENDING THIS BOND</h2>
        <p className={`${META} mt-0.5`}>
          Either of you can leave alone. Three days to change your mind, then the vault splits 50/50
        </p>
      </div>

      {!dissolution ? (
        <>
          <div className="bg-white rounded-2xl divide-y divide-gray-100">
            {[
              { v: 'Either of you, alone', k: 'Who can start it' },
              { v: '3 days to cancel', k: 'Waiting period' },
              { v: `${half} USDC each`, k: 'Your half of the vault' },
              { v: '30 days before a new bond', k: 'Cooldown after' },
            ].map((row) => (
              <div key={row.k} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide">{row.v}</p>
                <p className={`${META} shrink-0 text-right`}>{row.k}</p>
              </div>
            ))}
          </div>
          {/* Resting state is a text link, never a button — leaving must be
              reachable, not invited. */}
          <button
            onClick={() => setConfirm('request')}
            className="w-full py-2 font-anton text-[11px] text-gray-400 hover:text-red-500 uppercase tracking-wide transition-colors"
          >
            Dissolve this bond
          </button>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-anton text-lg text-black tracking-wide">
                {canExecute
                  ? 'READY TO FINALIZE'
                  : youRequested
                    ? 'YOU STARTED THIS'
                    : `${partner.toUpperCase()} STARTED THIS`}
              </p>
              <p className={`${META} mt-0.5`}>
                {canExecute
                  ? 'The three days have passed — either of you can finish it'
                  : youRequested
                    ? 'Cancel any time before the clock runs out'
                    : `Nothing you can do to stop it — ${partner} is free to leave`}
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0 mt-2" />
          </div>

          {!canExecute && (
            <div className="flex items-baseline gap-2">
              <p className="font-anton text-3xl text-black tracking-wide tabular-nums">
                {formatRemaining(remaining)}
              </p>
              <p className={META}>left</p>
            </div>
          )}

          {canExecute ? (
            <button
              onClick={() => setConfirm('execute')}
              className="w-full py-3.5 px-6 rounded-xl font-anton text-[11px] text-white bg-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-colors active:scale-[0.98]"
            >
              Finalize · split {formatMoney(balance)} USDC
            </button>
          ) : youRequested ? (
            <button
              onClick={() => setConfirm('cancel')}
              className="w-full py-3.5 px-6 rounded-xl font-anton text-[11px] text-white bg-black uppercase tracking-[0.15em] hover:bg-gray-900 transition-colors active:scale-[0.98]"
            >
              Keep the bond · cancel request
            </button>
          ) : null}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setConfirm(null)} />
          <div className="relative bg-white rounded-[2rem] p-7 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  confirm === 'cancel' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                }`}
              >
                {confirm === 'cancel' ? <Check size={30} /> : <AlertTriangle size={30} />}
              </div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {confirm === 'request'
                  ? 'Start the three days?'
                  : confirm === 'cancel'
                    ? 'Keep the bond?'
                    : 'End it now?'}
              </h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                {confirm === 'request' ? (
                  <>
                    {partner} gets told immediately and cannot stop it — leaving is never gated. You
                    have three days to cancel. After that the bond closes, the vault splits 50/50
                    (about {half} USDC each), and your shared name stops being yours.
                  </>
                ) : confirm === 'cancel' ? (
                  <>
                    The request disappears and the bond goes on as if nothing happened. {partner}{' '}
                    sees that you called it off.
                  </>
                ) : (
                  <>
                    This is the irreversible one. The bond closes on Worldchain, the {formatMoney(balance)} USDC in
                    the vault splits 50/50, and the will dies with it. Neither of you can bond again
                    for 30 days.
                  </>
                )}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="font-anton text-[11px] text-red-600 uppercase tracking-wide text-center">
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                disabled={busy}
                onClick={async () => {
                  // The modal stays open until the write settles — closing it on
                  // tap would hide the MiniKit failure the user has to see.
                  const ok =
                    confirm === 'request'
                      ? await onRequest()
                      : confirm === 'cancel'
                        ? await onCancel()
                        : await onExecute();
                  if (ok) setConfirm(null);
                }}
                className={`w-full py-4 px-6 rounded-xl font-anton text-[11px] text-white uppercase tracking-[0.15em] transition-colors active:scale-[0.98] disabled:opacity-50 ${
                  confirm === 'cancel' ? 'bg-black hover:bg-gray-900' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {busy
                  ? 'Confirming…'
                  : confirm === 'request'
                    ? 'Start dissolution'
                    : confirm === 'cancel'
                      ? 'Cancel the request'
                      : 'Dissolve the bond'}
              </button>
              <button
                disabled={busy}
                onClick={() => setConfirm(null)}
                className="w-full py-3 font-anton text-[11px] text-gray-400 hover:text-gray-600 uppercase tracking-wide transition-colors disabled:opacity-50"
              >
                {confirm === 'request' ? 'Keep the bond' : confirm === 'cancel' ? 'Let it run' : 'Not yet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
