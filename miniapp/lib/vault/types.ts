/**
 * Bond Vault domain types.
 *
 * Shapes mirror what BondVaultModule returns, so hooks can hand contract reads
 * straight to the UI without a translation layer.
 */

/** A spend request against the couple's shared Safe. */
export type VaultSpend = {
  spendId: `0x${string}`;
  bondId: `0x${string}`;
  /** Recipient of the funds. */
  to: `0x${string}`;
  /** Amount in USDC base units (6 decimals). */
  amount: bigint;
  proposer: `0x${string}`;
  createdAt: bigint;
  executed: boolean;
  cancelled: boolean;
  /** Which partners have approved. The proposer is auto-approved on creation. */
  approvedByProposer: boolean;
  approvedByPartner: boolean;
};

export type SpendStatus =
  /** Went straight through — was within the small-spend rules. */
  | 'executed_immediately'
  /** Executed after both partners approved. */
  | 'executed_approved'
  /** Waiting on the *other* partner to approve. */
  | 'awaiting_partner'
  /** Waiting on *you* to approve. */
  | 'awaiting_you'
  | 'cancelled';

/**
 * Anything sitting in the Safe that our module cannot move.
 *
 * The Safe accepts any token — only the module is restricted to USDC — so funds
 * can arrive that the app is unable to spend or split. Surfacing them is not
 * optional: silently showing "balance: 120 USDC" while 50 WLD sits there makes
 * those tokens look lost when they are merely unmanaged.
 */
export type ForeignAsset = {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  balance: bigint;
};

export type BondVault = {
  /** Deterministic Safe address for this bond, known before it is deployed. */
  address: `0x${string}`;
  /** False until the Safe exists on-chain and is registered with the module. */
  isCreated: boolean;
  /** USDC balance, the only asset the module can move. */
  balance: bigint;
  /** Remaining USDC spendable today without the partner's approval. */
  remainingFreeAllowance: bigint;
  smallSpendThreshold: bigint;
  dailyFreeLimit: bigint;
  /** Non-USDC assets detected in the Safe. Empty in the common case. */
  foreignAssets: ForeignAsset[];
  /** ENS label claimed for this bond ("franco-maria"), or null if unnamed. */
  ensLabel: string | null;
};

/** Resolve a spend's display status relative to the viewing partner. */
export function spendStatus(spend: VaultSpend, viewer: `0x${string}` | null): SpendStatus {
  if (spend.cancelled) return 'cancelled';

  if (spend.executed) {
    // Both flags set means it went through the two-partner path; otherwise the
    // proposer alone was enough, so it was within the small-spend rules.
    return spend.approvedByProposer && spend.approvedByPartner
      ? 'executed_approved'
      : 'executed_immediately';
  }

  const isProposer = viewer !== null && spend.proposer.toLowerCase() === viewer.toLowerCase();
  return isProposer ? 'awaiting_partner' : 'awaiting_you';
}

/** Spends that still need the viewer to act. Drives the dashboard badge. */
export function needsYourSignature(spends: VaultSpend[], viewer: `0x${string}` | null): VaultSpend[] {
  return spends.filter((s) => spendStatus(s, viewer) === 'awaiting_you');
}
