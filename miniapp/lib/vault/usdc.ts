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

  const padded = fraction.toString().padStart(USDC_DECIMALS, '0');
  // Dust guard: 4000n is 0.004 USDC, which at 2 digits renders "0.00" — a real
  // balance displayed as empty. Widen just enough to keep it visible.
  const digits =
    whole === BigInt(0) && fraction > BigInt(0) && padded.slice(0, maxFractionDigits) === '0'.repeat(maxFractionDigits)
      ? padded.replace(/0+$/, '').length
      : maxFractionDigits;

  const fractionStr = padded.slice(0, digits);
  const wholeStr = whole.toLocaleString('en-US');

  const sign = negative ? '-' : '';
  return digits > 0 ? `${sign}${wholeStr}.${fractionStr}` : `${sign}${wholeStr}`;
}

/** Format with the ticker, e.g. "8.50 USDC". */
export function formatUsdcWithSymbol(amount: bigint): string {
  return `${formatUsdc(amount)} USDC`;
}

/**
 * A balance for a dashboard, from human units (not base units).
 *
 * "Clean whole numbers on dashboards" (docs/design-system.md §4) is the right
 * default and stays the default — but it was implemented as `Math.round`, which
 * lies about small real balances: `Math.round(0.98)` reads 1, and
 * `Math.round(0.4)` reads 0 — a funded multisig showing empty. On a money screen
 * that is the worst possible rounding direction.
 *
 * So: whole amounts stay whole, and a fraction that exists is never hidden.
 * Truncated rather than rounded, because a balance must never claim more than
 * the Safe actually holds. Sub-cent dust keeps enough digits to stay visible.
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const truncate = (digits: number) => Math.floor(abs * 10 ** digits) / 10 ** digits;

  let out: string;
  if (Number.isInteger(abs)) {
    out = abs.toLocaleString('en-US');
  } else if (truncate(2) >= 0.01) {
    out = truncate(2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // Below a cent but not zero — show it rather than round it out of existence.
    out = truncate(USDC_DECIMALS).toLocaleString('en-US', { maximumFractionDigits: USDC_DECIMALS });
  }
  return negative ? `-${out}` : out;
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
