/**
 * Paying into a bond's vault.
 *
 * The vault is a contract, and classic Stellar payments cannot target a contract address, so
 * paying in is a USDC transfer on the USDC token contract (vault.ts, buildDepositTx).
 *
 * A payer without enough USDC converts first: a strict-receive path payment to THEMSELVES turns
 * what they hold (XLM, EURC, …) into exactly the USDC needed, through Stellar's built-in exchange.
 * Then they transfer. Two signatures instead of one — the price of a contract vault.
 *
 * Nothing here splits or forwards: funds accrue in the vault under its spend rules.
 */
import { Asset, Operation, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';
import { STELLAR, horizon } from './config';

const STROOPS_PER_UNIT = BigInt(10_000_000);

/** "11.4363442" → 114363442n. Stellar amounts have at most 7 decimals. */
export function toStroops(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > 7) throw new Error(`Too many decimals in ${amount}`);
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(fraction.padEnd(7, '0'));
}

export function fromStroops(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_UNIT;
  const fraction = (stroops % STROOPS_PER_UNIT).toString().padStart(7, '0');
  return `${whole}.${fraction}`;
}

export async function usdcBalanceOf(account: string): Promise<string> {
  const loaded = await horizon.loadAccount(account);
  const line = loaded.balances.find(
    (b) => 'asset_code' in b && b.asset_code === STELLAR.usdc.getCode() && b.asset_issuer === STELLAR.usdc.getIssuer(),
  );
  return line ? line.balance : '0.0000000';
}

export type PayOption = {
  /** "XLM" or "CODE:ISSUER" */
  sourceAsset: string;
  sourceAmount: string;
  path: Asset[];
};

function toAsset(record: { asset_type: string; asset_code?: string; asset_issuer?: string }): Asset {
  return record.asset_type === 'native' ? Asset.native() : new Asset(record.asset_code as string, record.asset_issuer as string);
}

/**
 * Every way the payer can obtain exactly `usdcAmount` USDC from what is in their account,
 * cheapest first. Horizon searches the order books and AMM pools.
 */
export async function findPayOptions(payer: string, usdcAmount: string): Promise<PayOption[]> {
  const response = await horizon.strictReceivePaths(payer, STELLAR.usdc, usdcAmount).call();
  return response.records
    .map((r) => ({
      sourceAsset: r.source_asset_type === 'native' ? 'XLM' : `${r.source_asset_code}:${r.source_asset_issuer}`,
      sourceAmount: r.source_amount,
      path: r.path.map(toAsset),
    }))
    .filter((o) => !o.sourceAsset.startsWith(`${STELLAR.usdc.getCode()}:`))
    .sort((a, b) => (toStroops(a.sourceAmount) < toStroops(b.sourceAmount) ? -1 : 1));
}

function parseAsset(label: string): Asset {
  if (label === 'XLM') return Asset.native();
  const [code, issuer] = label.split(':');
  return new Asset(code, issuer);
}

/** Default tolerance for the price moving between quote and submit. */
export const SLIPPAGE_BPS = 100;

/**
 * Convert into exactly `usdcAmount` USDC in the payer's own account, spending at most the quote
 * plus slippage. Adds the USDC trustline first if the payer has none.
 */
export async function buildConvertTx(params: { payer: string; usdcAmount: string; option: PayOption }): Promise<string> {
  const { payer, usdcAmount, option } = params;
  const quoted = toStroops(option.sourceAmount);
  const sendMax = fromStroops(quoted + (quoted * BigInt(SLIPPAGE_BPS)) / BigInt(10_000));

  const account = await horizon.loadAccount(payer);
  const hasTrustline = account.balances.some(
    (b) => 'asset_code' in b && b.asset_code === STELLAR.usdc.getCode() && b.asset_issuer === STELLAR.usdc.getIssuer(),
  );
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase });
  if (!hasTrustline) builder.addOperation(Operation.changeTrust({ asset: STELLAR.usdc }));
  return builder
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: parseAsset(option.sourceAsset),
        sendMax,
        destination: payer,
        destAsset: STELLAR.usdc,
        destAmount: usdcAmount,
        path: option.path,
      }),
    )
    .setTimeout(120)
    .build()
    .toXDR();
}

/** Submit a signed classic transaction. Horizon errors surface with their result codes. */
export async function submitClassic(signedXdr: string): Promise<string> {
  const result = await horizon.submitTransaction(TransactionBuilder.fromXDR(signedXdr, STELLAR.passphrase));
  return result.hash;
}
