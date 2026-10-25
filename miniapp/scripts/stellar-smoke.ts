/**
 * Stellar bond vault smoke test — runs headless on testnet against the deployed vault wasm.
 *
 *   npm run stellar:smoke <bondId | synthetic>
 *
 * Reads a real bond from World Chain by id. `synthetic` uses a made-up bond link instead — for
 * environments with no shared wallet registered yet; it tests the Stellar side only.
 *
 *   1. Deploys a vault for partners A and B (30-second dissolution delay, to keep the run short).
 *   2. A payer converts XLM → 40 USDC and pays it into the vault.
 *   3. A spends 10 alone (immediate). A proposes 30 (waits); B approves (executes).
 *   4. B proposes 20: over the 25/day budget after A's 10, so it waits; A cancels it.
 *   5. A requests dissolution; executing early fails; after the delay anyone executes and the
 *      vault splits 50/50.
 * Prints the env line to put the vault on the testnet allowlist.
 */
import { BASE_FEE, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import type { Hex } from 'viem';
import { STELLAR, STELLAR_NETWORK, horizon } from '@/lib/stellar/config';
import { fetchBondLink, type BondLink } from '@/lib/stellar/bondLink';
import { buildConvertTx, findPayOptions, submitClassic, usdcBalanceOf } from '@/lib/stellar/payment';
import {
  buildApproveSpendTx,
  buildCancelSpendTx,
  buildDeployVaultTx,
  buildDepositTx,
  buildExecuteDissolutionTx,
  buildProposeSpendTx,
  buildRequestDissolutionTx,
  readVaultState,
  submitSoroban,
} from '@/lib/stellar/vault';

// Clearly fake values: World Chain is not consulted, only the Stellar mechanics are tested.
const SYNTHETIC_LINK: BondLink = {
  bondId: `0x${'ab'.repeat(32)}`,
  safe: `0x${'cd'.repeat(20)}`,
  label: 'smoke-test',
};

const DISSOLUTION_DELAY_SECONDS = 30;

async function friendbot(account: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${account}`);
  if (!res.ok) throw new Error(`Friendbot ${res.status} for ${account}: ${await res.text()}`);
}

function sign(txXdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(txXdr, STELLAR.passphrase);
  tx.sign(signer);
  return tx.toXDR();
}

const run = async (txXdr: Promise<string>, signer: Keypair) => submitSoroban(sign(await txXdr, signer));

/** Anyone receiving USDC from the vault needs a USDC trustline, or the transfer fails. */
async function addTrustline(k: Keypair) {
  const account = await horizon.loadAccount(k.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(Operation.changeTrust({ asset: STELLAR.usdc }))
    .setTimeout(60)
    .build();
  tx.sign(k);
  await horizon.submitTransaction(tx);
}

async function payIn(vaultId: string, payer: Keypair, usdc: string) {
  const xlm = (await findPayOptions(payer.publicKey(), usdc)).find((o) => o.sourceAsset === 'XLM');
  if (!xlm) throw new Error(`No XLM → USDC path for ${usdc}`);
  await submitClassic(sign(await buildConvertTx({ payer: payer.publicKey(), usdcAmount: usdc, option: xlm }), payer));
  await run(buildDepositTx(vaultId, payer.publicKey(), usdc), payer);
  return xlm.sourceAmount;
}

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (STELLAR_NETWORK !== 'testnet') throw new Error('The smoke test only runs on testnet');
  const arg = process.argv[2];
  if (!arg) throw new Error('Pass a bond id (0x…) or "synthetic"');
  const link = arg === 'synthetic' ? SYNTHETIC_LINK : await fetchBondLink(arg as Hex);
  console.log('bond      ', link.bondId, link.label);

  const [a, b, payer, shop] = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()];
  await Promise.all([a, b, payer, shop].map((k) => friendbot(k.publicKey())));
  await Promise.all([a, b, shop].map(addTrustline));

  // 1. Deploy (A pays the fee).
  const { xdr: deployXdr, vaultId } = await buildDeployVaultTx({
    deployer: a.publicKey(),
    partnerA: a.publicKey(),
    partnerB: b.publicKey(),
    link,
    dissolutionDelaySeconds: DISSOLUTION_DELAY_SECONDS,
  });
  const deployed = await submitSoroban(sign(deployXdr, a));
  console.log('deployed  ', vaultId, `${STELLAR.explorerUrl}/tx/${deployed}`);

  // 2. Payer converts XLM → USDC, then pays the vault.
  const spentXlm = await payIn(vaultId, payer, '40');
  let state = await readVaultState(vaultId);
  expect(state.balance === '40.0000000', `vault should hold 40, holds ${state.balance}`);
  console.log('paid in   ', `${spentXlm} XLM → 40 USDC in the vault`);

  // 3. Small spend alone; large spend with approval.
  await run(buildProposeSpendTx(vaultId, a.publicKey(), shop.publicKey(), '10'), a);
  await run(buildProposeSpendTx(vaultId, a.publicKey(), shop.publicKey(), '30'), a);
  state = await readVaultState(vaultId);
  expect(state.spends[0].status === 'Executed', 'the 10 USDC spend should execute on A alone');
  expect(state.spends[1].status === 'Pending', 'the 30 USDC spend should wait for B');
  console.log('A alone    10 executed, 30 pending; budget left today', state.remainingFreeAllowance);

  await run(buildApproveSpendTx(vaultId, b.publicKey(), 1), b);
  state = await readVaultState(vaultId);
  expect(state.spends[1].status === 'Executed', 'B approval should execute the 30 USDC spend');
  expect((await usdcBalanceOf(shop.publicKey())) === '40.0000000', 'shop should have received 40');
  console.log('B approves 30 executed; shop holds 40 USDC');

  // 4. Over budget → waits; the other partner cancels it.
  await payIn(vaultId, payer, '29');
  await run(buildProposeSpendTx(vaultId, b.publicKey(), shop.publicKey(), '20'), b);
  state = await readVaultState(vaultId);
  expect(state.spends[2].status === 'Pending', '20 USDC after 10 today should exceed the 25 budget and wait');
  await run(buildCancelSpendTx(vaultId, a.publicKey(), 2), a);
  state = await readVaultState(vaultId);
  expect(state.spends[2].status === 'Cancelled', "A should be able to cancel B's pending spend");
  console.log('budget     20 waited (over 25/day), A cancelled it');

  // 5. Dissolution of the remaining 29 USDC.
  await run(buildRequestDissolutionTx(vaultId, a.publicKey()), a);
  const early = await run(buildExecuteDissolutionTx(vaultId, shop.publicKey()), shop).then(() => 'accepted', (e: Error) => e.message);
  expect(early !== 'accepted', 'executing before the delay must fail');
  console.log('dissolve   requested; early execute refused');

  state = await readVaultState(vaultId);
  const waitMs = (state.dissolution as { executableAt: Date }).executableAt.getTime() - Date.now() + 8_000;
  console.log(`waiting    ${Math.ceil(waitMs / 1000)}s for the dissolution delay`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // Anyone may execute — the shop does it here.
  await run(buildExecuteDissolutionTx(vaultId, shop.publicKey()), shop);
  state = await readVaultState(vaultId);
  const [aAfter, bAfter] = await Promise.all([usdcBalanceOf(a.publicKey()), usdcBalanceOf(b.publicKey())]);
  expect(state.dissolved && state.balance === '0.0000000', 'vault should be dissolved and empty');
  expect(aAfter === '14.5000000' && bAfter === '14.5000000', `expected 14.5 each, got A ${aAfter} B ${bAfter}`);
  console.log('split      A', aAfter, '· B', bAfter);

  console.log(`\nSTELLAR_TESTNET_DIRECTORY=${link.label}=${vaultId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
