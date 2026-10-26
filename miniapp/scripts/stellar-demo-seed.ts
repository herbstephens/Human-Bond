/**
 * Seed a live demo vault on Stellar TESTNET — for the demo video and for UI work.
 *
 *   npm run stellar:demo-seed [label]        (default label: demo-bond)
 *
 * Creates two funded partner keys, deploys a vault (production timings: 3-day dissolution delay,
 * 90-day check-in, 30-day challenge), pays in 40 USDC (converted from XLM), executes a 10 USDC
 * spend by A alone, leaves a 30 USDC spend waiting for B, and writes a co-signed will
 * (two testnet heirs, one locked for a year). Prints the allowlist line and the partners' TESTNET secret keys, so they
 * can be imported into Freighter (set to testnet) to click through approve / dissolve.
 * The keys are throwaway testnet keys: never fund them on mainnet, never commit them.
 */
import { BASE_FEE, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { STELLAR, STELLAR_NETWORK, horizon } from '@/lib/stellar/config';
import type { BondLink } from '@/lib/stellar/bondLink';
import { buildConvertTx, findPayOptions, submitClassic } from '@/lib/stellar/payment';
import {
  buildDeployVaultTx,
  buildDepositTx,
  buildProposeSpendTx,
  coSignFirst,
  finishCoSignTx,
  submitSoroban,
  willArgs,
} from '@/lib/stellar/vault';

function sign(txXdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(txXdr, STELLAR.passphrase);
  tx.sign(signer);
  return tx.toXDR();
}

async function friendbot(account: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${account}`);
  if (!res.ok) throw new Error(`Friendbot ${res.status} for ${account}: ${await res.text()}`);
}

async function addTrustline(k: Keypair) {
  const account = await horizon.loadAccount(k.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(Operation.changeTrust({ asset: STELLAR.usdc }))
    .setTimeout(60)
    .build();
  tx.sign(k);
  await horizon.submitTransaction(tx);
}

async function main() {
  if (STELLAR_NETWORK !== 'testnet') throw new Error('The demo seed only runs on testnet');
  const label = process.argv[2] ?? 'demo-bond';
  // Made-up World Chain side: this seeds the Stellar half only.
  const link: BondLink = { bondId: `0x${'de'.repeat(32)}`, safe: `0x${'be'.repeat(20)}`, label };

  const [a, b, payer, shop] = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()];
  await Promise.all([a, b, payer, shop].map((k) => friendbot(k.publicKey())));
  await Promise.all([a, b, shop].map(addTrustline));

  const { xdr, vaultId } = await buildDeployVaultTx({ deployer: a.publicKey(), partnerA: a.publicKey(), partnerB: b.publicKey(), link });
  await submitSoroban(sign(xdr, a));

  const xlm = (await findPayOptions(payer.publicKey(), '40')).find((o) => o.sourceAsset === 'XLM');
  if (!xlm) throw new Error('No XLM → USDC path on testnet right now');
  await submitClassic(sign(await buildConvertTx({ payer: payer.publicKey(), usdcAmount: '40', option: xlm }), payer));
  await submitSoroban(sign(await buildDepositTx(vaultId, payer.publicKey(), '40'), payer));

  await submitSoroban(sign(await buildProposeSpendTx(vaultId, a.publicKey(), shop.publicKey(), '10'), a));
  await submitSoroban(sign(await buildProposeSpendTx(vaultId, a.publicKey(), shop.publicKey(), '30'), a));

  const [heir1, heir2] = [Keypair.random(), Keypair.random()];
  const heirs = [
    { heir: heir1.publicKey(), bps: 7_000, unlockAt: 0 },
    { heir: heir2.publicKey(), bps: 3_000, unlockAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 },
  ];
  const entries = await coSignFirst({ vaultId, method: 'set_will', args: willArgs(heirs), source: b.publicKey(), firstSigner: a });
  await submitSoroban(sign(await finishCoSignTx({ vaultId, method: 'set_will', args: willArgs(heirs), source: b.publicKey(), signedEntries: entries }), b));

  console.log(`vault       ${vaultId}`);
  console.log(`state       30 USDC in the vault · 10 spent by A · 30 waiting for B`);
  console.log(`will        70% ${heir1.publicKey()} · 30% ${heir2.publicKey()} (locked one year)`);
  console.log(`\nSTELLAR_TESTNET_DIRECTORY=${label}=${vaultId}`);
  console.log(`\nTESTNET ONLY — import into Freighter (testnet) to act as the partners:`);
  console.log(`partner A   ${a.publicKey()}  secret ${a.secret()}`);
  console.log(`partner B   ${b.publicKey()}  secret ${b.secret()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
