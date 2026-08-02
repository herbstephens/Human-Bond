/**
 * Everything about to move out of the bond, in one list.
 *
 * The bond dashboard used to show neither kind of pending payment: manual sends
 * lived only on the legacy `/vault` screen, and agent-negotiated proposals only
 * inside the `/agent` chat. So a couple looking at their own money could not see
 * what was queued against it. Both belong here, on the account they affect.
 *
 * The two are genuinely different and are labelled as such:
 *   · a MANUAL send waits for the partner's signature — approve/decline inline.
 *   · an AGENT proposal is already settled between the agents and waits for a
 *     HUMAN release on hito, which happens in the agent conversation. (CLAUDE.md
 *     chat rule #5: agents negotiate, humans release.)
 *
 * Design CI: borderless white rows, the Rules row pattern, red only for urgency.
 */
'use client';

import { useRouter } from 'next/navigation';
import { formatUsdc, shortAddress } from '@/lib/vault/usdc';
import { spendStatus, type VaultSpend } from '@/lib/vault/types';
import { META } from '@/lib/design';
import type { Payment } from '@/lib/agent/agentStore';
import type { TxState } from '@/lib/hooks/useVaultActions';

function relativeTime(timestamp: bigint): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function PendingMoney({
  spends,
  proposals,
  viewer,
  partnerName,
  txState,
  onApprove,
  onCancel,
}: {
  /** Every spend the module knows about; this component picks the open ones. */
  spends: VaultSpend[];
  /** Agent-negotiated payments still waiting on a human release. */
  proposals: Payment[];
  viewer: `0x${string}` | null;
  partnerName: string;
  txState: TxState;
  onApprove: (spendId: `0x${string}`) => void;
  onCancel: (spendId: `0x${string}`) => void;
}) {
  const router = useRouter();
  const busy = txState === 'sending';
  // One pass: the open list and the "needs you" count come out together, and
  // spendStatus is computed once per spend instead of once per spend per pass.
  const open: { spend: VaultSpend; needsYou: boolean }[] = [];
  let awaitingYou = 0;
  for (const spend of spends) {
    if (spend.executed || spend.cancelled) continue;
    const needsYou = spendStatus(spend, viewer) === 'awaiting_you';
    if (needsYou) awaitingYou += 1;
    open.push({ spend, needsYou });
  }

  if (open.length === 0 && proposals.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-anton text-black tracking-wide">WAITING ON YOU TWO</h2>
        <p className={`${META} mt-0.5`}>
          {awaitingYou > 0
            ? `${awaitingYou} need${awaitingYou === 1 ? 's' : ''} your signature`
            : 'Nothing moves until it is signed'}
        </p>
      </div>

      <div className="bg-white rounded-2xl divide-y divide-gray-100">
        {open.map(({ spend, needsYou }) => {
          return (
            <div key={spend.spendId} className="px-5 py-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-anton text-lg text-black tracking-wide">
                    {formatUsdc(spend.amount)}
                    <span className={`${META} ml-1`}>USDC</span>
                  </p>
                  <p className={`${META} mt-0.5 truncate`} title={spend.to}>
                    To {shortAddress(spend.to)} · {relativeTime(spend.createdAt)}
                  </p>
                </div>
                <p className={`${META} shrink-0 text-right flex items-center gap-1.5`}>
                  {needsYou && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                  {needsYou ? 'Your signature' : `Waiting for ${partnerName}`}
                </p>
              </div>

              {needsYou ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(spend.spendId)}
                    disabled={busy}
                    className="flex-1 py-3 px-4 rounded-xl bg-black text-white font-anton text-[11px] uppercase tracking-[0.15em] hover:bg-gray-900 transition-colors active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? 'Signing…' : 'Approve & send'}
                  </button>
                  <button
                    onClick={() => onCancel(spend.spendId)}
                    disabled={busy}
                    className="px-4 font-anton text-[11px] text-gray-400 hover:text-red-500 uppercase tracking-wide transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onCancel(spend.spendId)}
                  disabled={busy}
                  className="w-full py-2 font-anton text-[11px] text-gray-400 hover:text-red-500 uppercase tracking-wide transition-colors disabled:opacity-50"
                >
                  Cancel request
                </button>
              )}
            </div>
          );
        })}

        {/* Agent proposals: the agents already agreed; only a human release is
            missing, and that ceremony lives in the conversation. */}
        {proposals.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push('/agent')}
            className="w-full px-5 py-4 text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-anton text-lg text-black tracking-wide">
                  {p.amountUsdc.toFixed(2)}
                  <span className={`${META} ml-1`}>USDC</span>
                </p>
                <p className={`${META} mt-0.5 truncate`}>
                  {p.label} · to {p.recipientEns}
                </p>
              </div>
              <p className={`${META} shrink-0 text-right flex items-center gap-1.5`}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Your release
              </p>
            </div>
            <p className={`${META} mt-2`}>
              Your agents settled it — {p.shareYou.toFixed(2)} you / {p.sharePartner.toFixed(2)}{' '}
              {partnerName}. Tap to release on your hito
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
