'use client'

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { HEADING, META } from '@/lib/design';
import { ENS_PARENT } from '@/lib/contracts/registrar';
import { STELLAR, STELLAR_NETWORK } from '@/lib/stellar/config';
import {
  buildConvertTx,
  findPayOptions,
  submitClassic,
  toStroops,
  usdcBalanceOf,
  SLIPPAGE_BPS,
  type PayOption,
} from '@/lib/stellar/payment';
import { buildDepositTx, submitSoroban } from '@/lib/stellar/vault';
import { loadKit } from '@/lib/stellar/walletKit';

type Props = {
  label: string;
  vaultId: string;
  /** This page's own URL, for the QR code: scan, open, pay from a phone wallet. */
  pageUrl: string;
  proof: 'ens' | 'testnet-allowlist';
};

const input = 'w-full rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm outline-none';
const cta = 'rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-40';

export function PayClient({ label, vaultId, pageUrl, proof }: Props) {
  const [amount, setAmount] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [usdcHeld, setUsdcHeld] = useState<string | null>(null);
  const [options, setOptions] = useState<PayOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(pageUrl, { margin: 1, width: 240 }).then(setQr);
  }, [pageUrl]);

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

  async function sign(txXdr: string): Promise<string> {
    if (!wallet) throw new Error('Connect a wallet first');
    const kit = await loadKit();
    const { signedTxXdr } = await kit.signTransaction(txXdr, { networkPassphrase: STELLAR.passphrase, address: wallet });
    return signedTxXdr;
  }

  const connect = () =>
    run('Connecting', async () => {
      const kit = await loadKit();
      const { address } = await kit.authModal();
      setWallet(address);
      setUsdcHeld(await usdcBalanceOf(address));
    });

  const hasEnoughUsdc = !!(usdcHeld && amount && toStroops(usdcHeld) >= toStroops(amount));

  const quote = () =>
    run('Finding the best rate', async () => {
      if (!wallet) throw new Error('Connect a wallet first');
      const found = await findPayOptions(wallet, amount);
      if (found.length === 0) throw new Error(`Nothing in ${wallet} can be converted into ${amount} USDC right now`);
      setOptions(found);
    });

  const deposit = () =>
    run('Paying', async () => {
      if (!wallet) throw new Error('Connect a wallet first');
      setPaid(await submitSoroban(await sign(await buildDepositTx(vaultId, wallet, amount))));
    });

  const convertThenDeposit = (option: PayOption) =>
    run('Step 1 of 2 · converting to USDC', async () => {
      if (!wallet) throw new Error('Connect a wallet first');
      await submitClassic(await sign(await buildConvertTx({ payer: wallet, usdcAmount: amount, option })));
      setUsdcHeld(await usdcBalanceOf(wallet));
      setOptions(null);
      setBusy('Step 2 of 2 · paying the vault');
      setPaid(await submitSoroban(await sign(await buildDepositTx(vaultId, wallet, amount))));
    });

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className={META}>Stellar · {STELLAR_NETWORK}</p>
        <h1 className={`${HEADING} text-3xl uppercase`}>{label}</h1>
        <p className="break-all font-mono text-xs">{vaultId}</p>
        <p className="font-serif italic text-gray-600">Pay the two of them at once. It lands in their shared vault as USDC.</p>
        <p className={META}>
          {proof === 'ens'
            ? `Verified: ${label}.${ENS_PARENT} points to this vault`
            : 'Testnet allowlist — not yet verified through ENS'}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>Amount</h2>
        <div className="flex items-center gap-2">
          <input
            className={input}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.trim());
              setOptions(null);
            }}
          />
          <span className={META}>USDC</span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>Pay from a Stellar wallet</h2>
        {wallet ? (
          <p className="break-all font-mono text-xs">
            {wallet}
            <span className={`${META} ml-2`}>{usdcHeld} USDC</span>
          </p>
        ) : (
          <button className={cta} onClick={connect} disabled={!!busy}>Connect wallet</button>
        )}

        {wallet && amount && hasEnoughUsdc && (
          <button className={cta} onClick={deposit} disabled={!!busy}>Pay {amount} USDC</button>
        )}

        {wallet && amount && !hasEnoughUsdc && (
          <>
            <p className="text-sm text-gray-600">
              Not enough USDC? Pay with XLM or anything else you hold: Stellar converts it into exactly {amount} USDC
              first, then you send it. Two signatures.
            </p>
            {!options && <button className={cta} onClick={quote} disabled={!!busy}>Find rate</button>}
          </>
        )}

        {options && (
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={`${o.sourceAsset}-${o.path.length}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="font-mono text-sm">
                  {o.sourceAmount} {o.sourceAsset.split(':')[0]}
                  <span className={`${META} ml-2`}>{o.path.length === 0 ? 'direct' : `via ${o.path.length} hop`}</span>
                </span>
                <button className={cta} onClick={() => convertThenDeposit(o)} disabled={!!busy}>Pay</button>
              </li>
            ))}
            <li className={META}>Spends at most {SLIPPAGE_BPS / 100}% more than quoted, or nothing moves</li>
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>On your phone</h2>
        {qr && <img src={qr} alt={`Link to ${pageUrl}`} className="h-48 w-48" />}
        <p className={META}>Scan to open this page</p>
      </section>

      {busy && <p className={META}>{busy}…</p>}
      {error && <pre className="whitespace-pre-wrap rounded-xl bg-red-50 p-4 font-mono text-xs text-red-700">{error}</pre>}
      {paid && (
        <section className="space-y-2 rounded-2xl bg-gray-50 p-5">
          <h2 className={`${HEADING} text-xl uppercase`}>Paid</h2>
          <p className="text-sm">{amount} USDC is in the vault of {label}.</p>
          <a className="text-xs underline" href={`${STELLAR.explorerUrl}/tx/${paid}`} target="_blank" rel="noreferrer">
            View the transaction
          </a>
        </section>
      )}
    </main>
  );
}
