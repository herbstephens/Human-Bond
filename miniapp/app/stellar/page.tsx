'use client'

/**
 * Create a bond's joint account on Stellar.
 *
 * Standalone web page, not a World App screen: the partners sign with a Stellar wallet
 * (Freighter, xBull, Lobstr… via Stellar Wallets Kit), which World App does not host. The
 * bond itself is read from World Chain by id, so the link written to Stellar is the real one.
 */
import { useState } from 'react';
import type { Hex } from 'viem';
import { HEADING, META } from '@/lib/design';
import { ENS_PARENT } from '@/lib/contracts/registrar';
import { STELLAR, STELLAR_NETWORK, federationAddress } from '@/lib/stellar/config';
import { fetchBondLink, type BondLink } from '@/lib/stellar/bondLink';
import { buildCreateJointAccountTx, submitSignedTx, JOINT_ACCOUNT_STARTING_XLM } from '@/lib/stellar/jointAccount';
import { ENS_STELLAR_TEXT_KEY } from '@/lib/stellar/directory';
import { loadKit } from '@/lib/stellar/walletKit';

type Created = { accountId: string; hash: string };

const input = 'w-full rounded-xl bg-gray-100 px-4 py-3 font-mono text-sm outline-none';
const cta = 'rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-40';

export default function StellarJointAccountPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [bondId, setBondId] = useState('');
  const [link, setLink] = useState<BondLink | null>(null);
  const [partnerA, setPartnerA] = useState('');
  const [partnerB, setPartnerB] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  // Errors are shown, not swallowed: the full message goes on screen and to the console.
  async function run(label: string, step: () => Promise<void>) {
    setBusy(label);
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
      const { address } = await kit.authModal();
      setWallet(address);
      if (!partnerA) setPartnerA(address);
    });

  const friendbot = () =>
    run('Funding', async () => {
      const res = await fetch(`https://friendbot.stellar.org?addr=${wallet}`);
      if (!res.ok) throw new Error(`Friendbot ${res.status}: ${await res.text()}`);
    });

  const loadBond = () =>
    run('Reading the bond', async () => {
      setLink(await fetchBondLink(bondId.trim() as Hex));
    });

  const create = () =>
    run('Creating the joint account', async () => {
      if (!wallet || !link) throw new Error('Connect a wallet and load the bond first');
      const kit = await loadKit();
      const { xdr, accountId } = await buildCreateJointAccountTx({
        funder: wallet,
        partnerA: partnerA.trim(),
        partnerB: partnerB.trim(),
        link,
      });
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        networkPassphrase: STELLAR.passphrase,
        address: wallet,
      });
      const hash = await submitSignedTx(signedTxXdr);
      setCreated({ accountId, hash });
    });

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className={META}>Stellar · {STELLAR_NETWORK}</p>
        <h1 className={`${HEADING} text-3xl uppercase`}>Joint account</h1>
        <p className="font-serif italic text-gray-600">
          One account, two keys. Anyone can pay in. Only the two of you, together, can move it.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>1 · Your Stellar wallet</h2>
        {wallet ? (
          <p className="break-all font-mono text-sm">{wallet}</p>
        ) : (
          <button className={cta} onClick={connect} disabled={!!busy}>Connect wallet</button>
        )}
        {wallet && STELLAR_NETWORK === 'testnet' && (
          <button className="text-xs underline" onClick={friendbot} disabled={!!busy}>
            Fund this wallet with testnet XLM
          </button>
        )}
        <p className={META}>This wallet pays the fee and {JOINT_ACCOUNT_STARTING_XLM} XLM starting balance</p>
      </section>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>2 · Your bond</h2>
        <input className={input} placeholder="Bond id (0x…)" value={bondId} onChange={(e) => setBondId(e.target.value)} />
        <button className={cta} onClick={loadBond} disabled={!!busy || !bondId}>Read from World Chain</button>
        {link && (
          <dl className="space-y-1 text-sm">
            <div><dt className={META}>Name</dt><dd className="font-mono">{link.label}.{ENS_PARENT}</dd></div>
            <div><dt className={META}>Bond Safe</dt><dd className="break-all font-mono">{link.safe}</dd></div>
          </dl>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={`${HEADING} text-xl uppercase`}>3 · The two signers</h2>
        <input className={input} placeholder="Partner A Stellar account (G…)" value={partnerA} onChange={(e) => setPartnerA(e.target.value)} />
        <input className={input} placeholder="Partner B Stellar account (G…)" value={partnerB} onChange={(e) => setPartnerB(e.target.value)} />
        <button className={cta} onClick={create} disabled={!!busy || !wallet || !link || !partnerA || !partnerB}>
          Create joint account
        </button>
      </section>

      {busy && <p className={META}>{busy}…</p>}
      {error && <pre className="whitespace-pre-wrap rounded-xl bg-red-50 p-4 font-mono text-xs text-red-700">{error}</pre>}

      {created && link && (
        <section className="space-y-3 rounded-2xl bg-gray-50 p-5">
          <h2 className={`${HEADING} text-xl uppercase`}>Created</h2>
          <div><p className={META}>Pay this address</p><p className="font-mono text-sm">{federationAddress(link.label)}</p></div>
          <div><p className={META}>Account</p><p className="break-all font-mono text-sm">{created.accountId}</p></div>
          <a className="text-xs underline" href={`${STELLAR.explorerUrl}/tx/${created.hash}`} target="_blank" rel="noreferrer">
            View the transaction
          </a>
          <a className="block text-xs underline" href={`/pay/${link.label}`}>Open the pay page</a>
          <p className="text-xs text-gray-600">
            The name resolves once the bond Safe sets the ENS text record <code>{ENS_STELLAR_TEXT_KEY}</code> to this
            account{STELLAR_NETWORK === 'testnet' && <> — or, on testnet, once it is added to <code>STELLAR_TESTNET_DIRECTORY</code></>}.
          </p>
        </section>
      )}
    </main>
  );
}
