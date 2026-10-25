/**
 * Stellar joint account smoke test — runs headless on testnet.
 *
 *   NEXT_PUBLIC_STELLAR_HOME_DOMAIN=localhost:3000 npm run stellar:smoke <bondId | synthetic>
 *
 * Reads a real bond from World Chain by id. `synthetic` uses a made-up bond link instead — for
 * environments with no shared wallet registered yet; it tests the Stellar side only. Creates
 * three funded testnet keys (funder, partner A, partner B), creates the joint account in one
 * transaction, and checks its shape. Then proves the 2-of-2: a payment signed by one partner
 * alone is rejected, the same payment signed by both goes through.
 * Prints the env line to put the account on the testnet allowlist.
 */
import { Keypair, Operation, TransactionBuilder, BASE_FEE, Asset } from '@stellar/stellar-sdk';
import type { Hex } from 'viem';
import { STELLAR, STELLAR_NETWORK, horizon } from '@/lib/stellar/config';
import { fetchBondLink, type BondLink } from '@/lib/stellar/bondLink';
import { buildCreateJointAccountTx, inspectJointAccount } from '@/lib/stellar/jointAccount';

// Clearly fake values: World Chain is not consulted, only the Stellar mechanics are tested.
const SYNTHETIC_LINK: BondLink = {
  bondId: `0x${'ab'.repeat(32)}`,
  safe: `0x${'cd'.repeat(20)}`,
  label: 'smoke-test',
};

async function friendbot(account: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${account}`);
  if (!res.ok) throw new Error(`Friendbot ${res.status} for ${account}: ${await res.text()}`);
}

async function paymentFromJoint(jointId: string, to: string, signers: Keypair[]) {
  const joint = await horizon.loadAccount(jointId);
  const tx = new TransactionBuilder(joint, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(Operation.payment({ destination: to, asset: Asset.native(), amount: '1' }))
    .setTimeout(60)
    .build();
  for (const s of signers) tx.sign(s);
  return horizon.submitTransaction(tx);
}

async function main() {
  if (STELLAR_NETWORK !== 'testnet') throw new Error('The smoke test only runs on testnet');

  const arg = process.argv[2];
  if (!arg) throw new Error('Pass a bond id (0x…) or "synthetic"');
  const link = arg === 'synthetic' ? SYNTHETIC_LINK : await fetchBondLink(arg as Hex);
  console.log('bond     ', link.bondId);
  console.log('safe     ', link.safe);
  console.log('label    ', link.label);

  const funder = Keypair.random();
  const partnerA = Keypair.random();
  const partnerB = Keypair.random();
  await Promise.all([funder, partnerA, partnerB].map((k) => friendbot(k.publicKey())));

  const { xdr, accountId } = await buildCreateJointAccountTx({
    funder: funder.publicKey(),
    partnerA: partnerA.publicKey(),
    partnerB: partnerB.publicKey(),
    link,
  });
  const tx = TransactionBuilder.fromXDR(xdr, STELLAR.passphrase);
  tx.sign(funder);
  const created = await horizon.submitTransaction(tx);
  console.log('created  ', accountId, `${STELLAR.explorerUrl}/tx/${created.hash}`);

  const check = await inspectJointAccount(accountId);
  if (!check.ok) throw new Error(`Joint account failed inspection: ${check.reason}`);
  if (check.account.link.label !== link.label || check.account.link.safe.toLowerCase() !== link.safe.toLowerCase()) {
    throw new Error('Bond link read back does not match what was written');
  }
  console.log('inspect   ok', check.account.balances);

  const oneSigner = await paymentFromJoint(accountId, funder.publicKey(), [partnerA]).then(
    () => 'accepted',
    (e: { response?: { data?: { extras?: { result_codes?: unknown } } } }) =>
      JSON.stringify(e.response?.data?.extras?.result_codes),
  );
  if (oneSigner === 'accepted') throw new Error('A payment signed by one partner was accepted — 2-of-2 is broken');
  console.log('1 signer  rejected', oneSigner);

  const both = await paymentFromJoint(accountId, funder.publicKey(), [partnerA, partnerB]);
  console.log('2 signers accepted', both.hash);

  console.log(`\nSTELLAR_TESTNET_DIRECTORY=${link.label}=${accountId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
