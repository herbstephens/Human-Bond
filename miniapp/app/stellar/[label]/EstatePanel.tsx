'use client'

/**
 * Will, proof of life and the estate — the inheritance half of the vault page.
 *
 * The will needs BOTH partners. Partner 1 signs their authorization here and gets a link;
 * partner 2 opens it, sees exactly which heirs and shares they are agreeing to, and submits.
 * Check-ins: every signed action already counts; "I'm here" exists for quiet periods.
 * Reporting a missed check-in and confirming a death are open to anyone, as in the contract.
 */
import { useState } from 'react';
import { Buffer } from 'buffer';
import { HEADING, META } from '@/lib/design';
import { STELLAR } from '@/lib/stellar/config';
import { toStroops } from '@/lib/stellar/payment';
import {
  buildBookLateEstateTx,
  buildClaimInheritanceTx,
  buildConfirmDeathTx,
  buildHeartbeatTx,
  buildReportLapseTx,
  coSignFirst,
  finishCoSignTx,
  willArgs,
  type Heir,
  type PartnerLife,
  type VaultState,
} from '@/lib/stellar/vault';
import { loadKit } from '@/lib/stellar/walletKit';

type Props = {
  label: string;
  vaultId: string;
  state: VaultState;
  wallet: string | null;
  busy: string | null;
  run: (what: string, step: () => Promise<void>) => Promise<void>;
  act: (what: string, build: (me: string) => Promise<string>) => Promise<void>;
  /** `?will=` from the link partner 1 sent: base64url JSON {heirs, entries}. */
  pendingWill: string | null;
};

type WillProposal = { heirs: Heir[]; entries: string[] };

const input = 'w-full rounded-xl bg-gray-100 px-3 py-2 font-mono text-sm outline-none';
const cta = 'rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-40';
const secondary = 'rounded-full bg-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] disabled:opacity-40';

// The signed authorization is good for about 6 days of ledgers: time for partner 2 to open the link.
const WILL_LINK_VALID_LEDGERS = 100_000;

function short(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function encodeProposal(p: WillProposal): string {
  return Buffer.from(JSON.stringify(p)).toString('base64url');
}

/** A link can arrive truncated or edited: that is a normal outcome here, shown to the reader. */
function decodeProposal(raw: string): WillProposal | { error: string } {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as WillProposal;
    if (!Array.isArray(parsed.heirs) || !Array.isArray(parsed.entries)) return { error: 'The link is missing the heirs or signatures.' };
    return parsed;
  } catch {
    return { error: 'The link is damaged — ask your partner to send it again.' };
  }
}

function lifeLine(life: PartnerLife, intervalSeconds: number, now: Date): string {
  if (life.deceased) return 'Deceased';
  if (life.lapseEndsAt) {
    return life.lapseEndsAt <= now
      ? 'Missed check-in, challenge over — death can be confirmed'
      : `Missed check-in reported · a check-in before ${life.lapseEndsAt.toLocaleString()} cancels it`;
  }
  const due = new Date(life.lastSeen.getTime() + intervalSeconds * 1000);
  return due <= now ? `Check-in overdue since ${due.toLocaleDateString()}` : `Last seen ${life.lastSeen.toLocaleDateString()} · next check-in by ${due.toLocaleDateString()}`;
}

export function EstatePanel({ label, vaultId, state, wallet, busy, run, act, pendingWill }: Props) {
  const { config } = state;
  const now = new Date();
  const partners = [
    { who: config.partnerA, life: state.lifeA, name: 'Partner A' },
    { who: config.partnerB, life: state.lifeB, name: 'Partner B' },
  ];
  const bothAlive = !state.lifeA.deceased && !state.lifeB.deceased;
  const bothDeceased = state.lifeA.deceased && state.lifeB.deceased;
  const isPartner = !!wallet && (wallet === config.partnerA || wallet === config.partnerB);
  const otherPartner = wallet === config.partnerA ? config.partnerB : config.partnerA;

  const [rows, setRows] = useState<{ heir: string; percent: string; unlock: string }[]>([{ heir: '', percent: '100', unlock: '' }]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const decoded = pendingWill ? decodeProposal(pendingWill) : null;
  const proposal = decoded && !('error' in decoded) ? decoded : null;
  const proposalError = decoded && 'error' in decoded ? decoded.error : null;

  const heirsFromRows = (): Heir[] => {
    const heirs = rows.map((r) => ({
      heir: r.heir.trim(),
      bps: Math.round(Number(r.percent) * 100),
      unlockAt: r.unlock ? Math.floor(new Date(`${r.unlock}T00:00:00Z`).getTime() / 1000) : 0,
    }));
    const total = heirs.reduce((sum, h) => sum + h.bps, 0);
    if (total !== 10_000) throw new Error(`Shares add up to ${total / 100}%, not 100%`);
    return heirs;
  };

  const signWill = () =>
    run('Signing the will', async () => {
      if (!wallet) throw new Error('Connect a wallet first');
      const heirs = heirsFromRows();
      const kit = await loadKit();
      const entries = await coSignFirst({
        vaultId,
        method: 'set_will',
        args: willArgs(heirs),
        source: otherPartner,
        validForLedgers: WILL_LINK_VALID_LEDGERS,
        // The wallet signs this call's authorization payload (Freighter et al. via Wallets Kit).
        firstSigner: async (preimage) => {
          const { signedAuthEntry } = await kit.signAuthEntry(preimage.toXdr('base64'), {
            networkPassphrase: STELLAR.passphrase,
            address: wallet,
          });
          return Buffer.from(signedAuthEntry, 'base64');
        },
      });
      setShareLink(`${window.location.origin}/stellar/${label}?will=${encodeProposal({ heirs, entries })}`);
    });

  const coSignWill = () =>
    run('Saving the will', () =>
      act('Will saved — signed by both of you', (me) =>
        finishCoSignTx({ vaultId, method: 'set_will', args: willArgs(proposal!.heirs), source: me, signedEntries: proposal!.entries }),
      ),
    );

  return (
    <>
      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>Proof of life</h2>
        <p className="text-sm text-gray-600">
          Every time you act with your wallet, you check in. Miss one for{' '}
          {Math.round(config.heartbeatIntervalSeconds / 86400)} days and anyone can report it; then{' '}
          {Math.round(config.challengeWindowSeconds / 86400)} days to answer before a death can be confirmed.
        </p>
        <ul className="space-y-2">
          {partners.map((p) => {
            const overdue = !p.life.deceased && !p.life.lapseEndsAt && new Date(p.life.lastSeen.getTime() + config.heartbeatIntervalSeconds * 1000) <= now;
            const confirmable = !p.life.deceased && !!p.life.lapseEndsAt && p.life.lapseEndsAt <= now;
            return (
              <li key={p.who} className="space-y-2 rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className={`${META} ml-2`}>{short(p.who)}{wallet === p.who ? ' · you' : ''}</span>
                </p>
                <p className="text-xs text-gray-600">{lifeLine(p.life, config.heartbeatIntervalSeconds, now)}</p>
                <div className="flex gap-2">
                  {wallet === p.who && !p.life.deceased && (
                    <button className={cta} disabled={!!busy} onClick={() => run('Checking in', () => act('Checked in', (me) => buildHeartbeatTx(vaultId, me)))}>
                      I’m here
                    </button>
                  )}
                  {wallet && overdue && !state.dissolved && (
                    <button className={secondary} disabled={!!busy} onClick={() => run('Reporting', () => act(`Missed check-in reported for ${short(p.who)}`, (me) => buildReportLapseTx(vaultId, me, p.who)))}>
                      Report missed check-in
                    </button>
                  )}
                  {wallet && confirmable && !state.dissolved && (
                    <button className={secondary} disabled={!!busy} onClick={() => run('Confirming', () => act(`Death of ${short(p.who)} confirmed`, (me) => buildConfirmDeathTx(vaultId, me, p.who)))}>
                      Confirm death
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {state.lifeA.deceased !== state.lifeB.deceased && (
          <p className="text-sm font-semibold">The survivor now owns the vault: any spend goes through on their signature alone. The will is locked.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>Will</h2>
        {state.will.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-sm">
            No will yet. If both of you die, nobody can claim what’s in the vault.
          </p>
        ) : (
          <ul className="space-y-2">
            {state.will.map((h) => (
              <li key={h.heir} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <span className="font-mono text-sm">
                  {h.bps / 100}% → {short(h.heir)}
                  {h.unlockAt > 0 && <span className={`${META} ml-2`}>from {new Date(h.unlockAt * 1000).toLocaleDateString()}</span>}
                </span>
                {bothDeceased && toStroops(h.owed) > BigInt(0) && (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{h.owed} USDC</span>
                    {wallet && h.unlockAt * 1000 <= now.getTime() && (
                      <button className={cta} disabled={!!busy} onClick={() => run('Paying out', () => act(`${h.owed} USDC paid to ${short(h.heir)}`, (me) => buildClaimInheritanceTx(vaultId, me, h.heir)))}>
                        {wallet === h.heir ? 'Claim' : 'Send'}
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500">
          Heirs inherit claims, not keys. An heir can be a person’s Stellar account or a contract — a child’s own bond vault.
          This executes the rules you wrote; it is not a legal will.
        </p>

        {bothDeceased && wallet && state.will.length > 0 && (
          <button className={secondary} disabled={!!busy} onClick={() => run('Booking', () => act('Late arrivals booked to the heirs', (me) => buildBookLateEstateTx(vaultId, me)))}>
            Book what arrived since
          </button>
        )}

        {proposalError && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{proposalError}</p>}

        {proposal && isPartner && bothAlive && !state.dissolved && (
          <div className="space-y-2 rounded-2xl bg-gray-50 p-5 text-sm">
            <p className="font-semibold">Your partner signed this will. Check it, then co-sign:</p>
            <ul className="font-mono text-xs">
              {proposal.heirs.map((h) => (
                <li key={h.heir}>
                  {h.bps / 100}% → {h.heir}
                  {h.unlockAt > 0 && ` (from ${new Date(h.unlockAt * 1000).toLocaleDateString()})`}
                </li>
              ))}
            </ul>
            <button className={cta} disabled={!!busy} onClick={coSignWill}>Co-sign and save</button>
          </div>
        )}

        {!proposal && isPartner && bothAlive && !state.dissolved && (
          <div className="space-y-2">
            <p className={META}>{state.will.length === 0 ? 'Write the will' : 'Replace the will'} — needs both of you</p>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_150px] gap-2">
                <input className={input} placeholder="Heir (G… or C…)" value={r.heir} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, heir: e.target.value } : x)))} />
                <input className={input} inputMode="decimal" placeholder="%" value={r.percent} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} />
                <input className={input} type="date" title="Can claim from (optional)" value={r.unlock} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, unlock: e.target.value } : x)))} />
              </div>
            ))}
            <div className="flex gap-2">
              <button className={secondary} disabled={!!busy || rows.length >= 10} onClick={() => setRows([...rows, { heir: '', percent: '', unlock: '' }])}>Add heir</button>
              <button className={cta} disabled={!!busy} onClick={signWill}>Sign and share with partner</button>
            </div>
            {shareLink && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Send this link to your partner to co-sign (valid about 6 days):</p>
                <input className={input} readOnly value={shareLink} onFocus={(e) => e.target.select()} />
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
