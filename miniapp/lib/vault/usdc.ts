/**
 * USDC amount helpers. USDC has 6 decimals on Worldchain, so $10 is 10_000_000.
 *
 * Kept as integer math on bigint rather than going through floats — a rounding
 * slip here is money moving to the wrong amount.
 */
import { USDC_DECIMALS } from '@/lib/contracts/vault';

const UNIT = BigInt(10 ** USDC_DECIMALS);

/** Format base units for display, e.g. 8_500_000n -> "8.50". */
export function formatUsdc(amount: bigint, maxFractionDigits = 2): string {
  const negative = amount < BigInt(0);
  const abs = negative ? -amount : amount;

  const whole = abs / UNIT;
  const fraction = abs % UNIT;

  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, '0').slice(0, maxFractionDigits);
  const wholeStr = whole.toLocaleString('en-US');

  const sign = negative ? '-' : '';
  return maxFractionDigits > 0 ? `${sign}${wholeStr}.${fractionStr}` : `${sign}${wholeStr}`;
}

/** Format with the ticker, e.g. "8.50 USDC". */
export function formatUsdcWithSymbol(amount: bigint): string {
  return `${formatUsdc(amount)} USDC`;
}

/**
 * Parse user input into base units. Returns null for anything not a clean
 * positive amount, so callers can treat "invalid" and "empty" the same way.
 *
 * Extra decimals are rejected rather than silently truncated: quietly turning
 * "10.5555555" into 10.555555 is the kind of surprise that erodes trust in a
 * money screen.
 */
export function parseUsdc(input: string): bigint | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;

  const [wholePart = '', fractionPart = ''] = trimmed.split('.');
  if (wholePart === '' && fractionPart === '') return null;
  if (fractionPart.length > USDC_DECIMALS) return null;

  const whole = wholePart === '' ? BigInt(0) : BigInt(wholePart);
  const fraction = fractionPart === '' ? BigInt(0) : BigInt(fractionPart.padEnd(USDC_DECIMALS, '0'));

  const total = whole * UNIT + fraction;
  return total > BigInt(0) ? total : null;
}

/** Format an arbitrary-decimal token amount, for foreign assets in the Safe. */
export function formatTokenAmount(amount: bigint, decimals: number, maxFractionDigits = 4): string {
  const unit = BigInt(10) ** BigInt(decimals);
  const whole = amount / unit;
  const fraction = amount % unit;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, maxFractionDigits).replace(/0+$/, '');
  return fractionStr === '' ? whole.toLocaleString('en-US') : `${whole.toLocaleString('en-US')}.${fractionStr}`;
}

/** Shorten an address for display, e.g. "0x1234…cdef". */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
