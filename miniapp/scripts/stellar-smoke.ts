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
 *   5. Someone sends the vault 5 XLM by mistake; it comes out only with BOTH partners signing
 *      (rescue), and USDC can't be taken out that way.
 *   6. A requests dissolution; executing early fails; after the delay anyone executes, which
 *      books 14.5 / 14.5. B has NO USDC trustline: A's half is paid out anyway, B's claim fails
 *      and stays booked, and once B adds a trustline B's half arrives (the C1 regression).
 *   7. Inheritance, on a second vault with 20-second check-ins and a 15-second challenge window:
 *      the couple co-signs a will (60% adult heir, 40% minor locked until a date); a lapse
 *      reported for A is vetoed by A checking in; A then dies; survivor B spends above the
 *      solo limit; B dies; the estate is booked; the adult heir claims, the minor's claim is
 *      refused until the unlock date, then succeeds.
 * Prints the env line to put the vault on the testnet allowlist.
 */
import { Asset, BASE_FEE, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import type { Hex } from 'viem';
import { STELLAR, STELLAR_NETWORK, horizon } from '@/lib/stellar/config';
import { fetchBondLink, type BondLink } from '@/lib/stellar/bondLink';
import { buildConvertTx, findPayOptions, submitClassic, usdcBalanceOf } from '@/lib/stellar/payment';
import {
  buildApproveSpendTx,
  buildCancelSpendTx,
  buildConfirmDeathTx,
  buildClaimInheritanceTx,
  buildHeartbeatTx,
  buildReportLapseTx,
  coSignFirst,
  finishCoSignTx,
  willArgs,
  buildClaimShareTx,
  buildRescueTx,
  buildTokenTransferTx,
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

/** Wait until `when` (ledger time ≈ wall time) plus a margin for ledger close. */
async function waitUntil(when: Date, label: string) {
  const ms = when.getTime() - Date.now() + 7_000;
  if (ms > 0) {
    console.log(`waiting    ${Math.ceil(ms / 1000)}s ${label}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const HEARTBEAT_SECONDS = 20;
const CHALLENGE_SECONDS = 15;

async function inheritancePhase(link: BondLink, payer: Keypair, shop: Keypair) {
  const [a, b, adult, minor] = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()];
  await Promise.all([a, b, adult, minor].map((k) => friendbot(k.publicKey())));
  await Promise.all([adult, minor].map(addTrustline));

  const { xdr: deployXdr, vaultId } = await buildDeployVaultTx({
    deployer: a.publicKey(),
    partnerA: a.publicKey(),
    partnerB: b.publicKey(),
    link: { ...link, label: `${link.label}-estate` },
    heartbeatIntervalSeconds: HEARTBEAT_SECONDS,
    challengeWindowSeconds: CHALLENGE_SECONDS,
  });
  await submitSoroban(sign(deployXdr, a));
  console.log('\nestate     vault', vaultId);

  // The will, co-signed in two steps exactly as the page does it: A signs first, B submits.
  // Far enough out to still be locked when the estate is claimed (~200 s of this phase run first).
  const unlockAt = Math.floor(Date.now() / 1000) + 330;
  const heirs = [
    { heir: adult.publicKey(), bps: 6_000, unlockAt: 0 },
    { heir: minor.publicKey(), bps: 4_000, unlockAt },
  ];
  const signedEntries = await coSignFirst({ vaultId, method: 'set_will', args: willArgs(heirs), source: b.publicKey(), firstSigner: a });
  await submitSoroban(sign(await finishCoSignTx({ vaultId, method: 'set_will', args: willArgs(heirs), source: b.publicKey(), signedEntries }), b));
  let state = await readVaultState(vaultId);
  expect(state.will.length === 2 && state.will[0].bps === 6_000, `will not stored: ${JSON.stringify(state.will)}`);
  console.log('will       60% adult · 40% minor (locked until', new Date(unlockAt * 1000).toISOString() + ')');

  await payIn(vaultId, payer, '20');

  // A lapse reported for A is cancelled by A checking in ("I'm alive").
  await waitUntil(new Date(state.lifeA.lastSeen.getTime() + HEARTBEAT_SECONDS * 1000), 'for A to miss a check-in');
  await run(buildHeartbeatTx(vaultId, b.publicKey()), b);
  await run(buildReportLapseTx(vaultId, adult.publicKey(), a.publicKey()), adult);
  await run(buildHeartbeatTx(vaultId, a.publicKey()), a);
  state = await readVaultState(vaultId);
  expect(state.lifeA.lapseEndsAt === null && !state.lifeA.deceased, 'a check-in must cancel the reported lapse');
  console.log('veto       lapse reported for A, cancelled by A checking in');

  // A stops for good. B keeps checking in.
  await waitUntil(new Date(state.lifeA.lastSeen.getTime() + HEARTBEAT_SECONDS * 1000), 'for A to miss again');
  await run(buildHeartbeatTx(vaultId, b.publicKey()), b);
  await run(buildReportLapseTx(vaultId, adult.publicKey(), a.publicKey()), adult);
  const early = await run(buildConfirmDeathTx(vaultId, adult.publicKey(), a.publicKey()), adult).then(() => 'confirmed', (e: Error) => e.message);
  expect(early !== 'confirmed', 'death must not be confirmable inside the challenge window');
  state = await readVaultState(vaultId);
  await waitUntil(state.lifeA.lapseEndsAt as Date, 'for the challenge window');
  await run(buildHeartbeatTx(vaultId, b.publicKey()), b);
  await run(buildConfirmDeathTx(vaultId, adult.publicKey(), a.publicKey()), adult);
  state = await readVaultState(vaultId);
  expect(state.lifeA.deceased && !state.lifeB.deceased, 'A should be confirmed dead, B alive');
  console.log('death      A confirmed after an unanswered challenge');

  // The survivor owns the vault: 15 USDC (over the 10 solo limit) goes through on B alone.
  const shopBefore = await usdcBalanceOf(shop.publicKey());
  await run(buildProposeSpendTx(vaultId, b.publicKey(), shop.publicKey(), '15'), b);
  const shopAfter = await usdcBalanceOf(shop.publicKey());
  expect(Number(shopAfter) - Number(shopBefore) === 15, `survivor spend should execute at once (${shopBefore} → ${shopAfter})`);
  console.log('survivor   B spent 15 USDC alone, over the solo limit');

  // B stops. The estate (5 USDC) goes to the heirs.
  state = await readVaultState(vaultId);
  await waitUntil(new Date(state.lifeB.lastSeen.getTime() + HEARTBEAT_SECONDS * 1000), 'for B to miss a check-in');
  await run(buildReportLapseTx(vaultId, adult.publicKey(), b.publicKey()), adult);
  state = await readVaultState(vaultId);
  await waitUntil(state.lifeB.lapseEndsAt as Date, 'for the challenge window');
  await run(buildConfirmDeathTx(vaultId, adult.publicKey(), b.publicKey()), adult);
  state = await readVaultState(vaultId);
  expect(state.will[0].owed === '3.0000000' && state.will[1].owed === '2.0000000', `estate booking wrong: ${JSON.stringify(state.will)}`);
  console.log('estate     booked 3 USDC adult · 2 USDC minor');

  await run(buildClaimInheritanceTx(vaultId, shop.publicKey(), adult.publicKey()), shop);
  expect((await usdcBalanceOf(adult.publicKey())) === '3.0000000', 'adult heir should hold 3 USDC');
  const locked = await run(buildClaimInheritanceTx(vaultId, shop.publicKey(), minor.publicKey()), shop).then(() => 'paid', (e: Error) => e.message);
  expect(locked !== 'paid', "the minor's share must stay locked until its date");
  console.log('heirs      adult claimed 3 · minor refused (locked)');
  await waitUntil(new Date(unlockAt * 1000), "for the minor's unlock date");
  await run(buildClaimInheritanceTx(vaultId, minor.publicKey(), minor.publicKey()), minor);
  state = await readVaultState(vaultId);
  expect((await usdcBalanceOf(minor.publicKey())) === '2.0000000' && state.balance === '0.0000000', 'minor should hold 2 USDC and the vault be empty');
  console.log('heirs      minor claimed 2 after the unlock date · vault empty');
}

async function main() {
  if (STELLAR_NETWORK !== 'testnet') throw new Error('The smoke test only runs on testnet');
  const arg = process.argv[2];
  if (!arg) throw new Error('Pass a bond id (0x…) or "synthetic"');
  const link = arg === 'synthetic' ? SYNTHETIC_LINK : await fetchBondLink(arg as Hex);
  console.log('bond      ', link.bondId, link.label);

  const [a, b, payer, shop] = [Keypair.random(), Keypair.random(), Keypair.random(), Keypair.random()];
  await Promise.all([a, b, payer, shop].map((k) => friendbot(k.publicKey())));
  // B deliberately gets no USDC trustline: the dissolution must not depend on B.
  await Promise.all([a, shop].map(addTrustline));

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

  // 5. A stray token: 5 XLM sent to the vault comes out only with both partners.
  const xlmSac = Asset.native().contractId(STELLAR.passphrase);
  await run(buildTokenTransferTx(xlmSac, payer.publicKey(), vaultId, '5'), payer);
  const usdcRescue = await buildRescueTx({ vaultId, source: a.publicKey(), token: STELLAR.usdcContractId, to: a.publicKey(), amount: '1', otherSigner: b })
    .then(() => 'built', (e: Error) => e.message);
  expect(usdcRescue !== 'built', 'rescuing the vault token (USDC) must be refused');
  const shopXlmBefore = (await horizon.loadAccount(shop.publicKey())).balances.find((x) => x.asset_type === 'native')!.balance;
  await submitSoroban(sign(await buildRescueTx({ vaultId, source: a.publicKey(), token: xlmSac, to: shop.publicKey(), amount: '5', otherSigner: b }), a));
  const shopXlmAfter = (await horizon.loadAccount(shop.publicKey())).balances.find((x) => x.asset_type === 'native')!.balance;
  expect(Number(shopXlmAfter) - Number(shopXlmBefore) > 4.99, `shop should have received 5 XLM (${shopXlmBefore} → ${shopXlmAfter})`);
  console.log('rescue     5 XLM out with A + B signing; USDC rescue refused');

  // 6. Dissolution of the remaining 29 USDC.
  await run(buildRequestDissolutionTx(vaultId, a.publicKey()), a);
  const early = await run(buildExecuteDissolutionTx(vaultId, shop.publicKey()), shop).then(() => 'accepted', (e: Error) => e.message);
  expect(early !== 'accepted', 'executing before the delay must fail');
  console.log('dissolve   requested; early execute refused');

  state = await readVaultState(vaultId);
  const waitMs = (state.dissolution as { executableAt: Date }).executableAt.getTime() - Date.now() + 8_000;
  console.log(`waiting    ${Math.ceil(waitMs / 1000)}s for the dissolution delay`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // Anyone may execute — the shop does it here. It books the halves and moves nothing.
  await run(buildExecuteDissolutionTx(vaultId, shop.publicKey()), shop);
  state = await readVaultState(vaultId);
  expect(state.dissolved && state.owedA === '14.5000000' && state.owedB === '14.5000000', `expected 14.5 booked each, got A ${state.owedA} B ${state.owedB}`);
  expect(state.balance === '29.0000000', 'booking must not move tokens');
  console.log('booked     A', state.owedA, '· B', state.owedB);

  // A's half goes out even though B can't receive.
  await run(buildClaimShareTx(vaultId, shop.publicKey(), a.publicKey()), shop);
  expect((await usdcBalanceOf(a.publicKey())) === '14.5000000', 'A should hold 14.5 USDC');
  const bBlocked = await run(buildClaimShareTx(vaultId, shop.publicKey(), b.publicKey()), shop).then(() => 'paid', (e: Error) => e.message);
  expect(bBlocked !== 'paid', "B's claim must fail while B has no USDC trustline");
  state = await readVaultState(vaultId);
  expect(state.owedB === '14.5000000', "a failed claim must leave B's half booked");
  console.log('claims     A paid 14.5 · B without trustline refused, half still booked');

  await addTrustline(b);
  await run(buildClaimShareTx(vaultId, b.publicKey(), b.publicKey()), b);
  state = await readVaultState(vaultId);
  const bAfter = await usdcBalanceOf(b.publicKey());
  expect(bAfter === '14.5000000' && state.balance === '0.0000000', `expected B 14.5 and an empty vault, got B ${bAfter}, vault ${state.balance}`);
  console.log('claims     B adds trustline, claims 14.5 · vault empty');

  await inheritancePhase(link, payer, shop);

  console.log(`\nSTELLAR_TESTNET_DIRECTORY=${link.label}=${vaultId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
