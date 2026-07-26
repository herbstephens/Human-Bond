/**
 * Human-readable explanations for World App (MiniKit) transaction & verification errors.
 *
 * MiniKit surfaces failures as an error payload — at minimum `{ status: 'error', error_code }`,
 * and for some errors an extra `details` object (e.g. the paymaster tells us how much gas token
 * the user is short). The raw codes ("user_insufficient_funds_for_paymaster") are useless to a
 * user, so this maps them to a title + plain explanation + the concrete next step.
 *
 * `explainTxError` accepts anything: a MiniKit payload, a thrown Error, or an unknown value, so
 * callers can pass it whatever they caught.
 */

export type TxErrorKind = 'funds' | 'rejected' | 'contract' | 'verification' | 'network' | 'unknown';

export type FriendlyTxError = {
  /** Bucket that drives the icon/colour. */
  kind: TxErrorKind;
  /** Short headline, e.g. "Not enough gas". */
  title: string;
  /** One or two sentences explaining what happened, in plain language. */
  message: string;
  /** The concrete action the user can take to fix it, when there is one. */
  action?: string;
  /** Whether retrying the same transaction can succeed once the action is done. */
  retryable: boolean;
  /** The raw error_code, kept for the "technical details" line and debugging. */
  code: string;
};

type MiniKitDetails = { amount?: string; token?: string; reason?: string };
type MiniKitErrorPayload = {
  status?: string;
  error_code?: string;
  message?: string;
  description?: string;
  details?: MiniKitDetails;
};

function asPayload(input: unknown): MiniKitErrorPayload | null {
  if (input && typeof input === 'object') return input as MiniKitErrorPayload;
  return null;
}

/** The gas-token amount the paymaster is short, e.g. "0.0111 WLD", when the payload carries it. */
function shortfall(details?: MiniKitDetails): string | null {
  if (!details?.amount) return null;
  const token = details.token ?? 'WLD';
  return `${details.amount} ${token}`;
}

export function explainTxError(input: unknown): FriendlyTxError {
  const payload = asPayload(input);
  const code = payload?.error_code ?? (input instanceof Error ? 'thrown_error' : 'unknown');
  const gasToken = payload?.details?.token ?? 'WLD';

  switch (code) {
    // The user's World App wallet can't cover the network fee. World App accounts pay gas through
    // a paymaster in a token (usually WLD), so an empty gas balance blocks the tx before it runs.
    case 'user_insufficient_funds_for_paymaster':
    case 'insufficient_funds':
    case 'insufficient_balance': {
      const need = shortfall(payload?.details);
      return {
        kind: 'funds',
        title: 'Not enough to cover the network fee',
        message: need
          ? `This transaction needs about ${need} to pay the network fee, and your World App wallet doesn't have it yet.`
          : `Your World App wallet doesn't have enough ${gasToken} to pay the network fee for this transaction.`,
        action: `Add a little ${gasToken} to your World App wallet, then try again. Creating the shared wallet costs a bit more gas than a bond, so leave some margin.`,
        retryable: true,
        code,
      };
    }

    // The user dismissed the World App sheet. Not a failure — just not confirmed.
    case 'user_rejected':
    case 'user_cancelled':
    case 'user_rejected_request':
      return {
        kind: 'rejected',
        title: 'Transaction not confirmed',
        message: 'You closed the confirmation before it was signed, so nothing happened.',
        action: 'Try again and approve the transaction in World App to continue.',
        retryable: true,
        code,
      };

    // The contract isn't whitelisted in the Developer Portal for this app.
    case 'invalid_contract':
    case 'disallowed_operation':
      return {
        kind: 'contract',
        title: "This action isn't enabled yet",
        message: 'World App blocked the transaction because this contract is not on the app’s allow-list.',
        action: 'This is a configuration issue on our side, not something you did. Please let the team know.',
        retryable: false,
        code,
      };

    // The transaction would revert on-chain (a require() failed).
    case 'simulation_failed':
    case 'transaction_failed':
      return {
        kind: 'contract',
        title: "The transaction couldn't go through",
        message: 'The network rejected it because a condition on-chain was not met (for example, the bond state changed).',
        action: 'Refresh and check the current state, then try again.',
        retryable: true,
        code,
      };

    // World ID verification (the verify() step before the tx) failed or was cancelled.
    case 'verification_failed':
    case 'credential_unavailable':
    case 'max_verifications_reached':
      return {
        kind: 'verification',
        title: 'Identity check didn’t complete',
        message: 'World ID couldn’t confirm your verification for this action.',
        action: 'Try the verification again. If it keeps failing, make sure your World App is up to date.',
        retryable: true,
        code,
      };

    default:
      return {
        kind: input instanceof Error ? 'network' : 'unknown',
        title: 'Something went wrong',
        message:
          payload?.description ||
          payload?.message ||
          (input instanceof Error ? input.message : 'The transaction did not complete.'),
        action: 'Please try again in a moment.',
        retryable: true,
        code,
      };
  }
}
