/**
 * Paying into a bond's joint account.
 *
 * Two ways in, both landing as USDC in the joint account:
 *   1. A SEP-7 pay link (and its QR code) — any SEP-7 wallet opens it pre-filled.
 *   2. A path payment from a connected browser wallet — the payer sends whatever they hold
 *      (XLM, EURC, …), Stellar's built-in exchange converts on the way, and the couple receives
 *      exactly the USDC amount asked for. One transaction, no bridge, no swap step.
 *
 * Receiving needs no signature from the couple. Nothing here ever splits or forwards — funds
 * accrue in the joint account and the partners claim later (see the vault rules in CLAUDE.md).
 */
import { Asset, Operation, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';
import { STELLAR, STELLAR_NETWORK, horizon } from './config';

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

/**
 * SEP-7 `pay` URI for USDC into the joint account. Amount is optional: without it the payer's
 * wallet asks. Unsigned (no origin_domain/signature), so wallets may show it as unverified.
 */
export function payUri(accountId: string, opts: { amount?: string; msg?: string } = {}): string {
  const params: [string, string][] = [
    ['destination', accountId],
    ['asset_code', STELLAR.usdc.getCode()],
    ['asset_issuer', STELLAR.usdc.getIssuer() as string],
  ];
  if (opts.amount) params.push(['amount', opts.amount]);
  if (opts.msg) params.push(['msg', opts.msg.slice(0, 300)]);
  // SEP-7: network_passphrase is only included off the public network.
  if (STELLAR_NETWORK !== 'public') params.push(['network_passphrase', STELLAR.passphrase]);
  // encodeURIComponent, not URLSearchParams: SEP-7 wants spaces as %20, and wallets read '+' literally.
  return `web+stellar:pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
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

export function assetLabel(asset: Asset): string {
  return asset.isNative() ? 'XLM' : asset.getCode();
}

/**
 * Every way the payer can deliver exactly `usdcAmount` USDC, using what is in their account.
 * Horizon searches the order books and AMM pools; cheapest first.
 */
export async function findPayOptions(payer: string, usdcAmount: string): Promise<PayOption[]> {
  const response = await horizon.strictReceivePaths(payer, STELLAR.usdc, usdcAmount).call();
  return response.records
    .map((r) => ({
      sourceAsset: r.source_asset_type === 'native' ? 'XLM' : `${r.source_asset_code}:${r.source_asset_issuer}`,
      sourceAmount: r.source_amount,
      path: r.path.map(toAsset),
    }))
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
 * Build the path payment: the couple receives exactly `usdcAmount` USDC; the payer spends at
 * most the quoted amount plus slippage, or the transaction fails and nothing moves.
 */
export async function buildPayTx(params: {
  payer: string;
  jointAccountId: string;
  usdcAmount: string;
  option: PayOption;
}): Promise<string> {
  const { payer, jointAccountId, usdcAmount, option } = params;
  const quoted = toStroops(option.sourceAmount);
  const sendMax = fromStroops(quoted + (quoted * BigInt(SLIPPAGE_BPS)) / BigInt(10_000));

  const account = await horizon.loadAccount(payer);
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: parseAsset(option.sourceAsset),
        sendMax,
        destination: jointAccountId,
        destAsset: STELLAR.usdc,
        destAmount: usdcAmount,
        path: option.path,
      }),
    )
    .setTimeout(120)
    .build()
    .toXDR();
}
