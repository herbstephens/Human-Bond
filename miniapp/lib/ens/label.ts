/**
 * ENS label normalisation and validation for HumanBond subnames.
 *
 * The contract only enforces what is cheap and matters on-chain: non-empty,
 * within DNS length (63 bytes), and not already taken. Full ENSIP-15
 * normalisation needs Unicode tables no contract can carry, so we do the
 * client-side hygiene here and keep the on-chain checks as the backstop.
 *
 * We intentionally restrict to a safe, unambiguous character set (a–z, 0–9 and
 * single internal hyphens). It rules out confusable/emoji labels and matches
 * what resolvers and browsers will actually render, at the cost of not allowing
 * every technically-valid ENS label. For a marriage name, legibility wins.
 */

import { ENS_PARENT } from '@/lib/contracts/registrar';

export const MAX_LABEL_BYTES = 63;

export type LabelCheck = { ok: true; label: string } | { ok: false; reason: string };

/**
 * Normalise to the canonical form we register on-chain: trimmed, lowercased,
 * spaces and underscores folded to hyphens, collapsed repeats, no edge hyphens.
 */
export function normalizeLabel(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Validate a raw input and return the normalised label, or a human reason why not. */
export function checkLabel(input: string): LabelCheck {
  const label = normalizeLabel(input);

  if (label.length === 0) return { ok: false, reason: 'Enter a name' };
  // DNS length is counted in bytes; our charset is ASCII so length === bytes.
  if (label.length > MAX_LABEL_BYTES) return { ok: false, reason: `Too long (max ${MAX_LABEL_BYTES})` };
  if (!/^[a-z0-9-]+$/.test(label)) return { ok: false, reason: 'Only letters, numbers and hyphens' };

  return { ok: true, label };
}

/** Full name as it will appear, e.g. "franco-maria.humanbond.eth" (or .humandbond.eth on TEST). */
export function toFullName(label: string): string {
  return `${label}.${ENS_PARENT}`;
}
