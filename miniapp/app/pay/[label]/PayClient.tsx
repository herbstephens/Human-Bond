'use client'

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { HEADING, META } from '@/lib/design';
import { ENS_PARENT } from '@/lib/contracts/registrar';
import { STELLAR, STELLAR_NETWORK } from '@/lib/stellar/config';
import { submitSignedTx } from '@/lib/stellar/jointAccount';
import { buildPayTx, findPayOptions, payUri, SLIPPAGE_BPS, type PayOption } from '@/lib/stellar/payment';
import { loadKit } from '@/lib/stellar/walletKit';

type Props = {
  label: string;
  accountId: string;
  address: string;
  proof: 'ens' | 'testnet-allowlist';
};

const input = 'w-full rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm outline-none';
const cta = 'rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-40';

function shortAsset(asset: string): string {
  return asset.split(':')[0];
}

export function PayClient({ label, accountId, address, proof }: Props) {
  const [amount, setAmount] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [options, setOptions] = useState<PayOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<string | null>(null);

  const uri = payUri(accountId, { amount: amount || undefined, msg: `To ${label}.${ENS_PARENT}` });

  useEffect(() => {
    QRCode.toDataURL(uri, { margin: 1, width: 240 }).then(setQr);
  }, [uri]);

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

  const connect = () =>
    run('Connecting', async () => {
      const kit = await loadKit();
      const { address: a } = await kit.authModal();
      setWallet(a);
    });

  const quote = () =>
    run('Finding the best rate', async () => {
      if (!wallet) throw new Error('Connect a wallet first');
      const found = await findPayOptions(wallet, amount);
      if (found.length === 0) throw new Error(`Nothing in ${wallet} can be converted into ${amount} USDC right now`);
      setOptions(found);
    });

  const pay = (option: PayOption) =>
    run('Paying', async () => {
      if (!wallet) throw new Error('Connect a wallet first');
      const kit = await loadKit();
      const xdr = await buildPayTx({ payer: wallet, jointAccountId: accountId, usdcAmount: amount, option });
      const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase: STELLAR.passphrase, address: wallet });
      setPaid(await submitSignedTx(signedTxXdr));
    });

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className={META}>Stellar · {STELLAR_NETWORK}</p>
        <h1 className={`${HEADING} text-3xl uppercase`}>{label}</h1>
        <p className="font-mono text-sm">{address}</p>
        <p className="font-serif italic text-gray-600">Pay the two of them at once. It arrives as USDC.</p>
        <p className={META}>
          {proof === 'ens'
            ? `Verified: ${label}.${ENS_PARENT} points to this account`
            : 'Testnet allowlist — not yet verified through ENS'}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>Amount</h2>
        <div className="flex items-center gap-2">
          <input
            className={input}
            inputMode="decimal"
            placeholder="Any amount"
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
        <h2 className={`${HEADING} text-xl uppercase`}>Scan with a Stellar wallet</h2>
        {qr && <img src={qr} alt="Stellar pay link" className="h-60 w-60" />}
        <a className="block break-all font-mono text-xs underline" href={uri}>{uri}</a>
      </section>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>Or pay from a browser wallet</h2>
        <p className="text-sm text-gray-600">
          Send XLM or anything else you hold. Stellar converts it on the way, and they receive exactly the USDC above.
        </p>
        {wallet ? (
          <p className="break-all font-mono text-xs">{wallet}</p>
        ) : (
          <button className={cta} onClick={connect} disabled={!!busy}>Connect wallet</button>
        )}
        {wallet && (
          <button className={cta} onClick={quote} disabled={!!busy || !amount}>Find rate</button>
        )}
        {options && (
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={`${o.sourceAsset}-${o.path.length}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="font-mono text-sm">
                  {o.sourceAmount} {shortAsset(o.sourceAsset)}
                  <span className={`${META} ml-2`}>{o.path.length === 0 ? 'direct' : `via ${o.path.length} hop`}</span>
                </span>
                <button className={cta} onClick={() => pay(o)} disabled={!!busy}>Pay</button>
              </li>
            ))}
            <li className={META}>Spends at most {SLIPPAGE_BPS / 100}% more than quoted, or nothing moves</li>
          </ul>
        )}
      </section>

      {busy && <p className={META}>{busy}…</p>}
      {error && <pre className="whitespace-pre-wrap rounded-xl bg-red-50 p-4 font-mono text-xs text-red-700">{error}</pre>}
      {paid && (
        <section className="space-y-2 rounded-2xl bg-gray-50 p-5">
          <h2 className={`${HEADING} text-xl uppercase`}>Paid</h2>
          <p className="text-sm">{amount} USDC is in the joint account of {label}.</p>
          <a className="text-xs underline" href={`${STELLAR.explorerUrl}/tx/${paid}`} target="_blank" rel="noreferrer">
            View the transaction
          </a>
        </section>
      )}
    </main>
  );
}
