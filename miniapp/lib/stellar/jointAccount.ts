/**
 * The bond's joint account on Stellar — creation and inspection.
 *
 * Creation is ONE atomic transaction, the Stellar counterpart of the vault-creation batch
 * (lib/vault/createVault.ts): the account, its USDC trustline, the bond link and both signers
 * come into existence together, or not at all.
 *
 *   source = funder (pays the fee and the starting balance)
 *   1. createAccount        funder → K, starting balance
 *   2. changeTrust          K: USDC
 *   3–5. manageData         K: humanbond.bond / .safe / .label
 *   6–7. setOptions         K: add partner A and partner B, weight 1 each
 *   8. setOptions           K: master weight 0, all thresholds 2, home_domain
 *
 * K is a throwaway keypair made in the browser. It signs this one transaction and is then
 * worthless: step 8 sets its weight to 0, so from then on only both partners together can move
 * anything. Nobody — not the funder, not this app — keeps a key to the account.
 *
 * Payments in, of any amount, need no signature at all. That is the whole point: the couple
 * receives without coordinating, and spends only together.
 */
import { Keypair, Operation, StrKey, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';
import { STELLAR, horizon, stellarHomeDomain } from './config';
import { DATA_KEYS, decodeBondLink, encodeBondLink, type BondLink } from './bondLink';

/**
 * Starting XLM for the joint account. Minimum balance is (2 + subentries) × 0.5 XLM; subentries
 * are 2 signers + 1 trustline + 3 data entries = 6, so 4 XLM is locked. The rest covers fees and
 * the 0.5 XLM reserve per claimable balance when the partners later move funds out to claim.
 */
export const JOINT_ACCOUNT_STARTING_XLM = '7';

const THRESHOLD = 2;

export type JointAccountParams = {
  funder: string;
  partnerA: string;
  partnerB: string;
  link: BondLink;
};

/**
 * Build the creation transaction, already signed by the throwaway key. The funder's wallet adds
 * the second signature, then it can be submitted.
 */
export async function buildCreateJointAccountTx(
  params: JointAccountParams,
): Promise<{ xdr: string; accountId: string }> {
  const { funder, partnerA, partnerB, link } = params;
  for (const key of [funder, partnerA, partnerB]) {
    if (!StrKey.isValidEd25519PublicKey(key)) throw new Error(`Not a Stellar account: ${key}`);
  }
  if (partnerA === partnerB) throw new Error('The two partners must use different Stellar accounts');

  const ephemeral = Keypair.random();
  const accountId = ephemeral.publicKey();
  const data = encodeBondLink(link);
  const funderAccount = await horizon.loadAccount(funder);

  const tx = new TransactionBuilder(funderAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR.passphrase,
  })
    .addOperation(Operation.createAccount({ destination: accountId, startingBalance: JOINT_ACCOUNT_STARTING_XLM }))
    .addOperation(Operation.changeTrust({ asset: STELLAR.usdc, source: accountId }))
    .addOperation(Operation.manageData({ name: DATA_KEYS.bond, value: data.bond, source: accountId }))
    .addOperation(Operation.manageData({ name: DATA_KEYS.safe, value: data.safe, source: accountId }))
    .addOperation(Operation.manageData({ name: DATA_KEYS.label, value: data.label, source: accountId }))
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: partnerA, weight: 1 }, source: accountId }))
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: partnerB, weight: 1 }, source: accountId }))
    .addOperation(
      Operation.setOptions({
        masterWeight: 0,
        lowThreshold: THRESHOLD,
        medThreshold: THRESHOLD,
        highThreshold: THRESHOLD,
        homeDomain: stellarHomeDomain(),
        source: accountId,
      }),
    )
    // Long enough for a human to read and approve in their wallet.
    .setTimeout(300)
    .build();

  tx.sign(ephemeral);
  return { xdr: tx.toXDR(), accountId };
}

/** Submit a fully signed transaction. Horizon errors surface with their result codes. */
export async function submitSignedTx(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR.passphrase);
  const result = await horizon.submitTransaction(tx);
  return result.hash;
}

export type JointAccount = {
  accountId: string;
  partners: [string, string];
  link: BondLink;
  homeDomain: string | undefined;
  balances: { asset: string; amount: string }[];
};

export type JointAccountCheck = { ok: true; account: JointAccount } | { ok: false; reason: string };

/**
 * Load an account and check it has the joint-account shape: no master key, exactly two signers
 * of weight 1, every threshold at 2, and a bond link. A missing account is a normal "no" here —
 * the federation server asks about accounts that may not exist.
 */
export async function inspectJointAccount(accountId: string): Promise<JointAccountCheck> {
  if (!StrKey.isValidEd25519PublicKey(accountId)) return { ok: false, reason: 'not a Stellar account' };

  const response = await fetch(`${STELLAR.horizonUrl}/accounts/${accountId}`);
  if (response.status === 404) return { ok: false, reason: 'account does not exist' };
  if (!response.ok) throw new Error(`Horizon ${response.status} for account ${accountId}`);
  const record = (await response.json()) as {
    signers: { key: string; weight: number; type: string }[];
    thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
    data: Record<string, string>;
    home_domain?: string;
    balances: { asset_type: string; asset_code?: string; balance: string }[];
  };

  const master = record.signers.find((s) => s.key === accountId);
  if (master && master.weight !== 0) return { ok: false, reason: 'master key still active' };

  const partners = record.signers.filter((s) => s.key !== accountId && s.weight > 0);
  if (partners.length !== 2) return { ok: false, reason: `expected 2 signers, found ${partners.length}` };
  if (partners.some((s) => s.type !== 'ed25519_public_key' || s.weight !== 1)) {
    return { ok: false, reason: 'signers must be two plain keys of weight 1' };
  }

  const { low_threshold, med_threshold, high_threshold } = record.thresholds;
  if (low_threshold !== THRESHOLD || med_threshold !== THRESHOLD || high_threshold !== THRESHOLD) {
    return { ok: false, reason: 'thresholds are not 2-of-2' };
  }

  const link = decodeBondLink(record.data);
  if (!link) return { ok: false, reason: 'no bond link data entries' };

  return {
    ok: true,
    account: {
      accountId,
      partners: [partners[0].key, partners[1].key],
      link,
      homeDomain: record.home_domain,
      balances: record.balances.map((b) => ({
        asset: b.asset_type === 'native' ? 'XLM' : (b.asset_code as string),
        amount: b.balance,
      })),
    },
  };
}
