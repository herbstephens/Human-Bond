'use client'

import { useCallback, useEffect, useState } from 'react';
import { HEADING, META } from '@/lib/design';
import { STELLAR, STELLAR_NETWORK } from '@/lib/stellar/config';
import { toStroops } from '@/lib/stellar/payment';
import {
  buildApproveSpendTx,
  buildCancelDissolutionTx,
  buildCancelSpendTx,
  buildClaimShareTx,
  buildExecuteDissolutionTx,
  buildProposeSpendTx,
  buildRequestDissolutionTx,
  readVaultState,
  submitSoroban,
  type VaultSpend,
  type VaultState,
} from '@/lib/stellar/vault';
import { loadKit } from '@/lib/stellar/walletKit';

type Props = { label: string; vaultId: string };

const input = 'w-full rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm outline-none';
const cta = 'rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-40';
const secondary = 'rounded-full bg-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] disabled:opacity-40';

function short(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function VaultClient({ label, vaultId }: Props) {
  const [state, setState] = useState<VaultState | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ what: string; hash: string } | null>(null);

  const refresh = useCallback(async () => setState(await readVaultState(vaultId)), [vaultId]);

  // Initial read. State is set only from the promise, and ignored once the page moves on.
  useEffect(() => {
    let live = true;
    readVaultState(vaultId).then(
      (s) => live && setState(s),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [vaultId]);

  // Errors are shown, not swallowed: the full message goes on screen and to the console.
  async function run(what: string, step: () => Promise<void>) {
    setBusy(what);
    setError(null);
    await step()
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setBusy(null));
  }

  /** Sign with the connected wallet, submit, report, re-read the vault. */
  async function act(what: string, build: (me: string) => Promise<string>) {
    if (!wallet) throw new Error('Connect a wallet first');
    const kit = await loadKit();
    const { signedTxXdr } = await kit.signTransaction(await build(wallet), { networkPassphrase: STELLAR.passphrase, address: wallet });
    setDone({ what, hash: await submitSoroban(signedTxXdr) });
    await refresh();
  }

  const connect = () =>
    run('Connecting', async () => {
      const kit = await loadKit();
      const { address } = await kit.authModal();
      setWallet(address);
    });

  if (!state) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className={META}>{error ?? 'Reading the vault…'}</p>
      </main>
    );
  }

  const { config } = state;
  const isPartner = !!wallet && (wallet === config.partnerA || wallet === config.partnerB);
  const isA = wallet === config.partnerA;
  const pending = state.spends.filter((s) => s.status === 'Pending');
  const history = state.spends.filter((s) => s.status !== 'Pending').reverse();
  const now = new Date();
  const matured = !!state.dissolution && state.dissolution.executableAt <= now;

  const wouldExecuteNow =
    !!amount &&
    toStroops(amount) <= toStroops(config.smallSpendThreshold) &&
    toStroops(amount) <= toStroops(state.remainingFreeAllowance);

  const myApproval = (s: VaultSpend) => (isA ? s.approvedA : s.approvedB);

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className={META}>Stellar · {STELLAR_NETWORK} · bond vault</p>
        <h1 className={`${HEADING} text-3xl uppercase`}>{label}</h1>
        <p className="font-mono text-2xl">{state.balance}<span className={`${META} ml-2`}>USDC together</span></p>
        <p className={META}>
          Alone: up to {config.smallSpendThreshold} per spend · {state.remainingFreeAllowance} of {config.dailyFreeLimit} left today
        </p>
        <p className="break-all font-mono text-xs text-gray-500">{vaultId}</p>
        {state.dissolved && (
          <p className="text-sm font-semibold">This vault is dissolved. Each partner’s half is set aside to claim.</p>
        )}
      </header>

      <section className="space-y-2">
        {wallet ? (
          <p className={META}>
            Signed in as {short(wallet)} {isPartner ? `· partner ${isA ? 'A' : 'B'}` : '· not a partner of this vault'}
          </p>
        ) : (
          <button className={cta} onClick={connect} disabled={!!busy}>Connect your Stellar wallet</button>
        )}
      </section>

      {isPartner && !state.dissolved && (
        <section className="space-y-3">
          <h2 className={`${HEADING} text-xl uppercase`}>Spend</h2>
          <input className={input} placeholder="Recipient (G…)" value={to} onChange={(e) => setTo(e.target.value.trim())} />
          <div className="flex items-center gap-2">
            <input className={input} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
            <span className={META}>USDC</span>
          </div>
          {amount && (
            <p className={META}>{wouldExecuteNow ? 'Goes through now, on your signature alone' : 'Needs your partner to approve'}</p>
          )}
          <p className={META}>The recipient needs a USDC trustline</p>
          <button
            className={cta}
            disabled={!!busy || !to || !amount}
            onClick={() => run('Sending', () => act(`Spend of ${amount} USDC proposed`, (me) => buildProposeSpendTx(vaultId, me, to, amount)))}
          >
            {wouldExecuteNow ? 'Send' : 'Ask partner'}
          </button>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className={`${HEADING} text-xl uppercase`}>Waiting</h2>
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.id} className="space-y-2 rounded-xl bg-gray-50 px-4 py-3">
                <p className="font-mono text-sm">
                  {s.amount} USDC → {short(s.to)}
                  <span className={`${META} ml-2`}>asked by {short(s.proposer)}</span>
                </p>
                {isPartner && !state.dissolved && (
                  <div className="flex gap-2">
                    {!myApproval(s) && (
                      <button className={cta} disabled={!!busy} onClick={() => run('Approving', () => act(`Approved ${s.amount} USDC`, (me) => buildApproveSpendTx(vaultId, me, s.id)))}>
                        Approve
                      </button>
                    )}
                    <button className={secondary} disabled={!!busy} onClick={() => run('Cancelling', () => act('Spend cancelled', (me) => buildCancelSpendTx(vaultId, me, s.id)))}>
                      {myApproval(s) ? 'Withdraw' : 'Decline'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className={`${HEADING} text-xl uppercase`}>History</h2>
          <ul className="space-y-1">
            {history.map((s) => (
              <li key={s.id} className="font-mono text-xs text-gray-600">
                {s.createdAt.toLocaleString()} · {s.amount} USDC → {short(s.to)} · {s.status.toLowerCase()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!state.dissolved && (
        <section className="space-y-3">
          <h2 className={`${HEADING} text-xl uppercase`}>Dissolution</h2>
          {state.dissolution ? (
            <>
              <p className="text-sm text-gray-600">
                Requested by {short(state.dissolution.requester)}. {matured
                  ? 'The delay is over: anyone can now split the vault 50/50.'
                  : `It can be executed from ${state.dissolution.executableAt.toLocaleString()}.`}
              </p>
              {wallet === state.dissolution.requester && !matured && (
                <button className={secondary} disabled={!!busy} onClick={() => run('Cancelling', () => act('Dissolution cancelled', (me) => buildCancelDissolutionTx(vaultId, me)))}>
                  Cancel request
                </button>
              )}
              {wallet && matured && (
                <button className={cta} disabled={!!busy} onClick={() => run('Closing', () => act('Vault closed, halves set aside', (me) => buildExecuteDissolutionTx(vaultId, me)))}>
                  Close and split 50/50
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Either of you can start it. After {Math.round(config.dissolutionDelaySeconds / 86400)} days the vault splits
                50/50; until then, the one who asked can take it back.
              </p>
              {isPartner && (
                <button className={secondary} disabled={!!busy} onClick={() => run('Requesting', () => act('Dissolution requested', (me) => buildRequestDissolutionTx(vaultId, me)))}>
                  Request dissolution
                </button>
              )}
            </>
          )}
        </section>
      )}

      {state.dissolved && (
        <section className="space-y-3">
          <h2 className={`${HEADING} text-xl uppercase`}>Halves</h2>
          <p className="text-sm text-gray-600">
            Each half is paid out on its own, so one of you can’t hold up the other. Anyone can send a half on its
            way — it only ever goes to the partner it belongs to. Receiving needs a USDC trustline.
          </p>
          <ul className="space-y-2">
            {[
              { who: config.partnerA, owed: state.owedA, name: 'Partner A' },
              { who: config.partnerB, owed: state.owedB, name: 'Partner B' },
            ].map((h) => (
              <li key={h.who} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="font-mono text-sm">
                  {h.owed} USDC
                  <span className={`${META} ml-2`}>{h.name} · {short(h.who)}{wallet === h.who ? ' · you' : ''}</span>
                </span>
                {wallet && toStroops(h.owed) > BigInt(0) && (
                  <button className={cta} disabled={!!busy} onClick={() => run('Paying out', () => act(`${h.owed} USDC paid to ${short(h.who)}`, (me) => buildClaimShareTx(vaultId, me, h.who)))}>
                    {wallet === h.who ? 'Claim' : 'Send'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {wallet && toStroops(state.balance) > toStroops(state.owedA) + toStroops(state.owedB) && (
            <button className={secondary} disabled={!!busy} onClick={() => run('Splitting', () => act('Late arrivals split 50/50', (me) => buildExecuteDissolutionTx(vaultId, me)))}>
              Split what arrived since
            </button>
          )}
        </section>
      )}

      {busy && <p className={META}>{busy}…</p>}
      {error && <pre className="whitespace-pre-wrap rounded-xl bg-red-50 p-4 font-mono text-xs text-red-700">{error}</pre>}
      {done && (
        <p className="text-sm">
          {done.what} ·{' '}
          <a className="underline" href={`${STELLAR.explorerUrl}/tx/${done.hash}`} target="_blank" rel="noreferrer">view</a>
        </p>
      )}
    </main>
  );
}
